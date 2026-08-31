import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from './types'
import type {
  AlgoSettings,
  Chapter,
  ChapterStatus,
  CourseStage,
  DataStore,
  Deadline,
  DeadlineType,
  ExportBundle,
  Homework,
  OverrideType,
  PlanKind,
  PlanOverride,
  StudyLogEntry,
  StudyLogKind,
  Subject,
  TimetableSlot,
  WeekType,
  WorkMode,
} from './types'

interface SubjectRow {
  id: string
  name: string
  color: string
  coefficient: number | null
}

interface ChapterRow {
  id: string
  subject_id: string
  title: string
  order_index: number
  status: ChapterStatus
  notes: string | null
  work_mode: WorkMode
  memo_start_date: string | null
  course_stage: CourseStage | null
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
  kind: StudyLogKind
  milestone_index: number | null
}

interface TimetableRow {
  id: string
  subject_id: string
  day_of_week: number
  week_type: WeekType
}

interface PlanOverrideRow {
  id: string
  chapter_id: string | null
  homework_id: string | null
  date: string
  kind: PlanKind
  type: OverrideType
  minutes: number | null
}

interface HomeworkRow {
  id: string
  subject_id: string
  chapter_id: string | null
  title: string
  due_date: string
  estimated_minutes: number
  done: boolean
  done_at: string | null
  notes: string | null
}

function subjectFromRow(row: SubjectRow): Subject {
  return { id: row.id, name: row.name, color: row.color, coefficient: row.coefficient ?? 1 }
}

function chapterFromRow(row: ChapterRow): Chapter {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    orderIndex: row.order_index,
    status: row.status,
    notes: row.notes ?? '',
    workMode: row.work_mode ?? 'mixte',
    memoStartDate: row.memo_start_date,
    courseStage: row.course_stage,
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
    kind: row.kind ?? 'generic',
    milestoneIndex: row.milestone_index,
  }
}

function timetableFromRow(row: TimetableRow): TimetableSlot {
  return {
    id: row.id,
    subjectId: row.subject_id,
    dayOfWeek: row.day_of_week,
    weekType: row.week_type,
  }
}

function overrideFromRow(row: PlanOverrideRow): PlanOverride {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    homeworkId: row.homework_id,
    date: row.date,
    kind: row.kind,
    type: row.type,
    minutes: row.minutes,
  }
}

function homeworkFromRow(row: HomeworkRow): Homework {
  return {
    id: row.id,
    subjectId: row.subject_id,
    chapterId: row.chapter_id,
    title: row.title,
    dueDate: row.due_date,
    estimatedMinutes: row.estimated_minutes,
    done: row.done,
    doneAt: row.done_at,
    notes: row.notes ?? '',
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
    const { data, error } = await this.client.from('subjects').select('id,name,color,coefficient').order('name')
    if (error) throw error
    return (data as SubjectRow[]).map(subjectFromRow)
  }

  async upsertSubject(subject: Subject): Promise<void> {
    const { error } = await this.client.from('subjects').upsert({
      id: subject.id,
      name: subject.name,
      color: subject.color,
      coefficient: subject.coefficient,
      user_id: this.userId,
    })
    if (error) throw error
  }

  async deleteSubject(id: string): Promise<void> {
    const { error } = await this.client.from('subjects').delete().eq('id', id)
    if (error) throw error
  }

  async listChapters(): Promise<Chapter[]> {
    const { data, error } = await this.client
      .from('chapters')
      .select('id,subject_id,title,order_index,status,notes,work_mode,memo_start_date,course_stage')
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
      work_mode: chapter.workMode,
      memo_start_date: chapter.memoStartDate,
      course_stage: chapter.courseStage,
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
      work_mode: chapter.workMode,
      memo_start_date: chapter.memoStartDate,
      course_stage: chapter.courseStage,
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

  async listTimetable(): Promise<TimetableSlot[]> {
    const { data, error } = await this.client
      .from('timetable_slots')
      .select('id,subject_id,day_of_week,week_type')
      .order('day_of_week')
    if (error) throw error
    return (data as TimetableRow[]).map(timetableFromRow)
  }

  async upsertTimetableSlot(slot: TimetableSlot): Promise<void> {
    const { error } = await this.client.from('timetable_slots').upsert({
      id: slot.id,
      subject_id: slot.subjectId,
      day_of_week: slot.dayOfWeek,
      week_type: slot.weekType,
      user_id: this.userId,
    })
    if (error) throw error
  }

  async upsertTimetableSlotsBulk(slots: TimetableSlot[]): Promise<void> {
    const rows = slots.map((slot) => ({
      id: slot.id,
      subject_id: slot.subjectId,
      day_of_week: slot.dayOfWeek,
      week_type: slot.weekType,
      user_id: this.userId,
    }))
    const { error } = await this.client.from('timetable_slots').upsert(rows)
    if (error) throw error
  }

  async deleteTimetableSlot(id: string): Promise<void> {
    const { error } = await this.client.from('timetable_slots').delete().eq('id', id)
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
      .select('id,chapter_id,date,minutes_spent,done,kind,milestone_index')
      .eq('date', date)
    if (error) throw error
    return (data as StudyLogRow[]).map(studyLogFromRow)
  }

  async listAllStudyLog(): Promise<StudyLogEntry[]> {
    const { data, error } = await this.client
      .from('study_log')
      .select('id,chapter_id,date,minutes_spent,done,kind,milestone_index')
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
      kind: entry.kind,
      milestone_index: entry.milestoneIndex,
      user_id: this.userId,
    })
    if (error) throw error
  }

  async listAllPlanOverrides(): Promise<PlanOverride[]> {
    const { data, error } = await this.client
      .from('plan_overrides')
      .select('id,chapter_id,homework_id,date,kind,type,minutes')
    if (error) throw error
    return (data as PlanOverrideRow[]).map(overrideFromRow)
  }

  async upsertPlanOverride(override: PlanOverride): Promise<void> {
    const { error } = await this.client.from('plan_overrides').upsert({
      id: override.id,
      chapter_id: override.chapterId,
      homework_id: override.homeworkId,
      date: override.date,
      kind: override.kind,
      type: override.type,
      minutes: override.minutes,
      user_id: this.userId,
    })
    if (error) throw error
  }

  async deletePlanOverride(id: string): Promise<void> {
    const { error } = await this.client.from('plan_overrides').delete().eq('id', id)
    if (error) throw error
  }

  async listAllHomework(): Promise<Homework[]> {
    const { data, error } = await this.client
      .from('homework')
      .select('id,subject_id,chapter_id,title,due_date,estimated_minutes,done,done_at,notes')
      .order('due_date')
    if (error) throw error
    return (data as HomeworkRow[]).map(homeworkFromRow)
  }

  async upsertHomework(homework: Homework): Promise<void> {
    const { error } = await this.client.from('homework').upsert({
      id: homework.id,
      subject_id: homework.subjectId,
      chapter_id: homework.chapterId,
      title: homework.title,
      due_date: homework.dueDate,
      estimated_minutes: homework.estimatedMinutes,
      done: homework.done,
      done_at: homework.doneAt,
      notes: homework.notes,
      user_id: this.userId,
    })
    if (error) throw error
  }

  async deleteHomework(id: string): Promise<void> {
    const { error } = await this.client.from('homework').delete().eq('id', id)
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
    const [subjects, chapters, deadlines, homework, timetable, settings] = await Promise.all([
      this.listSubjects(),
      this.listChapters(),
      this.listDeadlines(),
      this.listAllHomework(),
      this.listTimetable(),
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
    const studyLog = await this.listAllStudyLog()
    const overrides = await this.listAllPlanOverrides()

    return {
      exportedAt: new Date().toISOString(),
      subjects,
      chapters,
      deadlines,
      homework,
      timetable,
      availability,
      studyLog,
      overrides,
      settings,
    }
  }
}
