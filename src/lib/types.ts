export type ChapterStatus = 'a_faire' | 'en_cours' | 'maitrise' | 'faible'

export type DeadlineType = 'devoir' | 'controle' | 'bac_blanc' | 'oral' | 'autre'

export type WorkMode = 'memorisation' | 'exercice' | 'mixte'

/** Où en est le cours en classe pour ce chapitre — indépendant de `status`
 * (ma maîtrise perso) : un chapitre peut être "cours fini" en classe tout en
 * restant à réviser pour une éval plus tard. */
export type CourseStage = 'a_venir' | 'en_cours' | 'termine'

export type WeekType = 'A' | 'B' | 'toutes'

export type StudyLogKind = 'memorisation' | 'exercice' | 'generic'

export interface Subject {
  id: string
  name: string
  color: string
}

export interface Chapter {
  id: string
  subjectId: string
  title: string
  orderIndex: number
  status: ChapterStatus
  notes: string
  workMode: WorkMode
  memoStartDate: string | null // ISO yyyy-mm-dd, J0 for "méthode des J"
  /** null = pas encore renseigné : aucune tâche liée au cours n'est générée
   * tant que l'utilisateur n'a pas choisi explicitement un état. */
  courseStage: CourseStage | null
}

export interface Deadline {
  id: string
  subjectId: string
  title: string
  date: string // ISO yyyy-mm-dd
  type: DeadlineType
  chapterIds: string[]
}

export interface StudyLogEntry {
  id: string
  chapterId: string
  date: string // ISO yyyy-mm-dd
  minutesSpent: number
  done: boolean
  kind: StudyLogKind
  milestoneIndex: number | null // for kind='memorisation': index into memoIntervalsDays
}

export interface TimetableSlot {
  id: string
  subjectId: string
  dayOfWeek: number // ISO: 1=lundi ... 7=dimanche
  weekType: WeekType
}

export interface AlgoWeights {
  faible: number
  en_cours: number
  a_faire: number
  maitrise: number
}

export interface WeekAnchor {
  mondayIso: string // ISO date of a Monday known to be week `type`
  type: 'A' | 'B'
}

export interface AlgoSettings {
  blockMinutes: number
  weights: AlgoWeights
  horizonDays: number
  memoIntervalsDays: number[]
  memoRepeatDays: number
  memoBufferBeforeEvalDays: number
  memoBlockMinutes: number
  weekAnchor: WeekAnchor | null
  /** Jours avant une éval où programmer une séance d'exercices (triés du
   * plus loin au plus proche). Le dernier (le plus petit) est traité comme
   * une révision légère, pas un rush — cf. recherche sur l'apprentissage
   * espacé : mieux vaut plusieurs sessions de "testing" étalées qu'un seul
   * bachotage la veille. */
  exercisePreEvalOffsetsDays: number[]
  /** Fenêtre (en jours) sur laquelle étaler le recalage mémorisation quand
   * plusieurs chapitres convergent vers la même éval, pour éviter qu'ils se
   * concentrent tous sur le même jour juste avant. */
  memoSpreadDays: number
}

export const DEFAULT_SETTINGS: AlgoSettings = {
  blockMinutes: 30,
  weights: {
    faible: 3,
    en_cours: 2,
    a_faire: 1.3,
    maitrise: 0.5,
  },
  horizonDays: 7,
  memoIntervalsDays: [1, 3, 7, 15, 30],
  exercisePreEvalOffsetsDays: [7, 4, 2, 1],
  memoSpreadDays: 3,
  memoRepeatDays: 30,
  memoBufferBeforeEvalDays: 1,
  memoBlockMinutes: 20,
  weekAnchor: null,
}

export const STATUS_LABELS: Record<ChapterStatus, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  faible: 'Point faible',
  maitrise: 'Maîtrisé',
}

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  devoir: 'Devoir',
  controle: 'Contrôle',
  bac_blanc: 'Bac blanc',
  oral: 'Oral',
  autre: 'Autre',
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  memorisation: 'Mémorisation',
  exercice: 'Exercice',
  mixte: 'Mixte',
}

export const COURSE_STAGE_LABELS: Record<CourseStage, string> = {
  a_venir: 'Pas encore vu',
  en_cours: 'En classe',
  termine: 'Cours fini',
}

export const WEEK_TYPE_LABELS: Record<WeekType, string> = {
  A: 'Semaine A',
  B: 'Semaine B',
  toutes: 'Toutes les semaines',
}

export const DAY_LABELS: Record<number, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
}

export interface ExportBundle {
  exportedAt: string
  subjects: Subject[]
  chapters: Chapter[]
  deadlines: Deadline[]
  timetable: TimetableSlot[]
  availability: Record<string, number>
  studyLog: StudyLogEntry[]
  settings: AlgoSettings
}

export interface DataStore {
  listSubjects(): Promise<Subject[]>
  upsertSubject(subject: Subject): Promise<void>
  deleteSubject(id: string): Promise<void>

  listChapters(): Promise<Chapter[]>
  upsertChapter(chapter: Chapter): Promise<void>
  upsertChaptersBulk(chapters: Chapter[]): Promise<void>
  deleteChapter(id: string): Promise<void>

  listDeadlines(): Promise<Deadline[]>
  upsertDeadline(deadline: Deadline): Promise<void>
  deleteDeadline(id: string): Promise<void>

  listTimetable(): Promise<TimetableSlot[]>
  upsertTimetableSlot(slot: TimetableSlot): Promise<void>
  upsertTimetableSlotsBulk(slots: TimetableSlot[]): Promise<void>
  deleteTimetableSlot(id: string): Promise<void>

  getAvailability(date: string): Promise<number>
  setAvailability(date: string, minutes: number): Promise<void>

  listStudyLog(date: string): Promise<StudyLogEntry[]>
  listAllStudyLog(): Promise<StudyLogEntry[]>
  upsertStudyLog(entry: StudyLogEntry): Promise<void>

  getSettings(): Promise<AlgoSettings>
  setSettings(settings: AlgoSettings): Promise<void>

  exportAll(): Promise<ExportBundle>
}
