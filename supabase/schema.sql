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
create or replace view group_rankings as
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
