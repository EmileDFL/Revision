import type { AlgoSettings, Chapter, Deadline } from './types'

export interface PlanItem {
  chapterId: string
  subjectId: string
  minutes: number
  score: number
  reason: string
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`)
  const to = new Date(`${toIso}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** Nearest upcoming (or today) deadline covering this chapter, if any. */
function nearestDeadlineFor(chapterId: string, deadlines: Deadline[], todayIso: string): Deadline | null {
  let best: Deadline | null = null
  let bestDays = Infinity
  for (const d of deadlines) {
    if (!d.chapterIds.includes(chapterId)) continue
    const days = daysBetween(todayIso, d.date)
    if (days < 0) continue // past deadline, ignore
    if (days < bestDays) {
      bestDays = days
      best = d
    }
  }
  return best
}

function scoreChapter(
  chapter: Chapter,
  deadlines: Deadline[],
  todayIso: string,
  weights: AlgoSettings['weights'],
): { score: number; reason: string } {
  const statusWeight = weights[chapter.status]
  const nearest = nearestDeadlineFor(chapter.id, deadlines, todayIso)

  if (nearest) {
    const days = Math.max(0, daysBetween(todayIso, nearest.date))
    const urgency = 1 / (days + 1)
    const reason =
      days === 0
        ? `échéance aujourd'hui : ${nearest.title}`
        : `échéance dans ${days} j : ${nearest.title}`
    return { score: urgency * statusWeight, reason }
  }

  // No deadline covers this chapter: small baseline urgency so it can still
  // surface, mainly driven by its status (e.g. "faible").
  const baseline = 0.05
  return { score: baseline * statusWeight, reason: 'pas d\'échéance liée' }
}

export interface ComputePlanParams {
  chapters: Chapter[]
  deadlines: Deadline[]
  todayIso: string
  minutesAvailable: number
  settings: AlgoSettings
}

/**
 * Deterministic, local algorithm: ranks chapters by urgency (closer deadline
 * + "faible" status boost) and greedily fills the day's available time in
 * fixed-size blocks. No AI involved — purely a function of the user's data.
 */
export function computeTodayPlan(params: ComputePlanParams): PlanItem[] {
  const { chapters, deadlines, todayIso, minutesAvailable, settings } = params
  if (minutesAvailable <= 0 || chapters.length === 0) return []

  const blockMinutes = Math.max(5, settings.blockMinutes)
  const numBlocks = Math.floor(minutesAvailable / blockMinutes)
  const remainder = minutesAvailable - numBlocks * blockMinutes
  if (numBlocks === 0) return []

  const ranked = chapters
    .filter((c) => c.status !== 'maitrise' || nearestDeadlineFor(c.id, deadlines, todayIso))
    .map((chapter) => {
      const { score, reason } = scoreChapter(chapter, deadlines, todayIso, settings.weights)
      return { chapter, score, reason }
    })
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return []

  // Guard rail: make sure every subject with a deadline inside the horizon
  // is represented at least once, by pulling its top chapter to the front.
  const horizonSubjects = new Set(
    deadlines
      .filter((d) => {
        const days = daysBetween(todayIso, d.date)
        return days >= 0 && days <= settings.horizonDays
      })
      .map((d) => d.subjectId),
  )
  const guaranteed = [...horizonSubjects]
    .map((subjectId) => ranked.find((r) => r.chapter.subjectId === subjectId))
    .filter((r): r is (typeof ranked)[number] => Boolean(r))

  const orderedUnique = [...guaranteed]
  for (const r of ranked) {
    if (!orderedUnique.includes(r)) orderedUnique.push(r)
  }

  const plan: PlanItem[] = []
  for (let i = 0; i < numBlocks; i++) {
    const pick = orderedUnique[i % orderedUnique.length]
    const existing = plan.find((p) => p.chapterId === pick.chapter.id)
    if (existing) {
      existing.minutes += blockMinutes
    } else {
      plan.push({
        chapterId: pick.chapter.id,
        subjectId: pick.chapter.subjectId,
        minutes: blockMinutes,
        score: pick.score,
        reason: pick.reason,
      })
    }
  }

  if (remainder > 0 && plan.length > 0) {
    plan[0].minutes += remainder
  }

  return plan.sort((a, b) => b.score - a.score)
}
