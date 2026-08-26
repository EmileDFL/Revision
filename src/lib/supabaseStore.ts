import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from './types'
import type {
  AlgoSettings,
  Chapter,
  ChapterStatus,
  DataStore,
  Deadline,
  DeadlineType,
  ExportBundle,
  StudyLogEntry,
  Subject,
} from './types'

interface SubjectRow {
  id: string
  name: string
  color: string
}

interface ChapterRow {
  id: string
  subject_id: string
  title: string
  order_index: number
  status: ChapterStatus
  notes: string | null
}

interface DeadlineRow {
  id: string
  subject_id: string
  title: string
  date: string
  type: DeadlineType
  deadline_chapters: { chapter_id: string }[] | null
}

interface StudyLogRow {
  id: string
  chapter_id: string
  date: string
  minutes_spent: number
  done: boolean
}

function subjectFromRow(row: SubjectRow): Subject {
  return { id: row.id, name: row.name, color: row.color }
}

function chapterFromRow(row: ChapterRow): Chapter {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    orderIndex: row.order_index,
    status: row.status,
    notes: row.notes ?? '',
  }
}

function deadlineFromRow(row: DeadlineRow): Deadline {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    date: row.date,
    type: row.type,
    chapterIds: (row.deadline_chapters ?? []).map((c) => c.chapter_id),
  }
}

function studyLogFromRow(row: StudyLogRow): StudyLogEntry {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    date: row.date,
    minutesSpent: row.minutes_spent,
    done: row.done,
  }
}

export class SupabaseStore implements DataStore {
  private client: SupabaseClient
  private userId: string

  constructor(client: SupabaseClient, userId: string) {
    this.client = client
    this.userId = userId
  }

  async listSubjects(): Promise<Subject[]> {
    const { data, error } = await this.client.from('subjects').select('id,name,color').order('name')
    if (error) throw error
    return (data as SubjectRow[]).map(subjectFromRow)
  }

  async upsertSubject(subject: Subject): Promise<void> {
    const { error } = await this.client
      .from('subjects')
      .upsert({ id: subject.id, name: subject.name, color: subject.color, user_id: this.userId })
    if (error) throw error
  }

  async deleteSubject(id: string): Promise<void> {
    const { error } = await this.client.from('subjects').delete().eq('id', id)
    if (error) throw error
  }

  async listChapters(): Promise<Chapter[]> {
    const { data, error } = await this.client
      .from('chapters')
      .select('id,subject_id,title,order_index,status,notes')
      .order('order_index')
    if (error) throw error
    return (data as ChapterRow[]).map(chapterFromRow)
  }

  async upsertChapter(chapter: Chapter): Promise<void> {
    const { error } = await this.client.from('chapters').upsert({
      id: chapter.id,
      subject_id: chapter.subjectId,
      title: chapter.title,
      order_index: chapter.orderIndex,
      status: chapter.status,
      notes: chapter.notes,
      user_id: this.userId,
    })
    if (error) throw error
  }

  async upsertChaptersBulk(chapters: Chapter[]): Promise<void> {
    const rows = chapters.map((chapter) => ({
      id: chapter.id,
      subject_id: chapter.subjectId,
      title: chapter.title,
      order_index: chapter.orderIndex,
      status: chapter.status,
      notes: chapter.notes,
      user_id: this.userId,
    }))
    const { error } = await this.client.from('chapters').upsert(rows)
    if (error) throw error
  }

  async deleteChapter(id: string): Promise<void> {
    const { error } = await this.client.from('chapters').delete().eq('id', id)
    if (error) throw error
  }

  async listDeadlines(): Promise<Deadline[]> {
    const { data, error } = await this.client
      .from('deadlines')
      .select('id,subject_id,title,date,type,deadline_chapters(chapter_id)')
      .order('date')
    if (error) throw error
    return (data as unknown as DeadlineRow[]).map(deadlineFromRow)
  }

  async upsertDeadline(deadline: Deadline): Promise<void> {
    const { error } = await this.client.from('deadlines').upsert({
      id: deadline.id,
      subject_id: deadline.subjectId,
      title: deadline.title,
      date: deadline.date,
      type: deadline.type,
      user_id: this.userId,
    })
    if (error) throw error

    const { error: delError } = await this.client
      .from('deadline_chapters')
      .delete()
      .eq('deadline_id', deadline.id)
    if (delError) throw delError

    if (deadline.chapterIds.length > 0) {
      const rows = deadline.chapterIds.map((chapterId) => ({
        deadline_id: deadline.id,
        chapter_id: chapterId,
        user_id: this.userId,
      }))
      const { error: insError } = await this.client.from('deadline_chapters').insert(rows)
      if (insError) throw insError
    }
  }

  async deleteDeadline(id: string): Promise<void> {
    const { error } = await this.client.from('deadlines').delete().eq('id', id)
    if (error) throw error
  }

  async getAvailability(date: string): Promise<number> {
    const { data, error } = await this.client
      .from('availability')
      .select('minutes')
      .eq('date', date)
      .maybeSingle()
    if (error) throw error
    return (data as { minutes: number } | null)?.minutes ?? 0
  }

  async setAvailability(date: string, minutes: number): Promise<void> {
    const { error } = await this.client
      .from('availability')
      .upsert({ date, minutes, user_id: this.userId })
    if (error) throw error
  }

  async listStudyLog(date: string): Promise<StudyLogEntry[]> {
    const { data, error } = await this.client
      .from('study_log')
      .select('id,chapter_id,date,minutes_spent,done')
      .eq('date', date)
    if (error) throw error
    return (data as StudyLogRow[]).map(studyLogFromRow)
  }

  async upsertStudyLog(entry: StudyLogEntry): Promise<void> {
    const { error } = await this.client.from('study_log').upsert({
      id: entry.id,
      chapter_id: entry.chapterId,
      date: entry.date,
      minutes_spent: entry.minutesSpent,
      done: entry.done,
      user_id: this.userId,
    })
    if (error) throw error
  }

  async getSettings(): Promise<AlgoSettings> {
    const { data, error } = await this.client
      .from('user_settings')
      .select('settings')
      .eq('user_id', this.userId)
      .maybeSingle()
    if (error) throw error
    const settings = (data as { settings: Partial<AlgoSettings> } | null)?.settings
    if (!settings || Object.keys(settings).length === 0) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...settings, weights: { ...DEFAULT_SETTINGS.weights, ...settings.weights } }
  }

  async setSettings(settings: AlgoSettings): Promise<void> {
    const { error } = await this.client
      .from('user_settings')
      .upsert({ user_id: this.userId, settings })
    if (error) throw error
  }

  async exportAll(): Promise<ExportBundle> {
    const [subjects, chapters, deadlines, settings] = await Promise.all([
      this.listSubjects(),
      this.listChapters(),
      this.listDeadlines(),
      this.getSettings(),
    ])
    const { data: availRows, error: availError } = await this.client
      .from('availability')
      .select('date,minutes')
    if (availError) throw availError
    const availability: Record<string, number> = {}
    for (const row of availRows as { date: string; minutes: number }[]) {
      availability[row.date] = row.minutes
    }
    const { data: logRows, error: logError } = await this.client
      .from('study_log')
      .select('id,chapter_id,date,minutes_spent,done')
    if (logError) throw logError
    const studyLog = (logRows as StudyLogRow[]).map(studyLogFromRow)

    return {
      exportedAt: new Date().toISOString(),
      subjects,
      chapters,
      deadlines,
      availability,
      studyLog,
      settings,
    }
  }
}
