-- Migration : mode de travail par chapitre (mémorisation / exercice / mixte),
-- historique de révision typé, et emploi du temps.
-- À coller dans Supabase : Dashboard -> SQL Editor -> New query -> Run.
-- Sans danger à rejouer plusieurs fois (IF NOT EXISTS partout).

alter table chapters
  add column if not exists work_mode text not null default 'mixte'
    check (work_mode in ('memorisation', 'exercice', 'mixte'));

alter table chapters
  add column if not exists memo_start_date date;

alter table study_log
  add column if not exists kind text not null default 'generic'
    check (kind in ('memorisation', 'exercice', 'generic'));

alter table study_log
  add column if not exists milestone_index integer;

create table if not exists timetable_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  week_type text not null default 'toutes' check (week_type in ('A', 'B', 'toutes')),
  created_at timestamptz not null default now()
);

alter table timetable_slots enable row level security;

drop policy if exists "own rows" on timetable_slots;
create policy "own rows" on timetable_slots for all using (user_id = auth.uid()) with check (user_id = auth.uid());
