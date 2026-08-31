import type {
  AlgoSettings,
  Chapter,
  Deadline,
  Homework,
  PlanKind,
  PlanOverride,
  StudyLogEntry,
  Subject,
  TimetableSlot,
  WeekAnchor,
} from './types'

/** Points de priorité ajoutés par point de coefficient — assez petit pour
 * ne jamais faire sauter un chapitre d'un palier de priorité à l'autre
 * (le plus petit écart entre paliers est 5000), juste pour départager
 * finement entre matières à enjeu différent. */
const COEFFICIENT_BONUS_PER_POINT = 20

export interface PlanItem {
  chapterId: string | null
  homeworkId: string | null
  subjectId: string
  minutes: number
  score: number
  reason: string
  kind: PlanKind
  milestoneIndex: number | null
  /** Present only for a manually-added task — lets the UI remove it
   * directly instead of dismissing an auto-generated suggestion. */
  overrideId: string | null
}

interface Candidate {
  chapterId: string | null
  homeworkId: string | null
  subjectId: string
  date: string
  kind: PlanKind
  minutes: number
  priority: number
  reason: string
  milestoneIndex: number | null
  overrideId: string | null
}

function refKey(c: { chapterId: string | null; homeworkId: string | null }): string {
  return c.chapterId ?? c.homeworkId ?? ''
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
      homeworkId: null,
      subjectId: chapter.subjectId,
      date: progress.dueDate,
      kind: 'memorisation',
      minutes: settings.memoBlockMinutes,
      priority: tier * 1000,
      reason: progress.overdue ? `En retard — ${reason}` : reason,
      milestoneIndex: progress.nextMilestoneIndex,
      overrideId: null,
    })
  }

  return out
}

/** Minutes déjà "couvertes" par chapitre par des devoirs faits récemment et
 * liés à ce chapitre — vient réduire (jamais s'additionner à) les séances
 * d'exercices que l'algo proposerait sinon pour ce chapitre. Appliqué plus
 * tard, jour par jour dans l'ordre calendaire, sur les tâches déjà
 * dédupliquées (celles réellement affichées) — pas sur la liste brute de
 * candidats, pour que ce soit prévisible : ça mange d'abord la séance la
 * plus proche que tu vois vraiment dans ta semaine. */
function homeworkCreditByChapter(homework: Homework[], settings: AlgoSettings, todayIso: string): Map<string, number> {
  const credit = new Map<string, number>()
  for (const hw of homework) {
    if (!hw.chapterId || !hw.done || !hw.doneAt) continue
    const age = daysBetween(hw.doneAt, todayIso)
    if (age < 0 || age > settings.homeworkCreditWindowDays) continue
    credit.set(hw.chapterId, (credit.get(hw.chapterId) ?? 0) + hw.estimatedMinutes)
  }
  return credit
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
          homeworkId: null,
          subjectId: chapter.subjectId,
          date: firstClass,
          kind: 'exercice',
          minutes: Math.max(10, Math.round(settings.blockMinutes / 2)),
          priority: 50 * 1000,
          reason: 'petite séance de préparation avant le début du cours',
          milestoneIndex: null,
          overrideId: null,
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
            homeworkId: null,
            subjectId: chapter.subjectId,
            date,
            kind: 'exercice',
            minutes: settings.blockMinutes,
            priority: 60 * 1000,
            reason: 'exercices après le cours',
            milestoneIndex: null,
            overrideId: null,
          })
        }
        const tomorrow = addDays(date, 1)
        if (isClassDay(chapter.subjectId, tomorrow, timetable, settings.weekAnchor)) {
          out.push({
            chapterId: chapter.id,
            homeworkId: null,
            subjectId: chapter.subjectId,
            date,
            kind: 'exercice',
            minutes: settings.blockMinutes,
            priority: 55 * 1000,
            reason: 'exercices avant le prochain cours',
            milestoneIndex: null,
            overrideId: null,
          })
        }
      }
    }

    for (const date of windowDates) {
      const weekday = isoWeekday(date)
      if (chapter.status !== 'maitrise' && (weekday === 6 || weekday === 7)) {
        out.push({
          chapterId: chapter.id,
          homeworkId: null,
          subjectId: chapter.subjectId,
          date,
          kind: 'exercice',
          minutes: settings.blockMinutes,
          priority: 40 * 1000,
          reason: 'exercices du week-end',
          milestoneIndex: null,
          overrideId: null,
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
          homeworkId: null,
          subjectId: chapter.subjectId,
          date: d,
          kind: 'exercice',
          minutes: isLast ? Math.max(10, Math.round(settings.blockMinutes / 2)) : settings.blockMinutes,
          priority: (isLast ? 75 : 85) * 1000,
          reason: isLast
            ? `révision légère avant éval : ${nearest.title}`
            : `exercices avant éval (J-${daysBefore}) : ${nearest.title}`,
          milestoneIndex: null,
          overrideId: null,
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
      homeworkId: null,
      subjectId: chapter.subjectId,
      date: todayIso,
      kind: 'generic',
      minutes: settings.blockMinutes,
      priority: 10 * 1000 + urgency * 100,
      reason,
      milestoneIndex: null,
      overrideId: null,
    })
  }
  return out
}

/** Devoir maison / exercices / exposé : contrairement à un chapitre, ça ne
 * se répète pas — dès que c'est fait (Homework.done), ça disparaît partout.
 * Proposé chaque jour restant jusqu'à la date limite (comprise), pour
 * pouvoir s'y mettre en plusieurs fois plutôt qu'à la dernière minute. */
function generateHomeworkTasks(homework: Homework[], windowDates: string[], todayIso: string): Candidate[] {
  const out: Candidate[] = []
  for (const hw of homework) {
    if (hw.done) continue
    const due = hw.dueDate < todayIso ? todayIso : hw.dueDate
    for (const date of windowDates) {
      if (date > due) continue
      const daysUntilDue = Math.max(0, daysBetween(date, due))
      const urgency = 1 / (daysUntilDue + 1)
      // Un devoir a une échéance dure (contrairement à une révision, souple) :
      // il passe généralement devant le reste, jusqu'à dépasser même le
      // rattrapage mémorisation en retard (tier 100) quand il est très proche.
      const tier = 65 + urgency * 45 // 65 (loin) .. 110 (le jour même)
      out.push({
        chapterId: null,
        homeworkId: hw.id,
        subjectId: hw.subjectId,
        date,
        kind: 'devoir',
        minutes: homeworkBlockMinutes(hw),
        priority: Math.round(tier * 1000),
        reason: daysUntilDue === 0 ? `à rendre aujourd'hui : ${hw.title}` : `à faire avant le ${frDate(due)} : ${hw.title}`,
        milestoneIndex: null,
        overrideId: null,
      })
    }
  }
  return out
}

function homeworkBlockMinutes(hw: Homework): number {
  return Math.max(10, Math.min(hw.estimatedMinutes, 45))
}

function frDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function generateManualCandidates(chapters: Chapter[], overrides: PlanOverride[]): Candidate[] {
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const out: Candidate[] = []
  for (const o of overrides) {
    if (o.type !== 'manual' || !o.chapterId) continue
    const chapter = chapterById.get(o.chapterId)
    if (!chapter) continue
    out.push({
      chapterId: o.chapterId,
      homeworkId: null,
      subjectId: chapter.subjectId,
      date: o.date,
      kind: o.kind,
      minutes: o.minutes ?? 30,
      priority: 110 * 1000,
      reason: 'ajouté manuellement',
      milestoneIndex: null,
      overrideId: o.id,
    })
  }
  return out
}

/** Ajoute un petit bonus de priorité selon le coefficient au bac de la
 * matière de la tâche — un départage fin, jamais assez fort pour renverser
 * l'ordre des paliers (en retard > avant éval > etc.). */
function applyCoefficientBonus(candidates: Candidate[], subjects: Subject[]): Candidate[] {
  const coefficientBySubject = new Map(subjects.map((s) => [s.id, s.coefficient]))
  return candidates.map((c) => {
    const coefficient = coefficientBySubject.get(c.subjectId) ?? 1
    return { ...c, priority: c.priority + coefficient * COEFFICIENT_BONUS_PER_POINT }
  })
}

function dedupe(candidates: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>()
  for (const c of candidates) {
    const key = `${refKey(c)}|${c.kind}`
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
      homeworkId: c.homeworkId,
      subjectId: c.subjectId,
      minutes,
      score: c.priority,
      reason: c.reason,
      kind: c.kind,
      milestoneIndex: c.milestoneIndex,
      overrideId: c.overrideId,
    })
    remaining -= minutes
  }
  return result
}

export interface ComputeWeekPlanParams {
  chapters: Chapter[]
  subjects: Subject[]
  deadlines: Deadline[]
  homework: Homework[]
  timetable: TimetableSlot[]
  studyLog: StudyLogEntry[]
  overrides: PlanOverride[]
  todayIso: string
  availabilityByDate: Record<string, number>
  settings: AlgoSettings
}

/**
 * Deterministic, local algorithm — no AI involved. Produces a 7-day plan
 * (today included) from four task generators (mémorisation, exercice,
 * devoirs, filet de sécurité générique) merged by a single day-by-day
 * allocator, then adjusted by the user's manual overrides (tâches ajoutées
 * ou écartées) and un léger départage par coefficient de matière.
 */
export function computeWeekPlan(params: ComputeWeekPlanParams): Record<string, PlanItem[]> {
  const {
    chapters,
    subjects,
    deadlines,
    homework,
    timetable,
    studyLog,
    overrides,
    todayIso,
    availabilityByDate,
    settings,
  } = params
  const windowDates = Array.from({ length: 7 }, (_, i) => addDays(todayIso, i))

  const memoCandidates = generateMemorisationTasks(chapters, deadlines, studyLog, settings, windowDates, todayIso)
  const exerciseCandidates = generateExerciseTasks(chapters, deadlines, timetable, settings, windowDates, todayIso)
  const coveredChapterIds = new Set(
    [...memoCandidates, ...exerciseCandidates].map((c) => c.chapterId).filter((id): id is string => id !== null),
  )
  const fallbackCandidates = generateFallbackTasks(chapters, deadlines, todayIso, settings, coveredChapterIds)
  const homeworkCandidates = generateHomeworkTasks(homework, windowDates, todayIso)
  const manualCandidates = generateManualCandidates(chapters, overrides)

  const dismissedKeys = new Set(
    overrides.filter((o) => o.type === 'dismissed').map((o) => `${refKey(o)}|${o.kind}|${o.date}`),
  )

  const allCandidates = applyCoefficientBonus(
    [...memoCandidates, ...exerciseCandidates, ...fallbackCandidates, ...homeworkCandidates, ...manualCandidates],
    subjects,
  )

  const byDate = new Map<string, Candidate[]>()
  for (const c of allCandidates) {
    if (!windowDates.includes(c.date)) continue
    // Une tâche ajoutée manuellement (overrideId défini) n'est jamais
    // écartée par un "dismissed" — seules les suggestions automatiques le
    // sont.
    if (!c.overrideId && dismissedKeys.has(`${refKey(c)}|${c.kind}|${c.date}`)) continue
    const list = byDate.get(c.date) ?? []
    list.push(c)
    byDate.set(c.date, list)
  }

  // Le crédit devoir-fait est consommé jour par jour dans l'ordre calendaire,
  // sur les tâches déjà dédupliquées (celles réellement affichées) — la
  // séance d'exercice la plus proche que tu vois vraiment est mangée en
  // premier, jamais une variante interne écartée par la déduplication.
  const creditByChapter = homeworkCreditByChapter(homework, settings, todayIso)

  const plan: Record<string, PlanItem[]> = {}
  for (const date of windowDates) {
    const candidates = dedupe(byDate.get(date) ?? []).flatMap((c) => {
      if (c.kind !== 'exercice' || !c.chapterId) return [c]
      const remaining = creditByChapter.get(c.chapterId) ?? 0
      if (remaining <= 0) return [c]
      const used = Math.min(remaining, c.minutes)
      creditByChapter.set(c.chapterId, remaining - used)
      const minutes = c.minutes - used
      return minutes > 0 ? [{ ...c, minutes }] : []
    })
    plan[date] = allocateDay(candidates, availabilityByDate[date] ?? 0)
  }
  return plan
}
