-- Migration : devoirs à faire (DM/exercices/exposés) + reprise de contrôle
-- manuelle sur le plan d'un jour précis ("manual" = tâche ajoutée à la
-- main, "dismissed" = tâche proposée écartée pour ce jour-là).
-- À coller dans Supabase : SQL Editor -> Run.

create table if not exists homework (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  due_date date not null,
  estimated_minutes integer not null default 30,
  done boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table homework enable row level security;
drop policy if exists "own rows" on homework;
create policy "own rows" on homework for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists plan_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete cascade,
  homework_id uuid references homework(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('memorisation', 'exercice', 'devoir', 'generic')),
  type text not null check (type in ('manual', 'dismissed')),
  minutes integer,
  created_at timestamptz not null default now(),
  constraint plan_overrides_one_ref check (
    (chapter_id is not null and homework_id is null) or
    (chapter_id is null and homework_id is not null)
  )
);

alter table plan_overrides enable row level security;

drop policy if exists "own rows" on plan_overrides;
create policy "own rows" on plan_overrides for all using (user_id = auth.uid()) with check (user_id = auth.uid());
