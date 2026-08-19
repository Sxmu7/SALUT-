-- Salut! – Supabase Schema
-- Führe dieses Skript im SQL-Editor deines Supabase-Projekts aus, um die
-- App von "lokalem Demo-Modus" auf echtes Multi-Device-Backend umzustellen.
-- Danach NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (und für
-- den Cron-Job SUPABASE_SERVICE_ROLE_KEY) als Vercel Env Vars setzen.
--
-- Gefahrlos erneut ausführbar: Tabellen nutzen "if not exists", Policies
-- werden vor dem Neuanlegen per "drop policy if exists" entfernt, Funktionen
-- per "create or replace" ersetzt und die Seed-Daten per "on conflict do
-- nothing" übersprungen. Du kannst dieses komplette Skript also jederzeit
-- erneut in den SQL-Editor einfügen und ausführen, z.B. nach einem Update.

create extension if not exists "pgcrypto";

-- ---------- Profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Spieler',
  avatar_emoji text not null default '🥂',
  birthday date,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Profiles sind für angemeldete Nutzer lesbar" on profiles;
create policy "Profiles sind für angemeldete Nutzer lesbar"
  on profiles for select using (auth.role() = 'authenticated');

drop policy if exists "Nutzer können ihr eigenes Profil bearbeiten" on profiles;
create policy "Nutzer können ihr eigenes Profil bearbeiten"
  on profiles for update using (auth.uid() = id);

drop policy if exists "Nutzer können ihr eigenes Profil anlegen" on profiles;
create policy "Nutzer können ihr eigenes Profil anlegen"
  on profiles for insert with check (auth.uid() = id);

-- ---------- Groups ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🎉',
  invite_code text not null unique,
  owner_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table groups enable row level security;
alter table group_members enable row level security;

-- ---------- Mitgliedschafts-Helfer (Security Definer) ----------
-- WICHTIG (beim lokalen Testen gegen echtes Postgres gefunden, siehe
-- unten): group_members hatte bisher eine SELECT-Policy, die group_members
-- in ihrem EIGENEN USING-Ausdruck erneut abfragte (ein direkter
-- Selbstbezug). Ein einzelner Query direkt auf group_members lief damit
-- noch durch, aber sobald eine ANDERE Tabelle (groups, events, ...)
-- group_members in ihrer eigenen Policy mit-abfragt, brauchte Postgres
-- RLS auf diese "gm"-Instanz erneut anwenden - was wieder group_members'
-- eigene (sich selbst abfragende) Policy auslöste, und das unbegrenzt
-- weiter: "infinite recursion detected in policy for relation
-- group_members". Ein bekannter, von Supabase selbst dokumentierter
-- RLS-Fallstrick. Der Fix: eine SECURITY DEFINER-Funktion, die
-- group_members OHNE erneute RLS-Anwendung abfragt (sie läuft mit den
-- Rechten des Eigentümers), damit die Policy keinen echten Self-Join
-- mehr enthält.
create or replace function is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members where group_id = p_group_id and user_id = p_user_id
  );
$$;

revoke all on function is_group_member(uuid, uuid) from public;
grant execute on function is_group_member(uuid, uuid) to authenticated, anon;

drop policy if exists "Mitglieder sehen ihre Gruppen" on groups;
create policy "Mitglieder sehen ihre Gruppen"
  on groups for select using (is_group_member(id, auth.uid()));

drop policy if exists "Nutzer können Gruppen erstellen" on groups;
create policy "Nutzer können Gruppen erstellen"
  on groups for insert with check (auth.uid() = owner_id);

drop policy if exists "Mitgliedschaften sind für Gruppenmitglieder sichtbar" on group_members;
create policy "Mitgliedschaften sind für Gruppenmitglieder sichtbar"
  on group_members for select using (is_group_member(group_id, auth.uid()));

drop policy if exists "Nutzer können Gruppen beitreten" on group_members;
create policy "Nutzer können Gruppen beitreten"
  on group_members for insert with check (auth.uid() = user_id);

-- ---------- Categories & Challenges ----------
create table if not exists categories (
  id text primary key,
  name text not null,
  icon text not null,
  gradient text not null,
  description text
);

create table if not exists challenges (
  id text primary key,
  category_id text references categories (id),
  title text not null,
  description text not null,
  points int not null check (points > 0),
  difficulty text not null check (difficulty in ('easy','medium','hard','legendary')),
  proof_type text not null check (proof_type in ('photo','video','none')),
  icon text not null default '🎯',
  animation text not null default 'pop',
  is_birthday_exclusive boolean not null default false,
  is_custom boolean not null default false,
  created_by uuid references profiles (id),
  source text not null default 'fixed' check (source in ('fixed','manual','ai')),
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table challenges enable row level security;

drop policy if exists "Kategorien sind öffentlich lesbar" on categories;
create policy "Kategorien sind öffentlich lesbar" on categories for select using (true);
drop policy if exists "Challenges sind öffentlich lesbar" on challenges;
create policy "Challenges sind öffentlich lesbar" on challenges for select using (true);
drop policy if exists "Angemeldete Nutzer können eigene Challenges anlegen" on challenges;
create policy "Angemeldete Nutzer können eigene Challenges anlegen"
  on challenges for insert with check (auth.role() = 'authenticated');

-- ---------- Events ----------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  title text not null,
  type text not null check (type in ('birthday','custom','party')),
  emoji text not null default '🎉',
  event_date timestamptz not null,
  birthday_user_id uuid references profiles (id),
  status text not null default 'upcoming' check (status in ('upcoming','live','finished')),
  created_at timestamptz not null default now()
);

create table if not exists event_challenges (
  event_id uuid not null references events (id) on delete cascade,
  challenge_id text not null references challenges (id),
  sort_order int not null default 0,
  primary key (event_id, challenge_id)
);

-- ---------- Reihum-Modus & Abend-Ziel ----------
-- "Reihum-Modus": statt dass alle Mitspieler jede aufgedeckte Challenge
-- parallel machen können, ist immer nur eine Person am Zug (siehe
-- TurnModePanel.tsx). turn_order/turn_index leben auf events, welcher
-- Person eine konkrete aufgedeckte Challenge zugewiesen wurde auf
-- event_challenges (assigned_user_id) – nötig, weil mehrere Challenges
-- gleichzeitig offen sein können ("mehrere Runden gleichzeitig").
alter table events add column if not exists turn_mode_enabled boolean not null default false;
alter table events add column if not exists turn_order uuid[] not null default '{}';
alter table events add column if not exists turn_index int not null default 0;
alter table events add column if not exists target_challenge_count int;
alter table events add column if not exists ended_at timestamptz;
alter table event_challenges add column if not exists assigned_user_id uuid references profiles (id);

alter table events enable row level security;
alter table event_challenges enable row level security;

drop policy if exists "Mitglieder sehen Events ihrer Gruppe" on events;
create policy "Mitglieder sehen Events ihrer Gruppe"
  on events for select using (
    exists (select 1 from group_members gm where gm.group_id = events.group_id and gm.user_id = auth.uid())
  );

drop policy if exists "Mitglieder können Events erstellen" on events;
create policy "Mitglieder können Events erstellen"
  on events for insert with check (
    exists (select 1 from group_members gm where gm.group_id = events.group_id and gm.user_id = auth.uid())
  );

drop policy if exists "Mitglieder sehen Event-Challenges" on event_challenges;
create policy "Mitglieder sehen Event-Challenges"
  on event_challenges for select using (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = event_challenges.event_id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Mitglieder können Event-Challenges hinzufügen" on event_challenges;
create policy "Mitglieder können Event-Challenges hinzufügen"
  on event_challenges for insert with check (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = event_challenges.event_id and gm.user_id = auth.uid()
    )
  );

-- ---------- Submissions (Beweise) & Votes ----------
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  challenge_id text not null references challenges (id),
  user_id uuid not null references profiles (id) on delete cascade,
  proof_type text not null check (proof_type in ('photo','video','none')),
  proof_url text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  submission_id uuid not null references submissions (id) on delete cascade,
  voter_id uuid not null references profiles (id) on delete cascade,
  approve boolean not null,
  created_at timestamptz not null default now(),
  primary key (submission_id, voter_id)
);

alter table submissions enable row level security;
alter table votes enable row level security;

drop policy if exists "Mitglieder sehen Submissions ihrer Gruppe" on submissions;
create policy "Mitglieder sehen Submissions ihrer Gruppe"
  on submissions for select using (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = submissions.event_id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Nutzer können eigene Submissions anlegen" on submissions;
create policy "Nutzer können eigene Submissions anlegen"
  on submissions for insert with check (auth.uid() = user_id);

drop policy if exists "Mitglieder sehen Votes ihrer Gruppe" on votes;
create policy "Mitglieder sehen Votes ihrer Gruppe"
  on votes for select using (
    exists (
      select 1 from submissions s
      join events e on e.id = s.event_id
      join group_members gm on gm.group_id = e.group_id
      where s.id = votes.submission_id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Mitglieder können abstimmen" on votes;
create policy "Mitglieder können abstimmen"
  on votes for insert with check (auth.uid() = voter_id);

-- ---------- Storage Bucket für Beweisfotos/-videos ----------
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

drop policy if exists "Beweise sind öffentlich lesbar" on storage.objects;
create policy "Beweise sind öffentlich lesbar"
  on storage.objects for select using (bucket_id = 'proofs');

drop policy if exists "Angemeldete Nutzer können Beweise hochladen" on storage.objects;
create policy "Angemeldete Nutzer können Beweise hochladen"
  on storage.objects for insert with check (bucket_id = 'proofs' and auth.role() = 'authenticated');

-- ---------- Ranking View (Kickbase-Style Punktesumme) ----------
-- security_invoker: die View läuft mit den RLS-Rechten des abfragenden
-- Nutzers, nicht mit denen des View-Erstellers – sonst würde sie über die
-- "groups"/"group_members"-RLS-Policies hinweg *alle* Gruppen offenlegen.
create or replace view group_rankings
with (security_invoker = true) as
select
  gm.group_id,
  p.id as user_id,
  p.name,
  p.avatar_emoji,
  coalesce(sum(s.points_awarded) filter (where s.status = 'approved'), 0) as points,
  count(s.id) filter (where s.status = 'approved') as challenges_completed
from group_members gm
join profiles p on p.id = gm.user_id
left join events e on e.group_id = gm.group_id
left join submissions s on s.event_id = e.id and s.user_id = p.id
group by gm.group_id, p.id, p.name, p.avatar_emoji;

-- ---------- Gruppe per Einladungscode beitreten (Security Definer) ----------
-- Die "groups"-SELECT-Policy erlaubt nur Mitgliedern das Lesen einer Gruppe.
-- Um überhaupt per Code beitreten zu können, muss der Lookup + die Mitglied-
-- schaft serverseitig mit erhöhten Rechten passieren – aber streng begrenzt
-- auf genau diese eine Aktion (kein offener SELECT auf alle Gruppen).
create or replace function join_group_by_code(p_invite_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group groups;
begin
  select * into v_group from groups where invite_code = upper(trim(p_invite_code));
  if not found then
    raise exception 'invite_code_not_found';
  end if;

  insert into group_members (group_id, user_id)
  values (v_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

revoke all on function join_group_by_code(text) from public;
grant execute on function join_group_by_code(text) to authenticated;

-- ---------- Gruppe erstellen (Security Definer) ----------
-- Gleiches Henne-Ei-Problem wie beim Beitreten, nur beim Anlegen: die
-- "groups"-SELECT-Policy verlangt eine group_members-Zeile, die es beim
-- INSERT selbst noch nicht gibt. Ohne diese Funktion würde ein direktes
-- `insert ... select()` aus dem Client zwar die Zeile anlegen (WITH CHECK
-- owner_id = auth.uid() ist erfüllt), aber beim Zurückliefern der neu
-- angelegten Zeile (RETURNING wird in Postgres RLS wie ein SELECT
-- behandelt) an genau dieser SELECT-Policy scheitern – der Client bekommt
-- dann "0 rows" statt der neuen Gruppe, obwohl sie in Wahrheit angelegt
-- wurde. Gruppe + Erstmitgliedschaft laufen deshalb atomar hier, danach
-- ist die SELECT-Policy erfüllt.
create or replace function create_group(p_name text, p_emoji text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group groups;
  v_invite_code text;
  v_attempts int := 0;
begin
  loop
    v_invite_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into groups (name, emoji, invite_code, owner_id)
      values (p_name, p_emoji, v_invite_code, auth.uid())
      returning * into v_group;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 5 then
        raise exception 'invite_code_generation_failed';
      end if;
    end;
  end loop;

  insert into group_members (group_id, user_id)
  values (v_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

revoke all on function create_group(text, text) from public;
grant execute on function create_group(text, text) to authenticated;

-- ---------- Gruppe verlassen (Security Definer) ----------
-- Jedes Mitglied kann seine eigene Mitgliedschaft beenden. Ausnahme: der
-- Ersteller kann nicht "einfach verlassen", solange noch andere Mitglieder
-- da sind (sonst gäbe es eine Gruppe ohne gültigen Owner) - er muss dann
-- entweder die Gruppe komplett löschen oder erst alle anderen entfernen.
-- Ist der Ersteller das letzte verbleibende Mitglied, entspricht "verlassen"
-- ohnehin einem Löschen der ganzen Gruppe, das übernimmt diese Funktion
-- dann gleich mit.
create or replace function leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_member_count int;
begin
  select owner_id into v_owner_id from groups where id = p_group_id;
  if v_owner_id is null then
    raise exception 'group_not_found';
  end if;

  if not exists (
    select 1 from group_members where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'not_a_member';
  end if;

  if auth.uid() = v_owner_id then
    select count(*) into v_member_count from group_members where group_id = p_group_id;
    if v_member_count > 1 then
      raise exception 'owner_must_delete_or_remove_members_first';
    end if;
    delete from groups where id = p_group_id;
    return;
  end if;

  delete from group_members where group_id = p_group_id and user_id = auth.uid();
end;
$$;

revoke all on function leave_group(uuid) from public;
grant execute on function leave_group(uuid) to authenticated;

-- ---------- Mitglied entfernen (Security Definer) ----------
-- Nur der Ersteller darf jemanden entfernen, und nicht sich selbst (dafür
-- gibt es leave_group()/delete_group()) - beides wird serverseitig
-- geprüft, ein Client kann diese Regeln nicht umgehen.
create or replace function kick_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from groups where id = p_group_id;
  if v_owner_id is null then
    raise exception 'group_not_found';
  end if;
  if auth.uid() <> v_owner_id then
    raise exception 'only_owner_can_remove_members';
  end if;
  if p_user_id = v_owner_id then
    raise exception 'cannot_remove_owner';
  end if;

  delete from group_members where group_id = p_group_id and user_id = p_user_id;
end;
$$;

revoke all on function kick_group_member(uuid, uuid) from public;
grant execute on function kick_group_member(uuid, uuid) to authenticated;

-- ---------- Gruppe komplett löschen (Security Definer) ----------
-- Nur der Ersteller. Löscht via "on delete cascade" automatisch auch
-- group_members, events, event_challenges, submissions, votes und (falls
-- genutzt) die Push-/Bingo-Tabellen dieser Gruppe mit.
create or replace function delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from groups where id = p_group_id and owner_id = auth.uid()
  ) then
    raise exception 'only_owner_can_delete_group';
  end if;

  delete from groups where id = p_group_id;
end;
$$;

revoke all on function delete_group(uuid) from public;
grant execute on function delete_group(uuid) to authenticated;

-- ---------- Reihum-Modus & Abend-Ziel (Security Definer) ----------
-- Events haben bewusst keine generische UPDATE-Policy (wie der Rest dieses
-- Schemas nur Security-Definer-RPCs für Schreibzugriffe) – daher hier drei
-- kleine Funktionen statt eines direkten .update() vom Client.

create or replace function set_turn_mode(p_event_id uuid, p_enabled boolean)
returns events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events;
  v_order uuid[];
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;
  if not is_group_member(v_event.group_id, auth.uid()) then
    raise exception 'not_a_group_member';
  end if;

  v_order := v_event.turn_order;
  -- Reihenfolge nur beim allerersten Aktivieren aus den aktuellen
  -- Gruppenmitgliedern befüllen – bleibt danach stabil, auch wenn der
  -- Modus zwischendurch mal ausgeschaltet wird (siehe GameEvent-Typ).
  if p_enabled and (v_order is null or array_length(v_order, 1) is null) then
    select array_agg(user_id order by joined_at) into v_order
      from group_members where group_id = v_event.group_id;
  end if;

  update events
    set turn_mode_enabled = p_enabled, turn_order = coalesce(v_order, '{}')
    where id = p_event_id
    returning * into v_event;
  return v_event;
end;
$$;

revoke all on function set_turn_mode(uuid, boolean) from public;
grant execute on function set_turn_mode(uuid, boolean) to authenticated;

create or replace function set_event_target(p_event_id uuid, p_target int)
returns events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;
  if not is_group_member(v_event.group_id, auth.uid()) then
    raise exception 'not_a_group_member';
  end if;
  if p_target is not null and p_target < 1 then
    raise exception 'invalid_target';
  end if;

  update events set target_challenge_count = p_target where id = p_event_id returning * into v_event;
  return v_event;
end;
$$;

revoke all on function set_event_target(uuid, int) from public;
grant execute on function set_event_target(uuid, int) to authenticated;

create or replace function end_event(p_event_id uuid)
returns events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;
  if not is_group_member(v_event.group_id, auth.uid()) then
    raise exception 'not_a_group_member';
  end if;

  update events set status = 'finished', ended_at = now() where id = p_event_id returning * into v_event;
  return v_event;
end;
$$;

revoke all on function end_event(uuid) from public;
grant execute on function end_event(uuid) to authenticated;

-- ---------- Nach einer Genehmigung: Reihum weiterschalten + Abend-Ziel prüfen ----------
-- Wird von cast_vote() (unten) direkt nach dem Genehmigen aufgerufen UND
-- vom Client für den proofType="none"-Sonderfall (sofortige Genehmigung
-- ganz ohne Abstimmung, siehe submitChallengeProof() in queries.ts – der
-- läuft nie durch cast_vote()).
create or replace function finalize_submission_approval(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission submissions;
  v_event events;
  v_assigned uuid;
begin
  select * into v_submission from submissions where id = p_submission_id;
  if not found or v_submission.status <> 'approved' then
    return;
  end if;

  select * into v_event from events where id = v_submission.event_id;
  if not found then
    return;
  end if;

  -- Reihum-Modus: nur weiterschalten, wenn diese Challenge wirklich der
  -- Person zugewiesen war, die laut turn_index gerade dran war – schützt
  -- gegen doppeltes Weiterschalten, falls mehrere Runden gleichzeitig
  -- offen sind und aus Versehen mehrfach aufgerufen wird. Postgres-Arrays
  -- sind 1-indiziert, turn_index ist wie im Client 0-basiert.
  if v_event.turn_mode_enabled
     and array_length(v_event.turn_order, 1) > 0
     and v_event.turn_order[v_event.turn_index + 1] = v_submission.user_id
  then
    select assigned_user_id into v_assigned
      from event_challenges
      where event_id = v_submission.event_id and challenge_id = v_submission.challenge_id;
    if v_assigned = v_submission.user_id then
      update events
        set turn_index = (v_event.turn_index + 1) % array_length(v_event.turn_order, 1)
        where id = v_event.id
        returning * into v_event;
    end if;
  end if;

  -- Abend-Ziel erreicht? Jede Challenge kommt pro Event nur einmal in
  -- event_challenges vor (Primary Key), die Zeilenzahl entspricht also der
  -- Anzahl gewürfelter Challenges.
  if v_event.target_challenge_count is not null and v_event.status <> 'finished' then
    if (select count(*) from event_challenges where event_id = v_event.id) >= v_event.target_challenge_count then
      update events set status = 'finished', ended_at = now() where id = v_event.id;
    end if;
  end if;
end;
$$;

revoke all on function finalize_submission_approval(uuid) from public;
grant execute on function finalize_submission_approval(uuid) to authenticated;

-- ---------- Abstimmen (Security Definer) ----------
-- Stimme + Quorum-Auswertung + Status-Update laufen atomar in einer
-- Funktion. Das verhindert Race Conditions, wenn mehrere Mitspieler auf
-- verschiedenen Handys fast gleichzeitig abstimmen, und umgeht sauber,
-- dass es bewusst keine offene UPDATE-Policy auf "submissions" gibt.
create or replace function cast_vote(p_submission_id uuid, p_approve boolean)
returns submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission submissions;
  v_group_id uuid;
  v_total_voters int;
  v_quorum int;
  v_approvals int;
  v_rejections int;
  v_points int;
begin
  select * into v_submission from submissions where id = p_submission_id;
  if not found then
    raise exception 'submission_not_found';
  end if;

  if v_submission.status <> 'pending' then
    return v_submission;
  end if;

  -- Niemand stimmt über die eigene Einreichung ab (die UI zeigt dafür gar
  -- keine Buttons an, aber ohne diese serverseitige Prüfung könnte ein
  -- direkter RPC-Aufruf das umgehen und die eigene Abstimmung
  -- manipulieren).
  if auth.uid() = v_submission.user_id then
    raise exception 'cannot_vote_on_own_submission';
  end if;

  insert into votes (submission_id, voter_id, approve)
  values (p_submission_id, auth.uid(), p_approve)
  on conflict (submission_id, voter_id) do update set approve = excluded.approve;

  select e.group_id into v_group_id from events e where e.id = v_submission.event_id;
  select count(*) into v_total_voters
    from group_members
    where group_id = v_group_id and user_id <> v_submission.user_id;
  v_quorum := greatest(1, ceil(v_total_voters / 2.0));

  -- user_id <> v_submission.user_id ist eigentlich durch die Prüfung oben
  -- schon ausgeschlossen, bleibt hier aber als zweite, unabhängige
  -- Absicherung stehen (defense in depth) – falls doch mal eine
  -- Selbst-Stimme in der Tabelle landet (z.B. aus einer älteren Version
  -- vor diesem Fix), zählt sie hier trotzdem nicht mit.
  select
    count(*) filter (where approve),
    count(*) filter (where not approve)
    into v_approvals, v_rejections
    from votes where submission_id = p_submission_id and voter_id <> v_submission.user_id;

  if v_approvals >= v_quorum then
    select points into v_points from challenges where id = v_submission.challenge_id;
    update submissions set status = 'approved', points_awarded = coalesce(v_points, 0)
      where id = p_submission_id returning * into v_submission;
    -- Reihum-Weiterschaltung + Abend-Ziel-Check (siehe oben) – bewusst
    -- nach dem update, damit finalize_submission_approval() den frischen
    -- status='approved' sieht.
    perform finalize_submission_approval(p_submission_id);
  elsif v_rejections >= v_quorum then
    update submissions set status = 'rejected', points_awarded = 0
      where id = p_submission_id returning * into v_submission;
  end if;

  return v_submission;
end;
$$;

revoke all on function cast_vote(uuid, boolean) from public;
grant execute on function cast_vote(uuid, boolean) to authenticated;
-- ---------- Seed: feste Kategorien & Challenges ----------
-- Generiert aus src/lib/data/categories.ts / challenges.ts. Idempotent
-- (ON CONFLICT DO NOTHING), damit erneutes Ausführen sicher ist. Nötig,
-- weil event_challenges.challenge_id und die cast_vote()-Punktelogik per
-- Foreign Key / Lookup auf reale Zeilen in "challenges" angewiesen sind –
-- auch für die fest eingebauten (nicht von Nutzern hochgeladenen) Challenges.
insert into categories (id, name, icon, gradient, description) values
  ('klassiker', 'Klassiker', '🍻', 'linear-gradient(135deg,#FF9F0A,#FF375F)', 'Bewährte Trinkspiel-Kost'),
  ('performance', 'Performance', '🎭', 'linear-gradient(135deg,#BF5AF2,#FF375F)', 'Auftritt, Tanz & Show'),
  ('wissen', 'Wissen', '🧠', 'linear-gradient(135deg,#64D2FF,#0A84FF)', 'Quiz & Köpfchen'),
  ('mut', 'Mut', '🔥', 'linear-gradient(135deg,#FF453A,#FF9F0A)', 'Nur für Mutige'),
  ('team', 'Team', '🤝', 'linear-gradient(135deg,#30D158,#64D2FF)', 'Gemeinsam zum Sieg'),
  ('kreativ', 'Kreativ', '🎨', 'linear-gradient(135deg,#FFD60A,#FF9F0A)', 'Kunst & Kreativität')
on conflict (id) do nothing;

insert into challenges (id, category_id, title, description, points, difficulty, proof_type, icon, animation, is_birthday_exclusive, is_custom, source) values
  ('c-01', 'klassiker', 'Daumen-Meister', 'Verliere eine Runde "Ich hab noch nie" ohne mit der Wimper zu zucken.', 10, 'easy', 'none', '👍', 'pop', false, false, 'fixed'),
  ('c-02', 'klassiker', 'Ex-Trinker', 'Trinke dein Getränk in einem Zug leer.', 20, 'easy', 'video', '🥃', 'shake', false, false, 'fixed'),
  ('c-03', 'klassiker', 'Bierdeckel-Flip', 'Schaffe einen Bierdeckel-Flip vom Tisch in dein Glas – 3 Versuche.', 30, 'medium', 'video', '🎯', 'bounce', false, false, 'fixed'),
  ('c-04', 'klassiker', 'Flunkyball-Legende', 'Gewinne eine spontane Runde Flunkyball gegen einen Mitspieler.', 35, 'medium', 'photo', '🍺', 'bounce', false, false, 'fixed'),
  ('c-05', 'klassiker', 'Reimrunde', 'Bringe fünf Getränke-Namen zum Reimen, ohne zu stocken.', 15, 'easy', 'video', '📝', 'slide', false, false, 'fixed'),
  ('c-10', 'performance', 'Tanz der Elemente', 'Performe 30 Sekunden einen selbst erfundenen Tanz zum nächsten Song.', 35, 'medium', 'video', '💃', 'shake', false, false, 'fixed'),
  ('c-11', 'performance', 'Stand-Up Minute', 'Halte 60 Sekunden Stand-Up-Comedy über den Abend – ohne Pause.', 45, 'medium', 'video', '🎤', 'glow', false, false, 'fixed'),
  ('c-12', 'performance', 'Lippen-Playback', 'Performe den Refrain eines Songs komplett lautlos per Lip-Sync.', 25, 'medium', 'video', '🎶', 'pulse', false, false, 'fixed'),
  ('c-13', 'performance', 'Catwalk-Diva', 'Laufe einen improvisierten Catwalk durch den Raum wie auf der Fashion Week.', 20, 'easy', 'video', '👠', 'slide', false, false, 'fixed'),
  ('c-14', 'performance', 'Stimmen-Imitator', 'Imitiere eine berühmte Stimme, bis die Gruppe sie errät.', 40, 'medium', 'video', '🗣️', 'pop', false, false, 'fixed'),
  ('c-20', 'wissen', 'Party-Quiz', 'Beantworte 3 Trivia-Fragen der Gruppe richtig in Folge.', 25, 'medium', 'none', '🧠', 'pulse', false, false, 'fixed'),
  ('c-21', 'wissen', 'Alphabet-Blitz', 'Nenne zu jedem Buchstaben A-J spontan eine Cocktail-Zutat.', 30, 'medium', 'video', '🔤', 'slide', false, false, 'fixed'),
  ('c-22', 'wissen', 'Rückwärts-Zungenbrecher', 'Sprich einen Zungenbrecher fehlerfrei rückwärts.', 45, 'hard', 'video', '🌀', 'shake', false, false, 'fixed'),
  ('c-23', 'wissen', 'Kopfrechnen unter Druck', 'Löse 5 Kopfrechenaufgaben in 30 Sekunden, während dich alle ablenken.', 35, 'medium', 'video', '🧮', 'pop', false, false, 'fixed'),
  ('c-24', 'wissen', 'Blind-Kartograph', 'Zeichne mit geschlossenen Augen die Umrisse von Deutschland auf ein Blatt.', 20, 'easy', 'photo', '🗺️', 'pop', false, false, 'fixed'),
  ('c-25', 'wissen', 'Gedächtnis-Kette', 'Die Gruppe liest dir einmal eine 8-teilige Einkaufsliste vor – wiederhole sie fehlerfrei.', 35, 'medium', 'video', '📝', 'flip', false, false, 'fixed'),
  ('c-26', 'wissen', 'Schlagzeilen-Gedächtnis', 'Die Gruppe liest dir 5 aktuelle Schlagzeilen einmal vor – gib danach alle 5 sinngemäß wieder.', 60, 'hard', 'video', '📰', 'glow', false, false, 'fixed'),
  ('c-30', 'mut', 'Eiswürfel-Ritual', 'Lasse einen Eiswürfel auf deinem Nacken schmelzen ohne zu zucken.', 20, 'easy', 'video', '🧊', 'shake', false, false, 'fixed'),
  ('c-31', 'mut', 'Wasabi-Wette', 'Iss einen kleinen Klecks Wasabi ohne etwas zu trinken – 10 Sekunden durchhalten.', 55, 'hard', 'video', '🌶️', 'shake', false, false, 'fixed'),
  ('c-32', 'mut', 'Kaltes Wasser', 'Wasche dir für 15 Sekunden das Gesicht mit eiskaltem Wasser.', 30, 'medium', 'video', '💦', 'shake', false, false, 'fixed'),
  ('c-33', 'mut', 'Geheimnis-Beichte', 'Verrate der Gruppe ein harmloses, noch unbekanntes Geheimnis.', 40, 'medium', 'none', '🤫', 'glow', false, false, 'fixed'),
  ('c-34', 'mut', 'Anruf-Roulette', 'Rufe spontan einen Kontakt an und singe ihm eine Zeile eines Songs vor.', 75, 'hard', 'video', '📞', 'pulse', false, false, 'fixed'),
  ('c-35', 'mut', 'Feuer-Schlucker-Trick', 'Trinke einen extra scharfen Shot ohne Grimasse zu ziehen.', 65, 'hard', 'video', '🔥', 'shake', false, false, 'fixed'),
  ('c-40', 'team', 'Synchron-Trinker', 'Trinkt zu zweit exakt gleichzeitig und gleich schnell euer Glas leer.', 30, 'medium', 'video', '🤝', 'bounce', false, false, 'fixed'),
  ('c-41', 'team', 'Menschlicher Knoten', 'Löst zu viert einen Menschen-Knoten ohne die Hände loszulassen.', 50, 'hard', 'video', '🪢', 'shake', false, false, 'fixed'),
  ('c-42', 'team', 'Blinder Turmbau', 'Baut zu zweit mit verbundenen Augen einen Becherturm mit 5 Bechern.', 45, 'medium', 'video', '🥤', 'pop', false, false, 'fixed'),
  ('c-43', 'team', 'Gruppen-Freeze', 'Die ganze Gruppe friert für 20 Sekunden mitten in der Bewegung ein.', 25, 'easy', 'video', '🧍', 'pulse', false, false, 'fixed'),
  ('c-50', 'kreativ', 'Cocktail-Erfinder', 'Erfinde einen neuen Drink-Namen samt Story und stelle ihn der Gruppe vor.', 25, 'easy', 'video', '🍹', 'glow', false, false, 'fixed'),
  ('c-51', 'kreativ', 'Servietten-Kunstwerk', 'Erschaffe in 60 Sekunden ein Kunstwerk aus einer Serviette.', 20, 'easy', 'photo', '🎨', 'pop', false, false, 'fixed'),
  ('c-52', 'kreativ', 'Freestyle-Rap', 'Reime 4 Zeilen Freestyle über die Person rechts von dir.', 40, 'medium', 'video', '🎙️', 'bounce', false, false, 'fixed'),
  ('c-53', 'kreativ', 'Live-Portrait', 'Zeichne in 90 Sekunden ein Portrait eines Mitspielers – erkennbar oder Strafschluck.', 30, 'medium', 'photo', '🖍️', 'slide', false, false, 'fixed'),
  ('c-54', 'kreativ', 'Meme des Abends', 'Erstelle live ein Meme über den heutigen Abend.', 35, 'medium', 'photo', '📸', 'glow', false, false, 'fixed'),
  ('c-90', 'mut', 'Geburtstags-Gauntlet', 'Meistere 3 Challenges aus 3 verschiedenen Kategorien in Folge ohne Pause.', 100, 'legendary', 'video', '👑', 'glow', true, false, 'fixed'),
  ('c-91', 'klassiker', 'Lebensjahre-Shot', 'Ein Shot für jedes Lebensjahr (max. 10) – gemeinsam mit der Gruppe im Staffel-Modus.', 90, 'legendary', 'video', '🎂', 'shake', true, false, 'fixed'),
  ('c-92', 'performance', 'Geburtstags-Rede', 'Halte eine spontane, emotionale 90-Sekunden-Dankesrede an die Gruppe.', 60, 'hard', 'video', '🎉', 'glow', true, false, 'fixed'),
  ('c-93', 'team', 'Ehrengarde', 'Die Gruppe trägt das Geburtstagskind einmal durch den Raum (sicher!).', 70, 'hard', 'video', '🛡️', 'bounce', true, false, 'fixed')
on conflict (id) do nothing;

-- ======================================================================
-- Push-Benachrichtigungen für den Party-Modus
-- ======================================================================
-- Rein additiv: keine bestehende Tabelle wird verändert oder gelöscht.
-- Drei neue Tabellen + drei neue Funktionen. Der eigentliche Versand
-- passiert NICHT hier in SQL, sondern in der Edge Function
-- supabase/functions/party-push-tick (Deno) - diese Funktionen liefern
-- ihr nur an, WER wann WELCHE Challenge bekommen soll, atomar und
-- RLS-sicher. Setup-Schritte (Extensions, Edge Function deployen,
-- Secrets, Cron-Zeitplan) stehen in DEPLOY.md.

-- ---------- Push-Subscriptions (ein Browser/Gerät pro Zeile) ----------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Nutzer sehen eigene Push-Subscriptions" on push_subscriptions;
create policy "Nutzer sehen eigene Push-Subscriptions"
  on push_subscriptions for select using (auth.uid() = user_id);

drop policy if exists "Nutzer registrieren eigene Push-Subscription" on push_subscriptions;
create policy "Nutzer registrieren eigene Push-Subscription"
  on push_subscriptions for insert with check (auth.uid() = user_id);

drop policy if exists "Nutzer aktualisieren eigene Push-Subscription" on push_subscriptions;
create policy "Nutzer aktualisieren eigene Push-Subscription"
  on push_subscriptions for update using (auth.uid() = user_id);

drop policy if exists "Nutzer entfernen eigene Push-Subscription" on push_subscriptions;
create policy "Nutzer entfernen eigene Push-Subscription"
  on push_subscriptions for delete using (auth.uid() = user_id);

-- ---------- Push-Konfiguration pro Party (= Event mit type='party') ----------
create table if not exists party_push_state (
  event_id uuid primary key references events (id) on delete cascade,
  push_enabled boolean not null default false,
  interval_minutes int not null default 5 check (interval_minutes > 0),
  random_pick boolean not null default true,
  no_duplicates boolean not null default true,
  cycle int not null default 1,
  next_push_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table party_push_state enable row level security;

drop policy if exists "Mitglieder sehen Push-Zustand ihrer Events" on party_push_state;
create policy "Mitglieder sehen Push-Zustand ihrer Events"
  on party_push_state for select using (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = party_push_state.event_id and gm.user_id = auth.uid()
    )
  );

-- Bewusst KEINE direkten INSERT/UPDATE-Policies für Clients: Ändern läuft
-- ausschließlich über set_party_push_config() unten, das selbst prüft,
-- ob der Aufrufer Mitglied der passenden Gruppe ist. Ohne das könnte ein
-- Client sonst per direktem REST-Insert Push-Zustände für Events fremder
-- Gruppen anlegen/verändern.

-- ---------- Verlauf: welche Challenge wurde in welchem Zyklus verschickt ----------
create table if not exists party_push_sent (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  challenge_id text not null references challenges (id),
  cycle int not null,
  sent_at timestamptz not null default now()
);

alter table party_push_sent enable row level security;

drop policy if exists "Mitglieder sehen Push-Verlauf ihrer Events" on party_push_sent;
create policy "Mitglieder sehen Push-Verlauf ihrer Events"
  on party_push_sent for select using (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = party_push_sent.event_id and gm.user_id = auth.uid()
    )
  );

-- ---------- Push für eine Party an/aus (Security Definer) ----------
-- Einziger Weg für Clients, den Push-Zustand eines Events zu setzen.
-- Prüft selbst die Gruppenmitgliedschaft, damit niemand für ein Event
-- einer fremden Gruppe Pushs aktivieren kann.
create or replace function set_party_push_config(
  p_event_id uuid,
  p_enabled boolean,
  p_interval_minutes int default 5,
  p_random boolean default true,
  p_no_duplicates boolean default true
)
returns party_push_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state party_push_state;
  v_is_member boolean;
begin
  select exists (
    select 1 from events e
    join group_members gm on gm.group_id = e.group_id
    where e.id = p_event_id and gm.user_id = auth.uid()
  ) into v_is_member;

  if not v_is_member then
    raise exception 'not_a_member';
  end if;

  insert into party_push_state (
    event_id, push_enabled, interval_minutes, random_pick, no_duplicates, next_push_at, updated_at
  )
  values (
    p_event_id,
    p_enabled,
    greatest(1, p_interval_minutes),
    p_random,
    p_no_duplicates,
    case when p_enabled then now() else null end,
    now()
  )
  on conflict (event_id) do update set
    push_enabled = excluded.push_enabled,
    interval_minutes = excluded.interval_minutes,
    random_pick = excluded.random_pick,
    no_duplicates = excluded.no_duplicates,
    next_push_at = case
      when excluded.push_enabled and party_push_state.next_push_at is null then now()
      when not excluded.push_enabled then null
      else party_push_state.next_push_at
    end,
    updated_at = now()
  returning * into v_state;

  return v_state;
end;
$$;

revoke all on function set_party_push_config(uuid, boolean, int, boolean, boolean) from public;
grant execute on function set_party_push_config(uuid, boolean, int, boolean, boolean) to authenticated;

-- ---------- Fällige Party-Pushs atomar "claimen" (nur service_role) ----------
-- Wird jede Minute per pg_cron von der Edge Function party-push-tick
-- aufgerufen (siehe Zeitplan weiter unten). Jede Party hat ihr eigenes
-- Intervall - dieser Tick läuft öfter, filtert aber selbst, welche Party
-- WIRKLICH fällig ist. Das UPDATE ... RETURNING claimt fällige Zeilen und
-- setzt sofort den nächsten Zeitpunkt weiter, bevor irgendein Push
-- versendet wird: läuft durch einen doppelten/überlappenden Scheduler-
-- Lauf dieselbe Funktion parallel, sieht der zweite Aufruf für dieselbe
-- Party keine fällige Zeile mehr (Postgres serialisiert konkurrierende
-- UPDATEs auf dieselbe Zeile und wertet die WHERE-Bedingung danach neu
-- aus) - das verhindert doppelte Pushs zuverlässig ohne extra Locking.
create or replace function claim_due_party_pushes()
returns setof party_push_state
language sql
security definer
set search_path = public
as $$
  update party_push_state s
  set next_push_at = now() + (s.interval_minutes || ' minutes')::interval,
      updated_at = now()
  where s.push_enabled = true
    and (s.next_push_at is null or s.next_push_at <= now())
  returning s.*;
$$;

revoke all on function claim_due_party_pushes() from public;
grant execute on function claim_due_party_pushes() to service_role;

-- ---------- Nächste Challenge für einen Party-Push wählen (nur service_role) ----------
-- Wählt eine im aktuellen Zyklus noch nicht verwendete Challenge zufällig
-- (oder deterministisch, falls random_pick=false) aus, markiert sie als
-- verwendet und trägt sie zusätzlich ganz normal in event_challenges ein
-- - dadurch taucht eine automatisch verschickte Challenge auch in der
-- bestehenden "Bisher aufgedeckt"-Liste des Events auf, genau wie ein
-- manueller Würfelwurf. Sind alle Challenges eines Zyklus aufgebraucht,
-- beginnt automatisch ein neuer Zyklus (kann Challenges aus dem alten
-- Zyklus wiederverwenden, aber nie zweimal innerhalb desselben Zyklus).
create or replace function pick_next_party_push_challenge(p_event_id uuid)
returns challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state party_push_state;
  v_event events;
  v_total int;
  v_used int;
  v_challenge challenges;
  v_next_sort int;
begin
  select * into v_state from party_push_state where event_id = p_event_id;
  if not found or not v_state.push_enabled then
    return null;
  end if;

  select * into v_event from events where id = p_event_id;
  if not found then
    return null;
  end if;

  select count(*) into v_total
    from challenges c
    where v_event.type = 'birthday' or not c.is_birthday_exclusive;

  if v_total = 0 then
    return null;
  end if;

  if v_state.no_duplicates then
    select count(*) into v_used
      from party_push_sent
      where event_id = p_event_id and cycle = v_state.cycle;

    if v_used >= v_total then
      v_state.cycle := v_state.cycle + 1;
      update party_push_state set cycle = v_state.cycle where event_id = p_event_id;
    end if;
  end if;

  if v_state.random_pick then
    select c.* into v_challenge
      from challenges c
      where (v_event.type = 'birthday' or not c.is_birthday_exclusive)
        and (
          not v_state.no_duplicates
          or c.id not in (
            select challenge_id from party_push_sent
            where event_id = p_event_id and cycle = v_state.cycle
          )
        )
      order by random()
      limit 1;
  else
    select c.* into v_challenge
      from challenges c
      where (v_event.type = 'birthday' or not c.is_birthday_exclusive)
        and (
          not v_state.no_duplicates
          or c.id not in (
            select challenge_id from party_push_sent
            where event_id = p_event_id and cycle = v_state.cycle
          )
        )
      order by c.id
      limit 1;
  end if;

  if v_challenge.id is null then
    return null;
  end if;

  insert into party_push_sent (event_id, challenge_id, cycle)
  values (p_event_id, v_challenge.id, v_state.cycle);

  select coalesce(max(sort_order), 0) + 1 into v_next_sort
    from event_challenges where event_id = p_event_id;

  insert into event_challenges (event_id, challenge_id, sort_order)
  values (p_event_id, v_challenge.id, v_next_sort)
  on conflict (event_id, challenge_id) do nothing;

  return v_challenge;
end;
$$;

revoke all on function pick_next_party_push_challenge(uuid) from public;
grant execute on function pick_next_party_push_challenge(uuid) to service_role;

-- ==================== Party-Bingo (Party-Modus) ====================
-- Eigenständiges Feature neben den Push-Challenges. Hängt wie diese am
-- "events"-Anker (party_bingo.event_id -> events.id). Kernidee: Ereignisse
-- sind IMMER global pro Bingo-Runde (Variante B aus der Anfrage) - meldet
-- jemand "ist passiert", prüft eine Funktion die Bestätigungsschwelle und
-- markiert das Feld danach bei JEDER Karte gleichzeitig, nie pro Spieler
-- einzeln. Absichtlich KEINE eigene "erledigt"-Spalte auf den Zellen: der
-- Status wird immer live aus party_bingo_events.is_triggered abgeleitet,
-- damit es nie zwei Wahrheiten geben kann, die auseinanderlaufen könnten.

-- ---------- Globaler Ereignis-Katalog ----------
create table if not exists bingo_event_catalog (
  id text primary key,
  text text not null,
  icon text not null default '🎉',
  created_at timestamptz not null default now()
);

alter table bingo_event_catalog enable row level security;

drop policy if exists "Bingo-Ereigniskatalog ist öffentlich lesbar" on bingo_event_catalog;
create policy "Bingo-Ereigniskatalog ist öffentlich lesbar"
  on bingo_event_catalog for select using (true);

insert into bingo_event_catalog (id, text, icon) values
  ('spilled-drink', 'Jemand verschüttet sein Getränk', '🍺'),
  ('group-photo', 'Ein Gruppenfoto wird gemacht', '📸'),
  ('im-tired', 'Jemand sagt "Ich bin müde"', '😴'),
  ('hug', 'Zwei Leute umarmen sich', '🤗'),
  ('sings-along', 'Jemand singt lautstark mit', '🎤'),
  ('embarrassing-story', 'Jemand erzählt eine peinliche Geschichte', '🙈'),
  ('lost-phone', 'Jemand sucht sein Handy', '📱'),
  ('late-arrival', 'Jemand kommt spät an', '⏰'),
  ('everyone-laughs', 'Alle lachen gleichzeitig', '😂'),
  ('orders-food', 'Jemand bestellt Essen', '🍕'),
  ('dance-move', 'Jemand zeigt einen besonderen Tanzmove', '💃'),
  ('selfie', 'Ein Selfie wird gemacht', '🤳'),
  ('toast', 'Es wird angestoßen', '🥂'),
  ('lost-item', 'Jemand verlegt etwas (Schlüssel, Jacke...)', '🧥'),
  ('new-friend', 'Jemand lernt eine neue Person kennen', '🤝'),
  ('spicy-comment', 'Ein frecher Kommentar fällt', '😏'),
  ('music-change', 'Die Musik wird gewechselt', '🎶'),
  ('photo-fail', 'Ein Foto wird zum Fail', '📷'),
  ('compliment', 'Jemand bekommt ein Kompliment', '😊'),
  ('drink-refill', 'Ein Getränk wird nachgefüllt', '🍹'),
  ('backs-out', 'Jemand traut sich etwas nicht', '😬'),
  ('loud-laugh', 'Jemand lacht besonders laut', '🤣'),
  ('group-chant', 'Alle rufen etwas gemeinsam', '📣'),
  ('asks-when-leave', 'Jemand fragt "Wann gehen wir?"', '🚪'),
  ('weather-comment', 'Jemand redet über das Wetter', '☔'),
  ('story-repeat', 'Jemand erzählt eine Geschichte doppelt', '🔁'),
  ('shoes-off', 'Jemand zieht die Schuhe aus', '👟'),
  ('phone-call', 'Jemand nimmt mitten in der Party einen Anruf an', '📞'),
  ('outfit-compliment', 'Jemand bekommt Komplimente fürs Outfit', '👗'),
  ('midnight', 'Es wird Mitternacht', '🕛')
on conflict (id) do nothing;

-- ---------- Bingo-Runde, Karten, Zellen, Meldungen ----------
create table if not exists party_bingo (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade unique,
  status text not null default 'active' check (status in ('active', 'finished')),
  grid_size int not null default 5 check (grid_size between 3 and 7),
  free_center boolean not null default true,
  win_condition text not null default 'one_line' check (win_condition in ('one_line', 'two_lines', 'full_card')),
  require_confirmations int not null default 1 check (require_confirmations >= 1),
  winner_user_id uuid references profiles (id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Kopie des Katalogs PRO Bingo-Runde (nicht der globale Katalog direkt) -
-- so bleibt "getriggert" pro Party isoliert, und zwei gleichzeitig
-- laufende Partys teilen sich nie denselben Ereignis-Status.
create table if not exists party_bingo_events (
  id uuid primary key default gen_random_uuid(),
  bingo_id uuid not null references party_bingo (id) on delete cascade,
  event_text text not null,
  icon text not null default '🎉',
  is_triggered boolean not null default false,
  triggered_by uuid references profiles (id),
  triggered_at timestamptz
);

create table if not exists party_bingo_cards (
  id uuid primary key default gen_random_uuid(),
  bingo_id uuid not null references party_bingo (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bingo_id, user_id)
);

create table if not exists party_bingo_cells (
  id uuid primary key default gen_random_uuid(),
  -- Denormalisiert (statt nur über card_id ableitbar): vereinfacht sowohl
  -- die RLS-Policy als auch Abfragen wie "Fortschritt aller Spieler nach
  -- Spielende", ohne einen zusätzlichen Join über die Karten-Tabelle.
  bingo_id uuid not null references party_bingo (id) on delete cascade,
  card_id uuid not null references party_bingo_cards (id) on delete cascade,
  bingo_event_id uuid references party_bingo_events (id) on delete cascade,
  position int not null,
  is_free boolean not null default false,
  unique (card_id, position)
);

-- Vereint "Variante A" (einzelne Meldung reicht) und "Variante B"
-- (mehrere Bestätigungen nötig) aus der Anfrage über einen einzigen
-- Schwellenwert (party_bingo.require_confirmations): 1 = sofort wirksam,
-- >1 = braucht mehrere Meldungen. Das Markieren selbst ist in JEDEM Fall
-- global pro Party, nie pro einzelner Karte.
create table if not exists party_bingo_reports (
  id uuid primary key default gen_random_uuid(),
  bingo_event_id uuid not null references party_bingo_events (id) on delete cascade,
  reporter_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bingo_event_id, reporter_id)
);

alter table party_bingo enable row level security;
alter table party_bingo_events enable row level security;
alter table party_bingo_cards enable row level security;
alter table party_bingo_cells enable row level security;
alter table party_bingo_reports enable row level security;

-- Nur SELECT-Policies für Clients - jede schreibende Aktion (Runde
-- starten, Karte anlegen, Ereignis melden, Runde beenden) läuft
-- ausschließlich über die Security-Definer-Funktionen weiter unten. Das
-- ist der entscheidende Baustein gegen "ein Client setzt einfach
-- winner = current_user": es gibt gar keine UPDATE-Policy, die das
-- zuließe.
drop policy if exists "Mitglieder sehen Bingo-Status ihrer Events" on party_bingo;
create policy "Mitglieder sehen Bingo-Status ihrer Events"
  on party_bingo for select using (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = party_bingo.event_id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Mitglieder sehen Bingo-Ereignisse ihrer Events" on party_bingo_events;
create policy "Mitglieder sehen Bingo-Ereignisse ihrer Events"
  on party_bingo_events for select using (
    exists (
      select 1 from party_bingo pb
      join events e on e.id = pb.event_id
      join group_members gm on gm.group_id = e.group_id
      where pb.id = party_bingo_events.bingo_id and gm.user_id = auth.uid()
    )
  );

-- Eigene Karte jederzeit sichtbar; fremde Karten NUR nach Spielende (und
-- weiterhin nur für Mitglieder derselben Gruppe) - so bleibt während der
-- aktiven Runde verborgen, wer schon wie viele Felder hat, rein über RLS,
-- ohne zusätzliche Anwendungslogik.
drop policy if exists "Eigene oder nach Abschluss alle Bingo-Karten sichtbar" on party_bingo_cards;
create policy "Eigene oder nach Abschluss alle Bingo-Karten sichtbar"
  on party_bingo_cards for select using (
    auth.uid() = user_id
    or exists (
      select 1 from party_bingo pb
      join events e on e.id = pb.event_id
      join group_members gm on gm.group_id = e.group_id
      where pb.id = party_bingo_cards.bingo_id and pb.status = 'finished' and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Eigene oder nach Abschluss alle Bingo-Zellen sichtbar" on party_bingo_cells;
create policy "Eigene oder nach Abschluss alle Bingo-Zellen sichtbar"
  on party_bingo_cells for select using (
    exists (
      select 1 from party_bingo_cards c
      where c.id = party_bingo_cells.card_id and c.user_id = auth.uid()
    )
    or exists (
      select 1 from party_bingo pb
      join events e on e.id = pb.event_id
      join group_members gm on gm.group_id = e.group_id
      where pb.id = party_bingo_cells.bingo_id and pb.status = 'finished' and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Mitglieder sehen Bingo-Meldungen ihrer Events" on party_bingo_reports;
create policy "Mitglieder sehen Bingo-Meldungen ihrer Events"
  on party_bingo_reports for select using (
    exists (
      select 1 from party_bingo_events pbe
      join party_bingo pb on pb.id = pbe.bingo_id
      join events e on e.id = pb.event_id
      join group_members gm on gm.group_id = e.group_id
      where pbe.id = party_bingo_reports.bingo_event_id and gm.user_id = auth.uid()
    )
  );

-- ---------- Karte für einen Nutzer anlegen (intern, Security Definer) ----------
-- BEWUSST kein "grant execute ... to authenticated" - diese Funktion ist
-- nur als interner Helfer gedacht, aufgerufen aus start_party_bingo() und
-- get_my_bingo_card(). Ein SECURITY DEFINER-Aufruf läuft mit den Rechten
-- des Funktions-EIGENTÜMERS weiter, auch für verschachtelte Aufrufe -
-- ein normaler Client kann diese Funktion deshalb nicht direkt erreichen
-- (weder anon noch authenticated haben EXECUTE), wohl aber die beiden
-- Wrapper-Funktionen, die selbst schon Mitgliedschaft/Auth geprüft haben.
create or replace function create_bingo_card_for_user(p_bingo_id uuid, p_user_id uuid)
returns party_bingo_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card party_bingo_cards;
  v_bingo party_bingo;
  v_total_cells int;
  v_needed int;
  v_pool_size int;
  v_center int;
  v_pos int := 0;
  v_event record;
begin
  select * into v_card from party_bingo_cards where bingo_id = p_bingo_id and user_id = p_user_id;
  if found then
    return v_card;
  end if;

  select * into v_bingo from party_bingo where id = p_bingo_id;
  if not found then
    raise exception 'bingo_not_found';
  end if;

  v_total_cells := v_bingo.grid_size * v_bingo.grid_size;
  v_needed := v_total_cells - (case when v_bingo.free_center then 1 else 0 end);

  select count(*) into v_pool_size from party_bingo_events where bingo_id = p_bingo_id;
  if v_pool_size < v_needed then
    raise exception 'not_enough_bingo_events';
  end if;

  insert into party_bingo_cards (bingo_id, user_id)
  values (p_bingo_id, p_user_id)
  returning * into v_card;

  -- Ganzzahlige Division, z.B. 5x5 (25 Felder) -> Mitte bei Index 12.
  v_center := v_total_cells / 2;

  -- Zieht v_needed EINDEUTIGE Ereignisse zufällig aus dem Pool dieser
  -- Bingo-Runde und verteilt sie nacheinander auf alle Positionen außer
  -- der Mitte (falls free_center) - dadurch bekommt garantiert jeder
  -- Spieler eine andere Zusammenstellung/Reihenfolge.
  for v_event in
    select id from party_bingo_events where bingo_id = p_bingo_id order by random() limit v_needed
  loop
    if v_bingo.free_center and v_pos = v_center then
      insert into party_bingo_cells (bingo_id, card_id, bingo_event_id, position, is_free)
      values (p_bingo_id, v_card.id, null, v_pos, true);
      v_pos := v_pos + 1;
    end if;
    insert into party_bingo_cells (bingo_id, card_id, bingo_event_id, position, is_free)
    values (p_bingo_id, v_card.id, v_event.id, v_pos, false);
    v_pos := v_pos + 1;
  end loop;

  return v_card;
end;
$$;

revoke all on function create_bingo_card_for_user(uuid, uuid) from public;

-- ---------- Bingo-Runde starten (Security Definer) ----------
create or replace function start_party_bingo(
  p_event_id uuid,
  p_grid_size int default 5,
  p_free_center boolean default true,
  p_win_condition text default 'one_line',
  p_require_confirmations int default 1
)
returns party_bingo
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bingo party_bingo;
  v_group_id uuid;
  v_member record;
begin
  select group_id into v_group_id from events where id = p_event_id;
  if v_group_id is null then
    raise exception 'event_not_found';
  end if;

  if not exists (select 1 from group_members where group_id = v_group_id and user_id = auth.uid()) then
    raise exception 'not_a_member';
  end if;

  -- Idempotent: läuft für dieses Event schon eine Runde, wird die
  -- bestehende zurückgegeben statt eine zweite anzulegen (z.B. wenn zwei
  -- Mitspieler fast gleichzeitig auf "Bingo starten" tippen).
  select * into v_bingo from party_bingo where event_id = p_event_id;
  if found then
    return v_bingo;
  end if;

  if p_grid_size < 3 or p_grid_size > 7 then
    raise exception 'invalid_grid_size';
  end if;
  if p_win_condition not in ('one_line', 'two_lines', 'full_card') then
    raise exception 'invalid_win_condition';
  end if;

  insert into party_bingo (event_id, grid_size, free_center, win_condition, require_confirmations)
  values (p_event_id, p_grid_size, p_free_center, p_win_condition, greatest(p_require_confirmations, 1))
  returning * into v_bingo;

  insert into party_bingo_events (bingo_id, event_text, icon)
  select v_bingo.id, text, icon from bingo_event_catalog;

  for v_member in select user_id from group_members where group_id = v_group_id loop
    perform create_bingo_card_for_user(v_bingo.id, v_member.user_id);
  end loop;

  return v_bingo;
end;
$$;

revoke all on function start_party_bingo(uuid, int, boolean, text, int) from public;
grant execute on function start_party_bingo(uuid, int, boolean, text, int) to authenticated;

-- ---------- Eigene Karte holen/anlegen (Security Definer) ----------
-- Einziger client-erreichbarer Weg an eine Karte zu kommen - immer nur an
-- die EIGENE (auth.uid()), ein Client kann hier nie eine fremde user_id
-- übergeben, weil sie gar kein Parameter dieser Funktion ist.
create or replace function get_my_bingo_card(p_bingo_id uuid)
returns party_bingo_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select e.group_id into v_group_id
  from party_bingo pb join events e on e.id = pb.event_id
  where pb.id = p_bingo_id;

  if v_group_id is null then
    raise exception 'bingo_not_found';
  end if;

  if not exists (select 1 from group_members where group_id = v_group_id and user_id = auth.uid()) then
    raise exception 'not_a_member';
  end if;

  return create_bingo_card_for_user(p_bingo_id, auth.uid());
end;
$$;

revoke all on function get_my_bingo_card(uuid) from public;
grant execute on function get_my_bingo_card(uuid) to authenticated;

-- ---------- Interner Helfer: Reihen/Spalten/Diagonalen einer Karte zählen ----------
-- Nicht client-erreichbar (kein grant), nur von report_bingo_event()
-- genutzt. Baut sich pro Aufruf ein boolesches Array "ist diese Zelle
-- erledigt" (frei ODER zugehöriges Ereignis getriggert) und zählt dann
-- vollständige Reihen/Spalten/Diagonalen sowie die Gesamtzahl - Grundlage
-- für JEDE der drei Gewinnbedingungen (one_line/two_lines/full_card).
create or replace function bingo_card_completed_line_count(
  p_card_id uuid,
  out line_count int,
  out total_completed int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grid_size int;
  v_total_cells int;
  v_completed boolean[];
  v_pos int;
  v_row int;
  v_col int;
  v_row_ok boolean;
  v_col_ok boolean;
  v_diag1_ok boolean := true;
  v_diag2_ok boolean := true;
  v_rec record;
begin
  select b.grid_size into v_grid_size
  from party_bingo_cards c join party_bingo b on b.id = c.bingo_id
  where c.id = p_card_id;

  if v_grid_size is null then
    raise exception 'card_not_found';
  end if;

  v_total_cells := v_grid_size * v_grid_size;
  v_completed := array_fill(false, array[v_total_cells]);

  for v_rec in
    select pc.position as cell_position, (pc.is_free or coalesce(pbe.is_triggered, false)) as done
    from party_bingo_cells pc
    left join party_bingo_events pbe on pbe.id = pc.bingo_event_id
    where pc.card_id = p_card_id
  loop
    -- Postgres-Arrays sind 1-indiziert, unsere Positionen 0-indiziert.
    v_completed[v_rec.cell_position + 1] := v_rec.done;
  end loop;

  total_completed := 0;
  for v_pos in 0 .. v_total_cells - 1 loop
    if v_completed[v_pos + 1] then
      total_completed := total_completed + 1;
    end if;
  end loop;

  line_count := 0;

  for v_row in 0 .. v_grid_size - 1 loop
    v_row_ok := true;
    for v_col in 0 .. v_grid_size - 1 loop
      if not v_completed[(v_row * v_grid_size + v_col) + 1] then
        v_row_ok := false;
      end if;
    end loop;
    if v_row_ok then
      line_count := line_count + 1;
    end if;
  end loop;

  for v_col in 0 .. v_grid_size - 1 loop
    v_col_ok := true;
    for v_row in 0 .. v_grid_size - 1 loop
      if not v_completed[(v_row * v_grid_size + v_col) + 1] then
        v_col_ok := false;
      end if;
    end loop;
    if v_col_ok then
      line_count := line_count + 1;
    end if;
  end loop;

  for v_row in 0 .. v_grid_size - 1 loop
    if not v_completed[(v_row * v_grid_size + v_row) + 1] then
      v_diag1_ok := false;
    end if;
    if not v_completed[(v_row * v_grid_size + (v_grid_size - 1 - v_row)) + 1] then
      v_diag2_ok := false;
    end if;
  end loop;
  if v_diag1_ok then
    line_count := line_count + 1;
  end if;
  if v_diag2_ok then
    line_count := line_count + 1;
  end if;
end;
$$;

revoke all on function bingo_card_completed_line_count(uuid) from public;

-- ---------- Ereignis melden/bestätigen + Gewinner ermitteln (Security Definer) ----------
-- Das Herzstück gegen Cheating: der Client kann hier nur "melde dieses
-- Ereignis" sagen, niemals selbst einen Gewinner setzen. Die Zeile der
-- Bingo-Runde wird per FOR UPDATE gelockt, solange die Funktion läuft -
-- melden zwei Geräte fast gleichzeitig unterschiedliche Ereignisse, laufen
-- die Gewinner-Checks dadurch serialisiert statt parallel, was verhindert,
-- dass zwei Aufrufe gleichzeitig "gewonnen" feststellen.
create or replace function report_bingo_event(p_bingo_event_id uuid)
returns party_bingo_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event party_bingo_events;
  v_bingo party_bingo;
  v_group_id uuid;
  v_confirmations int;
  v_card record;
  v_line_count int;
  v_total_completed int;
begin
  select * into v_event from party_bingo_events where id = p_bingo_event_id;
  if not found then
    raise exception 'bingo_event_not_found';
  end if;

  select * into v_bingo from party_bingo where id = v_event.bingo_id for update;
  if not found then
    raise exception 'bingo_not_found';
  end if;

  select group_id into v_group_id from events where id = v_bingo.event_id;
  if not exists (select 1 from group_members where group_id = v_group_id and user_id = auth.uid()) then
    raise exception 'not_a_member';
  end if;

  if v_bingo.status <> 'active' or v_event.is_triggered then
    return v_event;
  end if;

  insert into party_bingo_reports (bingo_event_id, reporter_id)
  values (p_bingo_event_id, auth.uid())
  on conflict (bingo_event_id, reporter_id) do nothing;

  select count(*) into v_confirmations from party_bingo_reports where bingo_event_id = p_bingo_event_id;
  if v_confirmations < v_bingo.require_confirmations then
    return v_event;
  end if;

  update party_bingo_events
  set is_triggered = true, triggered_by = auth.uid(), triggered_at = now()
  where id = p_bingo_event_id
  returning * into v_event;

  if v_bingo.winner_user_id is null then
    for v_card in
      select id, user_id from party_bingo_cards where bingo_id = v_bingo.id order by created_at asc
    loop
      select line_count, total_completed into v_line_count, v_total_completed
      from bingo_card_completed_line_count(v_card.id);

      if (v_bingo.win_condition = 'one_line' and v_line_count >= 1)
        or (v_bingo.win_condition = 'two_lines' and v_line_count >= 2)
        or (v_bingo.win_condition = 'full_card' and v_total_completed = v_bingo.grid_size * v_bingo.grid_size)
      then
        update party_bingo
        set winner_user_id = v_card.user_id, status = 'finished', finished_at = now()
        where id = v_bingo.id and winner_user_id is null;
        exit;
      end if;
    end loop;
  end if;

  return v_event;
end;
$$;

revoke all on function report_bingo_event(uuid) from public;
grant execute on function report_bingo_event(uuid) to authenticated;

-- ---------- Bingo-Runde beenden (Security Definer) ----------
-- Eigenständige "Bingo beenden"-Aktion statt eines allgemeinen "Event
-- beenden"-Features (das es sonst nirgends in der App gibt) - lässt
-- bewusst auch "beendet, aber ohne Gewinner" zu (z.B. wenn die Party
-- vorbei ist, ohne dass jemand eine Reihe vollhatte).
create or replace function finish_party_bingo(p_bingo_id uuid)
returns party_bingo
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bingo party_bingo;
  v_group_id uuid;
begin
  select * into v_bingo from party_bingo where id = p_bingo_id for update;
  if not found then
    raise exception 'bingo_not_found';
  end if;

  select group_id into v_group_id from events where id = v_bingo.event_id;
  if not exists (select 1 from group_members where group_id = v_group_id and user_id = auth.uid()) then
    raise exception 'not_a_member';
  end if;

  if v_bingo.status = 'active' then
    update party_bingo
    set status = 'finished', finished_at = now()
    where id = p_bingo_id
    returning * into v_bingo;
  end if;

  return v_bingo;
end;
$$;

revoke all on function finish_party_bingo(uuid) from public;
grant execute on function finish_party_bingo(uuid) to authenticated;

-- ==================== Realtime ====================
-- Supabase legt pro Projekt eine Publikation "supabase_realtime" an, über
-- die postgres_changes-Events laufen - Tabellen sind darin aber NICHT
-- automatisch enthalten, das muss man entweder im Dashboard (Table
-- Editor -> Tabelle -> "Enable Realtime") oder per SQL einschalten. Ohne
-- das hier landen weder App-eigene subscribeTo...()-Aufrufe noch die im
-- Dashboard zugeschalteten Toggles irgendwelche Events beim Client - "die
-- App synchronisiert nicht live" ist ohne diesen Block der wahrscheinlichste
-- Grund. Der DO-Block prüft vorher, ob die Tabelle schon drin ist, damit
-- dieses Skript weiterhin beliebig oft wiederholbar bleibt (ein "alter
-- publication ... add table" auf eine schon enthaltene Tabelle würde sonst
-- mit einem Fehler abbrechen).
do $$
declare
  v_table text;
begin
  -- Publikation existiert nicht (z.B. ein lokaler Test-Postgres ohne
  -- Supabase-Bootstrap) -> nichts zu tun, kein Fehler.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach v_table in array array['group_members', 'groups', 'submissions', 'votes', 'party_bingo', 'party_bingo_events']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table %I', v_table);
    end if;
  end loop;
end $$;

-- ---------- Scheduler: pg_cron ruft die Edge Function jede Minute auf ----------
-- EINMALIG nach dem Deployen der Edge Function auszuführen (siehe
-- DEPLOY.md). <project-ref> und <service-role-key> durch die echten
-- Werte deines Projekts ersetzen - deshalb bewusst NICHT automatisch in
-- diesem Skript ausgeführt (dieses Skript kennt beide Werte nicht und
-- ist außerdem gefahrlos wiederholt ausführbar, ein "scharfer" Cron-Job
-- mit Platzhaltern würde das kaputt machen).
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'party-push-tick',
--   '* * * * *', -- jede Minute; jede Party respektiert ihr eigenes Intervall
--   $cron$
--   select net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/party-push-tick',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <service-role-key>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $cron$
-- );
--
-- Zum Deaktivieren: select cron.unschedule('party-push-tick');

