import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { newId, todayIso } from '../lib/id'
import { DEADLINE_TYPE_LABELS } from '../lib/types'
import type { Chapter, Deadline, DeadlineType, Homework, Subject } from '../lib/types'

const TYPE_ORDER: DeadlineType[] = ['devoir', 'controle', 'bac_blanc', 'oral', 'autre']

function daysUntil(dateIso: string): number {
  return Math.round((new Date(`${dateIso}T00:00:00`).getTime() - new Date(`${todayIso()}T00:00:00`).getTime()) / 86_400_000)
}

function daysUntilLabel(days: number): string {
  return days < 0 ? 'passé' : days === 0 ? "aujourd'hui" : `dans ${days} j`
}

export default function Deadlines() {
  const { store } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [homework, setHomework] = useState<Homework[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showHomeworkForm, setShowHomeworkForm] = useState(false)

  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [type, setType] = useState<DeadlineType>('devoir')
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())

  const [hwTitle, setHwTitle] = useState('')
  const [hwSubjectId, setHwSubjectId] = useState('')
  const [hwChapterId, setHwChapterId] = useState('')
  const [hwDueDate, setHwDueDate] = useState(todayIso())
  const [hwMinutes, setHwMinutes] = useState(30)

  async function refresh() {
    const [s, c, d, hw] = await Promise.all([
      store.listSubjects(),
      store.listChapters(),
      store.listDeadlines(),
      store.listAllHomework(),
    ])
    setSubjects(s)
    setChapters(c)
    setDeadlines(d.slice().sort((a, b) => a.date.localeCompare(b.date)))
    setHomework(hw.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
    setLoading(false)
    if (!subjectId && s.length > 0) setSubjectId(s[0].id)
    if (!hwSubjectId && s.length > 0) setHwSubjectId(s[0].id)
  }

  useEffect(() => {
    refresh()
  }, [store])

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const chaptersForSubject = useMemo(
    () => chapters.filter((c) => c.subjectId === subjectId).sort((a, b) => a.orderIndex - b.orderIndex),
    [chapters, subjectId],
  )
  const chaptersForHwSubject = useMemo(
    () => chapters.filter((c) => c.subjectId === hwSubjectId).sort((a, b) => a.orderIndex - b.orderIndex),
    [chapters, hwSubjectId],
  )
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])

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

  async function addHomework() {
    if (!hwTitle.trim() || !hwSubjectId || !hwDueDate) return
    const hw: Homework = {
      id: newId(),
      subjectId: hwSubjectId,
      chapterId: hwChapterId || null,
      title: hwTitle.trim(),
      dueDate: hwDueDate,
      estimatedMinutes: hwMinutes,
      done: false,
      doneAt: null,
      notes: '',
    }
    await store.upsertHomework(hw)
    setHwTitle('')
    setHwChapterId('')
    setShowHomeworkForm(false)
    await refresh()
  }

  async function toggleHomeworkDone(hw: Homework) {
    const done = !hw.done
    await store.upsertHomework({ ...hw, done, doneAt: done ? todayIso() : null })
    await refresh()
  }

  async function deleteHomework(id: string) {
    await store.deleteHomework(id)
    await refresh()
  }

  if (loading) return <div className="empty-state">Chargement…</div>

  return (
    <div>
      <h1>Échéances</h1>
      <p className="subtitle">Devoirs sur table, contrôles, bac blanc, oraux…</p>

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
                {daysUntilLabel(days)}
              </div>
            </div>
            <button className="ghost" onClick={() => deleteDeadline(d.id)} style={{ minHeight: 32, padding: '4px 10px' }}>
              Suppr.
            </button>
          </div>
        )
      })}

      <h2 style={{ marginTop: 28 }}>Devoirs à faire</h2>
      <p className="subtitle">Exercices, DM, exposés — tout ce qu’il faut faire (pas apprendre) avant une date.</p>

      {!showHomeworkForm && (
        <button onClick={() => setShowHomeworkForm(true)} disabled={subjects.length === 0}>
          + Ajouter un devoir
        </button>
      )}

      {showHomeworkForm && (
        <div className="card">
          <div className="field">
            <label>Titre</label>
            <input
              type="text"
              value={hwTitle}
              onChange={(e) => setHwTitle(e.target.value)}
              placeholder="Ex : Exercices p.45 n°3-8"
            />
          </div>
          <div className="field">
            <label>Matière</label>
            <select
              value={hwSubjectId}
              onChange={(e) => {
                setHwSubjectId(e.target.value)
                setHwChapterId('')
              }}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {chaptersForHwSubject.length > 0 && (
            <div className="field">
              <label>Chapitre concerné (optionnel)</label>
              <select value={hwChapterId} onChange={(e) => setHwChapterId(e.target.value)}>
                <option value="">— aucun —</option>
                {chaptersForHwSubject.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>À rendre / à faire pour le</label>
            <input type="date" value={hwDueDate} onChange={(e) => setHwDueDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Temps estimé (minutes)</label>
            <input
              type="number"
              min={5}
              step={5}
              value={hwMinutes}
              onChange={(e) => setHwMinutes(Number(e.target.value) || 5)}
            />
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button onClick={addHomework}>Enregistrer</button>
            <button className="ghost" onClick={() => setShowHomeworkForm(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {homework.length === 0 && !showHomeworkForm && <p className="empty-state">Aucun devoir pour l’instant.</p>}

      {homework.map((hw) => {
        const subject = subjectById.get(hw.subjectId)
        const days = daysUntil(hw.dueDate)
        return (
          <div className="card plan-item" key={hw.id}>
            <button
              className={'plan-item__check' + (hw.done ? ' plan-item__check--done' : '')}
              onClick={() => toggleHomeworkDone(hw)}
              aria-label={hw.done ? 'Marquer comme non fait' : 'Marquer comme fait'}
            >
              {hw.done ? '✓' : ''}
            </button>
            <div style={{ flex: 1 }}>
              <div className="row-between">
                <span style={{ textDecoration: hw.done ? 'line-through' : 'none' }}>
                  <strong>{hw.title}</strong>
                </span>
                <span className="badge" style={{ background: subject?.color ?? '#6b7280' }}>
                  {subject?.name ?? '—'}
                </span>
              </div>
              <div className="plan-item__meta">
                {hw.estimatedMinutes} min · à faire pour le {new Date(`${hw.dueDate}T00:00:00`).toLocaleDateString('fr-FR')} ·{' '}
                {daysUntilLabel(days)}
                {hw.chapterId && chapterById.get(hw.chapterId) ? ` · ${chapterById.get(hw.chapterId)?.title}` : ''}
              </div>
            </div>
            <button
              className="ghost"
              onClick={() => deleteHomework(hw.id)}
              style={{ minHeight: 32, padding: '4px 10px', flexShrink: 0 }}
            >
              Suppr.
            </button>
          </div>
        )
      })}
    </div>
  )
}
