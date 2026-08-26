import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { newId, todayIso } from '../lib/id'
import { DEADLINE_TYPE_LABELS } from '../lib/types'
import type { Chapter, Deadline, DeadlineType, Subject } from '../lib/types'

const TYPE_ORDER: DeadlineType[] = ['devoir', 'controle', 'bac_blanc', 'oral', 'autre']

export default function Deadlines() {
  const { store } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [type, setType] = useState<DeadlineType>('devoir')
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())

  async function refresh() {
    const [s, c, d] = await Promise.all([store.listSubjects(), store.listChapters(), store.listDeadlines()])
    setSubjects(s)
    setChapters(c)
    setDeadlines(d.slice().sort((a, b) => a.date.localeCompare(b.date)))
    setLoading(false)
    if (!subjectId && s.length > 0) setSubjectId(s[0].id)
  }

  useEffect(() => {
    refresh()
  }, [store])

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const chaptersForSubject = useMemo(
    () => chapters.filter((c) => c.subjectId === subjectId).sort((a, b) => a.orderIndex - b.orderIndex),
    [chapters, subjectId],
  )

  function toggleChapter(id: string) {
    setSelectedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function addDeadline() {
    if (!title.trim() || !subjectId || !date) return
    const deadline: Deadline = {
      id: newId(),
      subjectId,
      title: title.trim(),
      date,
      type,
      chapterIds: [...selectedChapters],
    }
    await store.upsertDeadline(deadline)
    setTitle('')
    setSelectedChapters(new Set())
    setShowForm(false)
    await refresh()
  }

  async function deleteDeadline(id: string) {
    await store.deleteDeadline(id)
    await refresh()
  }

  function daysUntil(dateIso: string): number {
    return Math.round((new Date(`${dateIso}T00:00:00`).getTime() - new Date(`${todayIso()}T00:00:00`).getTime()) / 86_400_000)
  }

  if (loading) return <div className="empty-state">Chargement…</div>

  return (
    <div>
      <h1>Échéances</h1>
      <p className="subtitle">Devoirs, contrôles, bac blanc, oraux…</p>

      {!showForm && (
        <button onClick={() => setShowForm(true)} disabled={subjects.length === 0}>
          + Ajouter une échéance
        </button>
      )}
      {subjects.length === 0 && <p className="empty-state">Ajoute d’abord une matière dans l’onglet « Matières ».</p>}

      {showForm && (
        <div className="card">
          <div className="field">
            <label>Titre</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : DS n°3" />
          </div>
          <div className="field">
            <label>Matière</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as DeadlineType)}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {DEADLINE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {chaptersForSubject.length > 0 && (
            <div className="field">
              <label>Chapitres concernés</label>
              <div className="status-pills">
                {chaptersForSubject.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={'status-pill' + (selectedChapters.has(c.id) ? ' status-pill--active' : '')}
                    style={selectedChapters.has(c.id) ? { background: 'var(--color-primary)' } : undefined}
                    onClick={() => toggleChapter(c.id)}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="row">
            <button onClick={addDeadline}>Enregistrer</button>
            <button className="ghost" onClick={() => setShowForm(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {deadlines.length === 0 && !showForm && <p className="empty-state">Aucune échéance pour l’instant.</p>}

      {deadlines.map((d) => {
        const subject = subjectById.get(d.subjectId)
        const days = daysUntil(d.date)
        return (
          <div className="card row-between" key={d.id}>
            <div>
              <div className="row">
                <strong>{d.title}</strong>
                <span className="badge" style={{ background: subject?.color ?? '#6b7280' }}>
                  {subject?.name ?? '—'}
                </span>
              </div>
              <div className="plan-item__meta">
                {DEADLINE_TYPE_LABELS[d.type]} · {new Date(`${d.date}T00:00:00`).toLocaleDateString('fr-FR')} ·{' '}
                {days < 0 ? 'passé' : days === 0 ? "aujourd'hui" : `dans ${days} j`}
              </div>
            </div>
            <button className="ghost" onClick={() => deleteDeadline(d.id)} style={{ minHeight: 32, padding: '4px 10px' }}>
              Suppr.
            </button>
          </div>
        )
      })}
    </div>
  )
}
