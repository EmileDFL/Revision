export type ChapterStatus = 'a_faire' | 'en_cours' | 'maitrise' | 'faible'

export type DeadlineType = 'devoir' | 'controle' | 'bac_blanc' | 'oral' | 'autre'

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
}

export interface AlgoWeights {
  faible: number
  en_cours: number
  a_faire: number
  maitrise: number
}

export interface AlgoSettings {
  blockMinutes: number
  weights: AlgoWeights
  horizonDays: number
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

export interface ExportBundle {
  exportedAt: string
  subjects: Subject[]
  chapters: Chapter[]
  deadlines: Deadline[]
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

  getAvailability(date: string): Promise<number>
  setAvailability(date: string, minutes: number): Promise<void>

  listStudyLog(date: string): Promise<StudyLogEntry[]>
  upsertStudyLog(entry: StudyLogEntry): Promise<void>

  getSettings(): Promise<AlgoSettings>
  setSettings(settings: AlgoSettings): Promise<void>

  exportAll(): Promise<ExportBundle>
}
