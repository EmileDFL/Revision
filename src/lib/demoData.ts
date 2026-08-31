import { addDays } from './scheduler'
import { newId, todayIso } from './id'
import type { Chapter, Deadline, StudyLogEntry, Subject, TimetableSlot } from './types'

export interface DemoBundle {
  subjects: Subject[]
  chapters: Chapter[]
  deadlines: Deadline[]
  timetable: TimetableSlot[]
  studyLog: StudyLogEntry[]
}

/**
 * Realistic sample data for exploring the app: a few subjects, chapters in
 * different statuses/modes, upcoming evals, a weekly timetable, and some
 * past study-log entries so the mémorisation cycle isn't always at J0.
 * Local-only helper — never touches Supabase.
 */
export function buildDemoBundle(): DemoBundle {
  const today = todayIso()

  const maths: Subject = { id: newId(), name: 'Mathématiques', color: '#4338ca', coefficient: 16 }
  const histoire: Subject = { id: newId(), name: 'Histoire-Géographie', color: '#0891b2', coefficient: 3 }
  const anglais: Subject = { id: newId(), name: 'Anglais', color: '#d97706', coefficient: 3 }
  const subjects = [maths, histoire, anglais]

  const suites: Chapter = {
    id: newId(),
    subjectId: maths.id,
    title: 'Suites numériques',
    orderIndex: 0,
    status: 'maitrise',
    notes: '',
    workMode: 'memorisation',
    memoStartDate: addDays(today, -20),
    courseStage: 'termine',
  }
  const exponentielle: Chapter = {
    id: newId(),
    subjectId: maths.id,
    title: 'Fonction exponentielle',
    orderIndex: 1,
    status: 'en_cours',
    notes: '',
    workMode: 'mixte',
    memoStartDate: addDays(today, -5),
    courseStage: 'en_cours',
  }
  const probas: Chapter = {
    id: newId(),
    subjectId: maths.id,
    title: 'Probabilités conditionnelles',
    orderIndex: 2,
    status: 'faible',
    notes: '',
    workMode: 'exercice',
    memoStartDate: null,
    // Cours déjà terminé en classe, mais le DS dans 4 jours porte dessus :
    // seul le rappel "avant éval" doit apparaître, pas "après/avant cours".
    courseStage: 'termine',
  }
  const guerreFroide: Chapter = {
    id: newId(),
    subjectId: histoire.id,
    title: 'La guerre froide',
    orderIndex: 0,
    status: 'en_cours',
    notes: '',
    workMode: 'memorisation',
    memoStartDate: addDays(today, -10),
    courseStage: 'en_cours',
  }
  const mondialisation: Chapter = {
    id: newId(),
    subjectId: histoire.id,
    title: 'La mondialisation',
    orderIndex: 1,
    status: 'a_faire',
    notes: '',
    workMode: 'mixte',
    memoStartDate: null,
    courseStage: 'a_venir',
  }
  const preteritPresentPerfect: Chapter = {
    id: newId(),
    subjectId: anglais.id,
    title: 'Prétérit vs Present Perfect',
    orderIndex: 0,
    status: 'en_cours',
    notes: '',
    workMode: 'exercice',
    memoStartDate: null,
    courseStage: 'en_cours',
  }
  const vocabEnvironnement: Chapter = {
    id: newId(),
    subjectId: anglais.id,
    title: 'Vocabulaire — Environnement',
    orderIndex: 1,
    status: 'faible',
    notes: '',
    workMode: 'memorisation',
    memoStartDate: addDays(today, -2),
    courseStage: 'termine',
  }

  const chapters = [
    suites,
    exponentielle,
    probas,
    guerreFroide,
    mondialisation,
    preteritPresentPerfect,
    vocabEnvironnement,
  ]

  const deadlines: Deadline[] = [
    {
      id: newId(),
      subjectId: maths.id,
      title: 'DS Fonctions',
      date: addDays(today, 4),
      type: 'devoir',
      chapterIds: [exponentielle.id, probas.id],
    },
    {
      id: newId(),
      subjectId: histoire.id,
      title: 'Interro Guerre froide',
      date: addDays(today, 2),
      type: 'controle',
      chapterIds: [guerreFroide.id],
    },
    {
      id: newId(),
      subjectId: anglais.id,
      title: 'Bac blanc Anglais',
      date: addDays(today, 9),
      type: 'bac_blanc',
      chapterIds: [preteritPresentPerfect.id, vocabEnvironnement.id],
    },
  ]

  const timetable: TimetableSlot[] = [
    { id: newId(), subjectId: maths.id, dayOfWeek: 1, weekType: 'toutes' },
    { id: newId(), subjectId: maths.id, dayOfWeek: 4, weekType: 'toutes' },
    { id: newId(), subjectId: histoire.id, dayOfWeek: 2, weekType: 'toutes' },
    { id: newId(), subjectId: anglais.id, dayOfWeek: 3, weekType: 'toutes' },
    { id: newId(), subjectId: anglais.id, dayOfWeek: 5, weekType: 'toutes' },
  ]

  // Past mémorisation reviews already done for "Suites numériques" (J0 = -20j),
  // so its next task is further along the J-method cycle rather than at J0.
  const studyLog: StudyLogEntry[] = [
    {
      id: newId(),
      chapterId: suites.id,
      date: addDays(today, -19),
      minutesSpent: 20,
      done: true,
      kind: 'memorisation',
      milestoneIndex: 0,
    },
    {
      id: newId(),
      chapterId: suites.id,
      date: addDays(today, -17),
      minutesSpent: 20,
      done: true,
      kind: 'memorisation',
      milestoneIndex: 1,
    },
    {
      id: newId(),
      chapterId: suites.id,
      date: addDays(today, -13),
      minutesSpent: 20,
      done: true,
      kind: 'memorisation',
      milestoneIndex: 2,
    },
  ]

  return { subjects, chapters, deadlines, timetable, studyLog }
}
