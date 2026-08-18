-- Salut! – Supabase Schema
-- Führe dieses Skript im SQL-Editor deines Supabase-Projekts aus, um die
-- App von "lokalem Demo-Modus" auf echtes Multi-Device-Backend umzustellen.
-- Danach NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (und für
-- den Cron-Job SUPABASE_SERVICE_ROLE_KEY) als Vercel Env Vars setzen.

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

create policy "Profiles sind für angemeldete Nutzer lesbar"
  on profiles for select using (auth.role() = 'authenticated');

create policy "Nutzer können ihr eigenes Profil bearbeiten"
  on profiles for update using (auth.uid() = id);

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

create policy "Mitglieder sehen ihre Gruppen"
  on groups for select using (
    exists (select 1 from group_members gm where gm.group_id = id and gm.user_id = auth.uid())
  );

create policy "Nutzer können Gruppen erstellen"
  on groups for insert with check (auth.uid() = owner_id);

create policy "Mitgliedschaften sind für Gruppenmitglieder sichtbar"
  on group_members for select using (
    exists (select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())
  );

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

create policy "Kategorien sind öffentlich lesbar" on categories for select using (true);
create policy "Challenges sind öffentlich lesbar" on challenges for select using (true);
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

alter table events enable row level security;
alter table event_challenges enable row level security;

create policy "Mitglieder sehen Events ihrer Gruppe"
  on events for select using (
    exists (select 1 from group_members gm where gm.group_id = events.group_id and gm.user_id = auth.uid())
  );

create policy "Mitglieder können Events erstellen"
  on events for insert with check (
    exists (select 1 from group_members gm where gm.group_id = events.group_id and gm.user_id = auth.uid())
  );

create policy "Mitglieder sehen Event-Challenges"
  on event_challenges for select using (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = event_challenges.event_id and gm.user_id = auth.uid()
    )
  );

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

create policy "Mitglieder sehen Submissions ihrer Gruppe"
  on submissions for select using (
    exists (
      select 1 from events e
      join group_members gm on gm.group_id = e.group_id
      where e.id = submissions.event_id and gm.user_id = auth.uid()
    )
  );

create policy "Nutzer können eigene Submissions anlegen"
  on submissions for insert with check (auth.uid() = user_id);

create policy "Mitglieder sehen Votes ihrer Gruppe"
  on votes for select using (
    exists (
      select 1 from submissions s
      join events e on e.id = s.event_id
      join group_members gm on gm.group_id = e.group_id
      where s.id = votes.submission_id and gm.user_id = auth.uid()
    )
  );

create policy "Mitglieder können abstimmen"
  on votes for insert with check (auth.uid() = voter_id);

-- ---------- Storage Bucket für Beweisfotos/-videos ----------
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

create policy "Beweise sind öffentlich lesbar"
  on storage.objects for select using (bucket_id = 'proofs');

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

  insert into votes (submission_id, voter_id, approve)
  values (p_submission_id, auth.uid(), p_approve)
  on conflict (submission_id, voter_id) do update set approve = excluded.approve;

  select e.group_id into v_group_id from events e where e.id = v_submission.event_id;
  select count(*) into v_total_voters
    from group_members
    where group_id = v_group_id and user_id <> v_submission.user_id;
  v_quorum := greatest(1, ceil(v_total_voters / 2.0));

  select
    count(*) filter (where approve),
    count(*) filter (where not approve)
    into v_approvals, v_rejections
    from votes where submission_id = p_submission_id;

  if v_approvals >= v_quorum then
    select points into v_points from challenges where id = v_submission.challenge_id;
    update submissions set status = 'approved', points_awarded = coalesce(v_points, 0)
      where id = p_submission_id returning * into v_submission;
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

