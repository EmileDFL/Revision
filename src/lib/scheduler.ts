import type {
  AlgoSettings,
  Chapter,
  Deadline,
  StudyLogEntry,
  TimetableSlot,
  WeekAnchor,
} from './types'

export type TaskKind = 'memorisation' | 'exercice' | 'generic'

export interface PlanItem {
  chapterId: string
  subjectId: string
  minutes: number
  score: number
  reason: string
  kind: TaskKind
  milestoneIndex: number | null
}

interface Candidate {
  chapterId: string
  subjectId: string
  date: string
  kind: TaskKind
  minutes: number
  priority: number
  reason: string
  milestoneIndex: number | null
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`)
  const to = new Date(`${toIso}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** ISO weekday: 1=lundi ... 7=dimanche */
export function isoWeekday(iso: string): number {
  const day = new Date(`${iso}T00:00:00`).getDay() // 0=dimanche..6=samedi
  return day === 0 ? 7 : day
}

function mondayOf(iso: string): string {
  const weekday = isoWeekday(iso)
  return addDays(iso, -(weekday - 1))
}

export function weekTypeForDate(iso: string, anchor: WeekAnchor | null): 'A' | 'B' | null {
  if (!anchor) return null
  const mon = mondayOf(iso)
  const weeksDiff = Math.round(daysBetween(anchor.mondayIso, mon) / 7)
  const parity = ((weeksDiff % 2) + 2) % 2
  return parity === 0 ? anchor.type : anchor.type === 'A' ? 'B' : 'A'
}

function slotMatchesDate(slot: TimetableSlot, iso: string, anchor: WeekAnchor | null): boolean {
  if (slot.dayOfWeek !== isoWeekday(iso)) return false
  if (slot.weekType === 'toutes') return true
  return slot.weekType === weekTypeForDate(iso, anchor)
}

function isClassDay(subjectId: string, iso: string, timetable: TimetableSlot[], anchor: WeekAnchor | null): boolean {
  return timetable.some((t) => t.subjectId === subjectId && slotMatchesDate(t, iso, anchor))
}

/** First class day for this subject at or after `fromIso`, within `windowDates`. */
function firstClassDayFrom(
  subjectId: string,
  fromIso: string,
  windowDates: string[],
  timetable: TimetableSlot[],
  anchor: WeekAnchor | null,
): string | null {
  for (const date of windowDates) {
    if (date < fromIso) continue
    if (isClassDay(subjectId, date, timetable, anchor)) return date
  }
  return null
}

/** Deterministic 0..spread-1 offset from a chapter id, used to spread
 * several chapters' pre-eval catch-up across a few days instead of piling
 * them all onto the exact same day. */
function spreadOffsetFor(id: string, spread: number): number {
  if (spread <= 1) return 0
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash % spread
}

/** Nearest upcoming (or today) deadline covering this chapter, if any. */
function nearestDeadlineFor(chapterId: string, deadlines: Deadline[], todayIso: string): Deadline | null {
  let best: Deadline | null = null
  let bestDays = Infinity
  for (const d of deadlines) {
    if (!d.chapterIds.includes(chapterId)) continue
    const days = daysBetween(todayIso, d.date)
    if (days < 0) continue
    if (days < bestDays) {
      bestDays = days
      best = d
    }
  }
  return best
}

export interface MemoProgress {
  /** Index into settings.memoIntervalsDays, or null once in the maintenance
   * (post-J+last) repeat phase. */
  nextMilestoneIndex: number | null
  totalMilestones: number
  dueDate: string // clamped to today if overdue, capped if an eval is close
  overdue: boolean
  cappedByEvalTitle: string | null
}

/** Where a chapter stands in its "méthode des J" cycle, or null if
 * mémorisation isn't applicable (wrong workMode, or not started yet). */
export function computeMemoProgress(
  chapter: Chapter,
  deadlines: Deadline[],
  studyLog: StudyLogEntry[],
  settings: AlgoSettings,
  todayIso: string,
): MemoProgress | null {
  if (chapter.workMode !== 'memorisation' && chapter.workMode !== 'mixte') return null
  if (!chapter.memoStartDate) return null

  const intervals = settings.memoIntervalsDays
  const doneEntries = studyLog.filter((l) => l.chapterId === chapter.id && l.kind === 'memorisation' && l.done)
  const doneMilestones = new Set(doneEntries.map((l) => l.milestoneIndex).filter((i): i is number => i !== null))
  let nextIndex = 0
  while (doneMilestones.has(nextIndex)) nextIndex++

  let naturalDueDate: string
  let nextMilestoneIndex: number | null

  if (nextIndex < intervals.length) {
    naturalDueDate = addDays(chapter.memoStartDate, intervals[nextIndex])
    nextMilestoneIndex = nextIndex
  } else {
    const lastDate = doneEntries.length > 0 ? doneEntries.map((e) => e.date).sort().slice(-1)[0] : chapter.memoStartDate
    naturalDueDate = addDays(lastDate, settings.memoRepeatDays)
    nextMilestoneIndex = null
  }

  const overdue = naturalDueDate < todayIso
  let dueDate = overdue ? todayIso : naturalDueDate
  let cappedByEvalTitle: string | null = null

  const nearest = nearestDeadlineFor(chapter.id, deadlines, todayIso)
  if (nearest) {
    const spread = spreadOffsetFor(chapter.id, settings.memoSpreadDays)
    const capDate = addDays(nearest.date, -(settings.memoBufferBeforeEvalDays + spread))
    const clampedCap = capDate < todayIso ? todayIso : capDate
    if (clampedCap < dueDate) {
      dueDate = clampedCap
      cappedByEvalTitle = nearest.title
    }
  }

  return { nextMilestoneIndex, totalMilestones: intervals.length, dueDate, overdue, cappedByEvalTitle }
}

function generateMemorisationTasks(
  chapters: Chapter[],
  deadlines: Deadline[],
  studyLog: StudyLogEntry[],
  settings: AlgoSettings,
  windowDates: string[],
  todayIso: string,
): Candidate[] {
  const out: Candidate[] = []

  for (const chapter of chapters) {
    const progress = computeMemoProgress(chapter, deadlines, studyLog, settings, todayIso)
    if (!progress || !windowDates.includes(progress.dueDate)) continue

    const reason = progress.cappedByEvalTitle
      ? `rappel mémorisation avant éval : ${progress.cappedByEvalTitle}`
      : progress.nextMilestoneIndex !== null
        ? `rappel mémorisation (J+${settings.memoIntervalsDays[progress.nextMilestoneIndex]})`
        : "rappel d'entretien mémorisation"

    const tier = progress.overdue ? 100 : progress.cappedByEvalTitle ? 90 : 70
    out.push({
      chapterId: chapter.id,
      subjectId: chapter.subjectId,
      date: progress.dueDate,
      kind: 'memorisation',
      minutes: settings.memoBlockMinutes,
      priority: tier * 1000,
      reason: progress.overdue ? `En retard — ${reason}` : reason,
      milestoneIndex: progress.nextMilestoneIndex,
    })
  }

  return out
}

function generateExerciseTasks(
  chapters: Chapter[],
  deadlines: Deadline[],
  timetable: TimetableSlot[],
  settings: AlgoSettings,
  windowDates: string[],
  todayIso: string,
): Candidate[] {
  const out: Candidate[] = []

  for (const chapter of chapters) {
    if (chapter.workMode !== 'exercice' && chapter.workMode !== 'mixte') continue

    // "À venir" doit être choisi explicitement pour déclencher une petite
    // séance de préparation avant le tout premier cours — un chapitre sans
    // état choisi (courseStage null) ne déclenche rien de ce côté.
    if (chapter.status !== 'maitrise' && chapter.courseStage === 'a_venir') {
      const firstClass = firstClassDayFrom(chapter.subjectId, todayIso, windowDates, timetable, settings.weekAnchor)
      if (firstClass) {
        out.push({
          chapterId: chapter.id,
          subjectId: chapter.subjectId,
          date: firstClass,
          kind: 'exercice',
          minutes: Math.max(10, Math.round(settings.blockMinutes / 2)),
          priority: 50 * 1000,
          reason: 'petite séance de préparation avant le début du cours',
          milestoneIndex: null,
        })
      }
    }

    // Après/avant un cours et week-end suivent le rythme de la classe et la
    // maîtrise perso — mais l'éval (ci-dessous) s'applique même à un
    // chapitre déjà maîtrisé ou dont le cours est terminé : un DS dans un
    // mois peut porter dessus.
    if (chapter.status !== 'maitrise' && chapter.courseStage === 'en_cours') {
      for (const date of windowDates) {
        if (isClassDay(chapter.subjectId, date, timetable, settings.weekAnchor)) {
          out.push({
            chapterId: chapter.id,
            subjectId: chapter.subjectId,
            date,
            kind: 'exercice',
            minutes: settings.blockMinutes,
            priority: 60 * 1000,
            reason: 'exercices après le cours',
            milestoneIndex: null,
          })
        }
        const tomorrow = addDays(date, 1)
        if (isClassDay(chapter.subjectId, tomorrow, timetable, settings.weekAnchor)) {
          out.push({
            chapterId: chapter.id,
            subjectId: chapter.subjectId,
            date,
            kind: 'exercice',
            minutes: settings.blockMinutes,
            priority: 55 * 1000,
            reason: 'exercices avant le prochain cours',
            milestoneIndex: null,
          })
        }
      }
    }

    for (const date of windowDates) {
      const weekday = isoWeekday(date)
      if (chapter.status !== 'maitrise' && (weekday === 6 || weekday === 7)) {
        out.push({
          chapterId: chapter.id,
          subjectId: chapter.subjectId,
          date,
          kind: 'exercice',
          minutes: settings.blockMinutes,
          priority: 40 * 1000,
          reason: 'exercices du week-end',
          milestoneIndex: null,
        })
      }
    }

    // Plusieurs séances d'entraînement espacées avant l'éval plutôt qu'un
    // seul rush la veille (apprentissage espacé + testing effect) ; la
    // séance la plus proche de l'éval est volontairement plus courte —
    // révision légère, pas bachotage de dernière minute.
    const nearest = nearestDeadlineFor(chapter.id, deadlines, todayIso)
    if (nearest) {
      // Les offsets lointains peuvent tous se retrouver clampés sur le même
      // jour si l'éval est proche : on déduplique par date réelle avant de
      // décider laquelle est la plus proche de l'éval (donc "légère").
      const candidateDates = new Set<string>()
      for (const offset of settings.exercisePreEvalOffsetsDays) {
        let d = addDays(nearest.date, -offset)
        if (d < todayIso) d = todayIso
        if (d >= nearest.date) continue
        if (!windowDates.includes(d)) continue
        candidateDates.add(d)
      }
      const sortedDates = [...candidateDates].sort()
      sortedDates.forEach((d, i) => {
        const isLast = i === sortedDates.length - 1
        const daysBefore = daysBetween(d, nearest.date)
        out.push({
          chapterId: chapter.id,
          subjectId: chapter.subjectId,
          date: d,
          kind: 'exercice',
          minutes: isLast ? Math.max(10, Math.round(settings.blockMinutes / 2)) : settings.blockMinutes,
          priority: (isLast ? 75 : 85) * 1000,
          reason: isLast
            ? `révision légère avant éval : ${nearest.title}`
            : `exercices avant éval (J-${daysBefore}) : ${nearest.title}`,
          milestoneIndex: null,
        })
      })
    }
  }

  return out
}

function generateFallbackTasks(
  chapters: Chapter[],
  deadlines: Deadline[],
  todayIso: string,
  settings: AlgoSettings,
  coveredChapterIds: Set<string>,
): Candidate[] {
  const out: Candidate[] = []
  for (const chapter of chapters) {
    if (coveredChapterIds.has(chapter.id)) continue
    const nearest = nearestDeadlineFor(chapter.id, deadlines, todayIso)
    const statusWeight = settings.weights[chapter.status]
    let urgency: number
    let reason: string
    if (nearest) {
      const days = Math.max(0, daysBetween(todayIso, nearest.date))
      urgency = (1 / (days + 1)) * statusWeight
      reason = days === 0 ? `échéance aujourd'hui : ${nearest.title}` : `échéance dans ${days} j : ${nearest.title}`
    } else if (chapter.status === 'faible') {
      urgency = 0.05 * statusWeight
      reason = "pas d'échéance liée"
    } else {
      continue
    }
    out.push({
      chapterId: chapter.id,
      subjectId: chapter.subjectId,
      date: todayIso,
      kind: 'generic',
      minutes: settings.blockMinutes,
      priority: 10 * 1000 + urgency * 100,
      reason,
      milestoneIndex: null,
    })
  }
  return out
}

function dedupe(candidates: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>()
  for (const c of candidates) {
    const key = `${c.chapterId}|${c.kind}`
    const existing = best.get(key)
    if (!existing || c.priority > existing.priority) best.set(key, c)
  }
  return [...best.values()]
}

function allocateDay(candidates: Candidate[], minutesAvailable: number): PlanItem[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  const result: PlanItem[] = []
  let remaining = minutesAvailable
  for (const c of sorted) {
    if (remaining < Math.min(c.minutes, 5)) continue
    const minutes = Math.min(c.minutes, remaining)
    result.push({
      chapterId: c.chapterId,
      subjectId: c.subjectId,
      minutes,
      score: c.priority,
      reason: c.reason,
      kind: c.kind,
      milestoneIndex: c.milestoneIndex,
    })
    remaining -= minutes
  }
  return result
}

export interface ComputeWeekPlanParams {
  chapters: Chapter[]
  deadlines: Deadline[]
  timetable: TimetableSlot[]
  studyLog: StudyLogEntry[]
  todayIso: string
  availabilityByDate: Record<string, number>
  settings: AlgoSettings
}

/**
 * Deterministic, local algorithm — no AI involved. Produces a 7-day plan
 * (today included) from three task generators (mémorisation, exercice,
 * filet de sécurité générique) merged by a single day-by-day allocator.
 */
export function computeWeekPlan(params: ComputeWeekPlanParams): Record<string, PlanItem[]> {
  const { chapters, deadlines, timetable, studyLog, todayIso, availabilityByDate, settings } = params
  const windowDates = Array.from({ length: 7 }, (_, i) => addDays(todayIso, i))

  const memoCandidates = generateMemorisationTasks(chapters, deadlines, studyLog, settings, windowDates, todayIso)
  const exerciseCandidates = generateExerciseTasks(chapters, deadlines, timetable, settings, windowDates, todayIso)
  const coveredChapterIds = new Set([...memoCandidates, ...exerciseCandidates].map((c) => c.chapterId))
  const fallbackCandidates = generateFallbackTasks(chapters, deadlines, todayIso, settings, coveredChapterIds)

  const byDate = new Map<string, Candidate[]>()
  for (const c of [...memoCandidates, ...exerciseCandidates, ...fallbackCandidates]) {
    if (!windowDates.includes(c.date)) continue
    const list = byDate.get(c.date) ?? []
    list.push(c)
    byDate.set(c.date, list)
  }

  const plan: Record<string, PlanItem[]> = {}
  for (const date of windowDates) {
    const candidates = dedupe(byDate.get(date) ?? [])
    plan[date] = allocateDay(candidates, availabilityByDate[date] ?? 0)
  }
  return plan
}
