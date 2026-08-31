-- Migration : coefficient au bac par matière (départage fin des priorités).
-- À coller dans Supabase : SQL Editor -> Run. Sans danger à rejouer.

alter table subjects
  add column if not exists coefficient integer not null default 1 check (coefficient >= 1);
