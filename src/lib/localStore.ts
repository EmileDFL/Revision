import {
  DEFAULT_SETTINGS,
  type AlgoSettings,
  type Chapter,
  type DataStore,
  type Deadline,
  type ExportBundle,
  type StudyLogEntry,
  type Subject,
  type TimetableSlot,
} from './types'

const STORAGE_KEY = 'revision-terminale-data-v1'

interface RawData {
  subjects: Subject[]
  chapters: Chapter[]
  deadlines: Deadline[]
  timetable: TimetableSlot[]
  availability: Record<string, number>
  studyLog: StudyLogEntry[]
  settings: AlgoSettings
}

function emptyData(): RawData {
  return {
    subjects: [],
    chapters: [],
    deadlines: [],
    timetable: [],
    availability: {},
    studyLog: [],
    settings: DEFAULT_SETTINGS,
  }
}

function normalizeChapter(chapter: Chapter): Chapter {
  return {
    ...chapter,
    workMode: chapter.workMode ?? 'mixte',
    memoStartDate: chapter.memoStartDate ?? null,
    courseStage: chapter.courseStage ?? null,
  }
}

function normalizeStudyLog(entry: StudyLogEntry): StudyLogEntry {
  return {
    ...entry,
    kind: entry.kind ?? 'generic',
    milestoneIndex: entry.milestoneIndex ?? null,
  }
}

function load(): RawData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyData()
  try {
    const parsed = JSON.parse(raw) as Partial<RawData>
    const data = { ...emptyData(), ...parsed }
    data.chapters = data.chapters.map(normalizeChapter)
    data.studyLog = data.studyLog.map(normalizeStudyLog)
    data.settings = {
      ...DEFAULT_SETTINGS,
      ...data.settings,
      weights: { ...DEFAULT_SETTINGS.weights, ...data.settings?.weights },
    }
    return data
  } catch {
    return emptyData()
  }
}

function save(data: RawData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export class LocalStore implements DataStore {
  async listSubjects(): Promise<Subject[]> {
    return load().subjects
  }

  async upsertSubject(subject: Subject): Promise<void> {
    const data = load()
    const idx = data.subjects.findIndex((s) => s.id === subject.id)
    if (idx >= 0) data.subjects[idx] = subject
    else data.subjects.push(subject)
    save(data)
  }

  async deleteSubject(id: string): Promise<void> {
    const data = load()
    data.subjects = data.subjects.filter((s) => s.id !== id)
    const chapterIds = new Set(data.chapters.filter((c) => c.subjectId === id).map((c) => c.id))
    data.chapters = data.chapters.filter((c) => c.subjectId !== id)
    data.deadlines = data.deadlines.filter((d) => d.subjectId !== id)
    data.timetable = data.timetable.filter((t) => t.subjectId !== id)
    data.studyLog = data.studyLog.filter((l) => !chapterIds.has(l.chapterId))
    save(data)
  }

  async listChapters(): Promise<Chapter[]> {
    return load().chapters
  }

  async upsertChapter(chapter: Chapter): Promise<void> {
    const data = load()
    const idx = data.chapters.findIndex((c) => c.id === chapter.id)
    if (idx >= 0) data.chapters[idx] = chapter
    else data.chapters.push(chapter)
    save(data)
  }

  async upsertChaptersBulk(chapters: Chapter[]): Promise<void> {
    const data = load()
    for (const chapter of chapters) {
      const idx = data.chapters.findIndex((c) => c.id === chapter.id)
      if (idx >= 0) data.chapters[idx] = chapter
      else data.chapters.push(chapter)
    }
    save(data)
  }

  async deleteChapter(id: string): Promise<void> {
    const data = load()
    data.chapters = data.chapters.filter((c) => c.id !== id)
    data.studyLog = data.studyLog.filter((l) => l.chapterId !== id)
    for (const d of data.deadlines) {
      d.chapterIds = d.chapterIds.filter((cid) => cid !== id)
    }
    save(data)
  }

  async listDeadlines(): Promise<Deadline[]> {
    return load().deadlines
  }

  async upsertDeadline(deadline: Deadline): Promise<void> {
    const data = load()
    const idx = data.deadlines.findIndex((d) => d.id === deadline.id)
    if (idx >= 0) data.deadlines[idx] = deadline
    else data.deadlines.push(deadline)
    save(data)
  }

  async deleteDeadline(id: string): Promise<void> {
    const data = load()
    data.deadlines = data.deadlines.filter((d) => d.id !== id)
    save(data)
  }

  async listTimetable(): Promise<TimetableSlot[]> {
    return load().timetable
  }

  async upsertTimetableSlot(slot: TimetableSlot): Promise<void> {
    const data = load()
    const idx = data.timetable.findIndex((t) => t.id === slot.id)
    if (idx >= 0) data.timetable[idx] = slot
    else data.timetable.push(slot)
    save(data)
  }

  async upsertTimetableSlotsBulk(slots: TimetableSlot[]): Promise<void> {
    const data = load()
    for (const slot of slots) {
      const idx = data.timetable.findIndex((t) => t.id === slot.id)
      if (idx >= 0) data.timetable[idx] = slot
      else data.timetable.push(slot)
    }
    save(data)
  }

  async deleteTimetableSlot(id: string): Promise<void> {
    const data = load()
    data.timetable = data.timetable.filter((t) => t.id !== id)
    save(data)
  }

  async getAvailability(date: string): Promise<number> {
    return load().availability[date] ?? 0
  }

  async setAvailability(date: string, minutes: number): Promise<void> {
    const data = load()
    data.availability[date] = minutes
    save(data)
  }

  async listStudyLog(date: string): Promise<StudyLogEntry[]> {
    return load().studyLog.filter((l) => l.date === date)
  }

  async listAllStudyLog(): Promise<StudyLogEntry[]> {
    return load().studyLog
  }

  async upsertStudyLog(entry: StudyLogEntry): Promise<void> {
    const data = load()
    const idx = data.studyLog.findIndex((l) => l.id === entry.id)
    if (idx >= 0) data.studyLog[idx] = entry
    else data.studyLog.push(entry)
    save(data)
  }

  async getSettings(): Promise<AlgoSettings> {
    return load().settings
  }

  async setSettings(settings: AlgoSettings): Promise<void> {
    const data = load()
    data.settings = settings
    save(data)
  }

  async exportAll(): Promise<ExportBundle> {
    const data = load()
    return {
      exportedAt: new Date().toISOString(),
      subjects: data.subjects,
      chapters: data.chapters,
      deadlines: data.deadlines,
      timetable: data.timetable,
      availability: data.availability,
      studyLog: data.studyLog,
      settings: data.settings,
    }
  }
}
