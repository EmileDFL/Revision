import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { todayIso } from '../lib/id'
import { addDays, computeWeekPlan, type PlanItem } from '../lib/scheduler'
import { DEFAULT_SETTINGS } from '../lib/types'
import type {
  AlgoSettings,
  Chapter,
  Deadline,
  StudyLogEntry,
  Subject,
  TimetableSlot,
} from '../lib/types'

const KIND_LABELS: Record<PlanItem['kind'], string> = {
  memorisation: 'Mémorisation',
  exercice: 'Exercice',
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
  const [timetable, setTimetable] = useState<TimetableSlot[]>([])
  const [settings, setSettings] = useState<AlgoSettings>(DEFAULT_SETTINGS)
  const [availability, setAvailabilityState] = useState<Record<string, number>>({})
  const [log, setLog] = useState<StudyLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([today]))

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [s, c, d, t, settingsRes, l, availList] = await Promise.all([
        store.listSubjects(),
        store.listChapters(),
        store.listDeadlines(),
        store.listTimetable(),
        store.getSettings(),
        store.listAllStudyLog(),
        Promise.all(windowDates.map((date) => store.getAvailability(date))),
      ])
      if (cancelled) return
      setSubjects(s)
      setChapters(c)
      setDeadlines(d)
      setTimetable(t)
      setSettings(settingsRes)
      setLog(l)
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

  const plan = useMemo(
    () =>
      computeWeekPlan({
        chapters,
        deadlines,
        timetable,
        studyLog: log,
        todayIso: today,
        availabilityByDate: availability,
        settings,
      }),
    [chapters, deadlines, timetable, log, today, availability, settings],
  )

  async function handleMinutesChange(date: string, value: number) {
    setAvailabilityState((prev) => ({ ...prev, [date]: value }))
    await store.setAvailability(date, value)
  }

  function findLogEntry(item: PlanItem, date: string): StudyLogEntry | undefined {
    return log.find(
      (l) =>
        l.chapterId === item.chapterId &&
        l.kind === item.kind &&
        l.date === date &&
        l.milestoneIndex === item.milestoneIndex,
    )
  }

  async function toggleDone(item: PlanItem, date: string) {
    const existing = findLogEntry(item, date)
    const entry: StudyLogEntry = existing
      ? { ...existing, done: !existing.done }
      : {
          id: `${item.chapterId}__${item.kind}__${date}__${item.milestoneIndex ?? 'x'}`,
          chapterId: item.chapterId,
          date,
          minutesSpent: item.minutes,
          done: true,
          kind: item.kind,
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

      {chapters.length === 0 && (
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
                    const chapter = chapterById.get(item.chapterId)
                    const subject = chapter ? subjectById.get(chapter.subjectId) : undefined
                    const done = findLogEntry(item, date)?.done ?? false
                    if (!chapter) return null
                    return (
                      <div
                        className="plan-item"
                        key={`${item.chapterId}-${item.kind}`}
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
                              <strong>{chapter.title}</strong>
                            </span>
                            <span className="badge" style={{ background: subject?.color ?? '#6b7280' }}>
                              {subject?.name ?? '—'}
                            </span>
                          </div>
                          <div className="plan-item__meta">
                            {KIND_LABELS[item.kind]} · {item.minutes} min · {item.reason}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
