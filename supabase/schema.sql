-- Schéma pour l'appli "Révisions Terminale".
-- À coller dans Supabase : Dashboard -> SQL Editor -> New query -> Run.

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#4338ca',
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  order_index integer not null default 0,
  status text not null default 'a_faire' check (status in ('a_faire', 'en_cours', 'maitrise', 'faible')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  date date not null,
  type text not null default 'devoir' check (type in ('devoir', 'controle', 'bac_blanc', 'oral', 'autre')),
  created_at timestamptz not null default now()
);

create table if not exists deadline_chapters (
  deadline_id uuid not null references deadlines(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (deadline_id, chapter_id)
);

create table if not exists availability (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  minutes integer not null default 0,
  primary key (user_id, date)
);

create table if not exists study_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  date date not null,
  minutes_spent integer not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
);

alter table subjects enable row level security;
alter table chapters enable row level security;
alter table deadlines enable row level security;
alter table deadline_chapters enable row level security;
alter table availability enable row level security;
alter table study_log enable row level security;
alter table user_settings enable row level security;

create policy "own rows" on subjects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on chapters for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on deadlines for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on deadline_chapters for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on availability for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on study_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
