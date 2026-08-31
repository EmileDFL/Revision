import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { newId, todayIso } from '../lib/id'
import { addDays, computeWeekPlan, type PlanItem } from '../lib/scheduler'
import { DEFAULT_SETTINGS } from '../lib/types'
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
} from '../lib/types'

const KIND_LABELS: Record<PlanKind, string> = {
  memorisation: 'Mémorisation',
  exercice: 'Exercice',
  devoir: 'Devoir à faire',
  generic: 'Révision',
}

function dayHeading(dateIso: string, todayIsoValue: string): string {
  if (dateIso === todayIsoValue) return "Aujourd'hui"
  const label = new Date(`${dateIso}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function Today() {
  const { store } = useAuth()
  const today = useMemo(() => todayIso(), [])
  const windowDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today])

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [homework, setHomework] = useState<Homework[]>([])
  const [timetable, setTimetable] = useState<TimetableSlot[]>([])
  const [settings, setSettings] = useState<AlgoSettings>(DEFAULT_SETTINGS)
  const [availability, setAvailabilityState] = useState<Record<string, number>>({})
  const [log, setLog] = useState<StudyLogEntry[]>([])
  const [overrides, setOverrides] = useState<PlanOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([today]))
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const [addChapterId, setAddChapterId] = useState('')
  const [addMinutes, setAddMinutes] = useState(30)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [s, c, d, hw, t, settingsRes, l, ov, availList] = await Promise.all([
        store.listSubjects(),
        store.listChapters(),
        store.listDeadlines(),
        store.listAllHomework(),
        store.listTimetable(),
        store.getSettings(),
        store.listAllStudyLog(),
        store.listAllPlanOverrides(),
        Promise.all(windowDates.map((date) => store.getAvailability(date))),
      ])
      if (cancelled) return
      setSubjects(s)
      setChapters(c)
      setDeadlines(d)
      setHomework(hw)
      setTimetable(t)
      setSettings(settingsRes)
      setLog(l)
      setOverrides(ov)
      const availMap: Record<string, number> = {}
      windowDates.forEach((date, i) => {
        availMap[date] = availList[i]
      })
      setAvailabilityState(availMap)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [store, windowDates])

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])
  const homeworkById = useMemo(() => new Map(homework.map((h) => [h.id, h])), [homework])

  const plan = useMemo(
    () =>
      computeWeekPlan({
        chapters,
        subjects,
        deadlines,
        homework,
        timetable,
        studyLog: log,
        overrides,
        todayIso: today,
        availabilityByDate: availability,
        settings,
      }),
    [chapters, subjects, deadlines, homework, timetable, log, overrides, today, availability, settings],
  )

  async function handleMinutesChange(date: string, value: number) {
    setAvailabilityState((prev) => ({ ...prev, [date]: value }))
    await store.setAvailability(date, value)
  }

  function findLogEntry(item: PlanItem, date: string): StudyLogEntry | undefined {
    if (!item.chapterId) return undefined
    return log.find(
      (l) =>
        l.chapterId === item.chapterId &&
        l.kind === item.kind &&
        l.date === date &&
        l.milestoneIndex === item.milestoneIndex,
    )
  }

  function isDone(item: PlanItem, date: string): boolean {
    if (item.homeworkId) return homeworkById.get(item.homeworkId)?.done ?? false
    return findLogEntry(item, date)?.done ?? false
  }

  async function toggleDone(item: PlanItem, date: string) {
    if (item.homeworkId) {
      const hw = homeworkById.get(item.homeworkId)
      if (!hw) return
      const updated: Homework = { ...hw, done: !hw.done }
      await store.upsertHomework(updated)
      setHomework((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
      return
    }
    const existing = findLogEntry(item, date)
    const entry: StudyLogEntry = existing
      ? { ...existing, done: !existing.done }
      : {
          id: `${item.chapterId}__${item.kind}__${date}__${item.milestoneIndex ?? 'x'}`,
          chapterId: item.chapterId as string,
          date,
          minutesSpent: item.minutes,
          done: true,
          // sûr : les items "devoir" (seul kind hors StudyLogKind) sont
          // traités par la branche homeworkId ci-dessus, jamais ici.
          kind: item.kind as StudyLogEntry['kind'],
          milestoneIndex: item.milestoneIndex,
        }
    await store.upsertStudyLog(entry)
    setLog((prev) => {
      const idx = prev.findIndex((l) => l.id === entry.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = entry
        return copy
      }
      return [...prev, entry]
    })
  }

  async function dismissItem(item: PlanItem, date: string) {
    if (item.overrideId) {
      await store.deletePlanOverride(item.overrideId)
      setOverrides((prev) => prev.filter((o) => o.id !== item.overrideId))
      return
    }
    const override: PlanOverride = {
      id: newId(),
      chapterId: item.chapterId,
      homeworkId: item.homeworkId,
      date,
      kind: item.kind,
      type: 'dismissed',
      minutes: null,
    }
    await store.upsertPlanOverride(override)
    setOverrides((prev) => [...prev, override])
  }

  function openAddForm(date: string) {
    setAddingDate(date)
    setAddChapterId(chapters[0]?.id ?? '')
    setAddMinutes(30)
  }

  async function confirmAdd(date: string) {
    if (!addChapterId) return
    const override: PlanOverride = {
      id: newId(),
      chapterId: addChapterId,
      homeworkId: null,
      date,
      kind: 'generic',
      type: 'manual',
      minutes: addMinutes,
    }
    await store.upsertPlanOverride(override)
    setOverrides((prev) => [...prev, override])
    setAddingDate(null)
  }

  function toggleExpanded(date: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  if (loading) return <div className="empty-state">Chargement…</div>

  return (
    <div>
      <h1>Semaine</h1>
      <p className="subtitle">Plan de révision généré pour les 7 prochains jours.</p>

      {chapters.length === 0 && homework.length === 0 && (
        <p className="empty-state">
          Aucun chapitre pour l’instant. Ajoute tes matières et chapitres dans l’onglet « Matières » ou
          importe un fichier dans « Importer ».
        </p>
      )}

      {windowDates.map((date) => {
        const items = plan[date] ?? []
        const totalMinutes = items.reduce((sum, i) => sum + i.minutes, 0)
        const isOpen = expanded.has(date)
        return (
          <div className="card" key={date}>
            <div className="row-between" style={{ cursor: 'pointer' }} onClick={() => toggleExpanded(date)}>
              <div>
                <strong>{dayHeading(date, today)}</strong>
                <div className="plan-item__meta">
                  {items.length === 0 ? 'Aucune tâche prévue' : `${items.length} tâche(s) · ${totalMinutes} min`}
                </div>
              </div>
              <input
                type="number"
                min={0}
                step={5}
                value={availability[date] ?? 0}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleMinutesChange(date, Number(e.target.value) || 0)}
                style={{ width: 72 }}
              />
            </div>

            {isOpen && (
              <div style={{ marginTop: 12 }}>
                {items.length === 0 ? (
                  <p className="plan-item__meta">
                    {(availability[date] ?? 0) <= 0
                      ? 'Indique le temps disponible pour voir des tâches.'
                      : 'Rien de prévu ce jour-là.'}
                  </p>
                ) : (
                  items.map((item) => {
                    const chapter = item.chapterId ? chapterById.get(item.chapterId) : undefined
                    const hw = item.homeworkId ? homeworkById.get(item.homeworkId) : undefined
                    const title = chapter?.title ?? hw?.title
                    const subject = subjectById.get(item.subjectId)
                    const done = isDone(item, date)
                    if (!title) return null
                    return (
                      <div
                        className="plan-item"
                        key={`${item.chapterId ?? item.homeworkId}-${item.kind}`}
                        style={{ marginBottom: 12 }}
                      >
                        <button
                          className={'plan-item__check' + (done ? ' plan-item__check--done' : '')}
                          onClick={() => toggleDone(item, date)}
                          aria-label={done ? 'Marquer comme non fait' : 'Marquer comme fait'}
                        >
                          {done ? '✓' : ''}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div className="row-between">
                            <span style={{ textDecoration: done ? 'line-through' : 'none' }}>
                              <strong>{title}</strong>
                            </span>
                            <span className="badge" style={{ background: subject?.color ?? '#6b7280' }}>
                              {subject?.name ?? '—'}
                            </span>
                          </div>
                          <div className="plan-item__meta">
                            {KIND_LABELS[item.kind]} · {item.minutes} min · {item.reason}
                          </div>
                        </div>
                        <button
                          className="ghost"
                          onClick={() => dismissItem(item, date)}
                          title={item.overrideId ? 'Retirer cette tâche ajoutée' : 'Écarter pour aujourd’hui'}
                          style={{ minHeight: 28, padding: '2px 8px', flexShrink: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })
                )}

                {addingDate === date ? (
                  <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                    <select value={addChapterId} onChange={(e) => setAddChapterId(e.target.value)} style={{ flex: 1 }}>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {subjectById.get(c.subjectId)?.name ?? '—'} — {c.title}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={addMinutes}
                      onChange={(e) => setAddMinutes(Number(e.target.value) || 5)}
                      style={{ width: 72 }}
                    />
                    <button onClick={() => confirmAdd(date)}>Ajouter</button>
                    <button className="ghost" onClick={() => setAddingDate(null)}>
                      Annuler
                    </button>
                  </div>
                ) : (
                  chapters.length > 0 && (
                    <button className="secondary" style={{ marginTop: 8 }} onClick={() => openAddForm(date)}>
                      + Ajouter une tâche
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
