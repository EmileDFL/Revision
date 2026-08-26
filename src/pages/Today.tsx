import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { newId, todayIso } from '../lib/id'
import { computeTodayPlan, type PlanItem } from '../lib/scheduler'
import { DEFAULT_SETTINGS } from '../lib/types'
import type { AlgoSettings, Chapter, Deadline, StudyLogEntry, Subject } from '../lib/types'

export default function Today() {
  const { store } = useAuth()
  const today = useMemo(() => todayIso(), [])

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [settings, setSettings] = useState<AlgoSettings>(DEFAULT_SETTINGS)
  const [minutes, setMinutes] = useState(0)
  const [log, setLog] = useState<StudyLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [s, c, d, settingsRes, avail, l] = await Promise.all([
        store.listSubjects(),
        store.listChapters(),
        store.listDeadlines(),
        store.getSettings(),
        store.getAvailability(today),
        store.listStudyLog(today),
      ])
      if (cancelled) return
      setSubjects(s)
      setChapters(c)
      setDeadlines(d)
      setSettings(settingsRes)
      setMinutes(avail)
      setLog(l)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [store, today])

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])

  const plan: PlanItem[] = useMemo(
    () =>
      computeTodayPlan({
        chapters,
        deadlines,
        todayIso: today,
        minutesAvailable: minutes,
        settings,
      }),
    [chapters, deadlines, today, minutes, settings],
  )

  async function handleMinutesChange(value: number) {
    setMinutes(value)
    await store.setAvailability(today, value)
  }

  async function toggleDone(item: PlanItem) {
    const existing = log.find((l) => l.chapterId === item.chapterId)
    const entry: StudyLogEntry = existing
      ? { ...existing, done: !existing.done }
      : { id: newId(), chapterId: item.chapterId, date: today, minutesSpent: item.minutes, done: true }
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

  if (loading) return <div className="empty-state">Chargement…</div>

  return (
    <div>
      <h1>Aujourd’hui</h1>
      <p className="subtitle">
        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      <div className="card">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="minutes">Temps disponible aujourd’hui (minutes)</label>
          <input
            id="minutes"
            type="number"
            min={0}
            step={5}
            value={minutes}
            onChange={(e) => handleMinutesChange(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {chapters.length === 0 ? (
        <p className="empty-state">
          Aucun chapitre pour l’instant. Ajoute tes matières et chapitres dans l’onglet « Matières » ou
          importe un fichier dans « Importer ».
        </p>
      ) : minutes <= 0 ? (
        <p className="empty-state">Indique ton temps disponible pour voir ton plan du jour.</p>
      ) : plan.length === 0 ? (
        <p className="empty-state">Rien à réviser pour l’instant — tout est maîtrisé sans échéance proche.</p>
      ) : (
        <div>
          <h2>Plan du jour</h2>
          {plan.map((item) => {
            const chapter = chapterById.get(item.chapterId)
            const subject = chapter ? subjectById.get(chapter.subjectId) : undefined
            const done = log.find((l) => l.chapterId === item.chapterId)?.done ?? false
            if (!chapter) return null
            return (
              <div className="card plan-item" key={item.chapterId}>
                <button
                  className={'plan-item__check' + (done ? ' plan-item__check--done' : '')}
                  onClick={() => toggleDone(item)}
                  aria-label={done ? 'Marquer comme non fait' : 'Marquer comme fait'}
                >
                  {done ? '✓' : ''}
                </button>
                <div style={{ flex: 1 }}>
                  <div className="row-between">
                    <strong style={{ textDecoration: done ? 'line-through' : 'none' }}>{chapter.title}</strong>
                    <span className="badge" style={{ background: subject?.color ?? '#6b7280' }}>
                      {subject?.name ?? '—'}
                    </span>
                  </div>
                  <div className="plan-item__meta">
                    {item.minutes} min · {item.reason}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
