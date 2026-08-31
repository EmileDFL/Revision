-- Migration : lien optionnel devoir -> chapitre + date de complétion.
-- Permet à un devoir lié à un chapitre de "créditer" (réduire) les séances
-- d'exercices que l'algo proposerait sinon pour ce même chapitre.
-- À coller dans Supabase : SQL Editor -> Run.

alter table homework add column if not exists chapter_id uuid references chapters(id) on delete set null;
alter table homework add column if not exists done_at date;
