-- Migration : où en est le cours en classe pour un chapitre (indépendant de
-- la maîtrise personnelle). Nullable : tant que rien n'est choisi, aucune
-- tâche liée au cours n'est générée pour ce chapitre.
-- À coller dans Supabase : SQL Editor -> Run. Sans danger à rejouer.

alter table chapters
  add column if not exists course_stage text
    check (course_stage in ('a_venir', 'en_cours', 'termine'));
