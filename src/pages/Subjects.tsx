import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { newId } from '../lib/id'
import { STATUS_LABELS } from '../lib/types'
import type { Chapter, ChapterStatus, Subject } from '../lib/types'

const STATUS_ORDER: ChapterStatus[] = ['a_faire', 'en_cours', 'faible', 'maitrise']
const NEW_SUBJECT_COLOR = '#4338ca'

export default function Subjects() {
  const { store } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null)

  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState(NEW_SUBJECT_COLOR)
  const [newChapterTitle, setNewChapterTitle] = useState<Record<string, string>>({})

  async function refresh() {
    const [s, c] = await Promise.all([store.listSubjects(), store.listChapters()])
    setSubjects(s)
    setChapters(c)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [store])

  const chaptersBySubject = useMemo(() => {
    const map = new Map<string, Chapter[]>()
    for (const c of chapters) {
      const list = map.get(c.subjectId) ?? []
      list.push(c)
      map.set(c.subjectId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.orderIndex - b.orderIndex)
    return map
  }, [chapters])

  async function addSubject() {
    if (!newSubjectName.trim()) return
    const subject: Subject = { id: newId(), name: newSubjectName.trim(), color: newSubjectColor }
    await store.upsertSubject(subject)
    setNewSubjectName('')
    setOpenSubjectId(subject.id)
    await refresh()
  }

  async function deleteSubject(id: string) {
    if (!confirm('Supprimer cette matière et tous ses chapitres ?')) return
    await store.deleteSubject(id)
    await refresh()
  }

  async function addChapter(subjectId: string) {
    const title = (newChapterTitle[subjectId] ?? '').trim()
    if (!title) return
    const existing = chaptersBySubject.get(subjectId) ?? []
    const chapter: Chapter = {
      id: newId(),
      subjectId,
      title,
      orderIndex: existing.length,
      status: 'a_faire',
      notes: '',
    }
    await store.upsertChapter(chapter)
    setNewChapterTitle((prev) => ({ ...prev, [subjectId]: '' }))
    await refresh()
  }

  async function setStatus(chapter: Chapter, status: ChapterStatus) {
    await store.upsertChapter({ ...chapter, status })
    await refresh()
  }

  async function deleteChapter(id: string) {
    await store.deleteChapter(id)
    await refresh()
  }

  if (loading) return <div className="empty-state">Chargement…</div>

  return (
    <div>
      <h1>Mes matières</h1>
      <p className="subtitle">Gère tes matières, tes chapitres et leur statut.</p>

      <div className="card">
        <h2>Nouvelle matière</h2>
        <div className="row">
          <input
            type="text"
            placeholder="Ex : Mathématiques"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="color"
            value={newSubjectColor}
            onChange={(e) => setNewSubjectColor(e.target.value)}
          />
          <button onClick={addSubject}>Ajouter</button>
        </div>
      </div>

      {subjects.length === 0 && <p className="empty-state">Aucune matière pour l’instant.</p>}

      {subjects.map((subject) => {
        const subjectChapters = chaptersBySubject.get(subject.id) ?? []
        const isOpen = openSubjectId === subject.id
        return (
          <div className="card" key={subject.id}>
            <div className="row-between" onClick={() => setOpenSubjectId(isOpen ? null : subject.id)} style={{ cursor: 'pointer' }}>
              <div className="row">
                <span className="badge" style={{ background: subject.color }}>
                  {subject.name}
                </span>
                <span className="subtitle" style={{ margin: 0 }}>
                  {subjectChapters.length} chapitre{subjectChapters.length > 1 ? 's' : ''}
                </span>
              </div>
              <span>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12 }}>
                {subjectChapters.map((chapter) => (
                  <div key={chapter.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                    <div className="row-between">
                      <span>{chapter.title}</span>
                      <button className="ghost" onClick={() => deleteChapter(chapter.id)} style={{ minHeight: 32, padding: '4px 10px' }}>
                        Suppr.
                      </button>
                    </div>
                    <div className="status-pills" style={{ marginTop: 6 }}>
                      {STATUS_ORDER.map((status) => (
                        <button
                          key={status}
                          className={'status-pill' + (chapter.status === status ? ' status-pill--active' : '')}
                          style={chapter.status === status ? { background: `var(--color-${status})` } : undefined}
                          onClick={() => setStatus(chapter, status)}
                        >
                          {STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="row">
                  <input
                    type="text"
                    placeholder="Nouveau chapitre"
                    value={newChapterTitle[subject.id] ?? ''}
                    onChange={(e) => setNewChapterTitle((prev) => ({ ...prev, [subject.id]: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => addChapter(subject.id)}>Ajouter</button>
                </div>

                <button className="danger" style={{ marginTop: 12 }} onClick={() => deleteSubject(subject.id)}>
                  Supprimer la matière
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
