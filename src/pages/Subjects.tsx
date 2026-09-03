import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { newId, todayIso } from '../lib/id'
import { computeMemoProgress, daysBetween, memoMilestoneLabel } from '../lib/scheduler'
import { COURSE_STAGE_LABELS, DEFAULT_SETTINGS, STATUS_LABELS, WORK_MODE_LABELS } from '../lib/types'
import type { AlgoSettings, Chapter, ChapterStatus, CourseStage, Deadline, StudyLogEntry, Subject, WorkMode } from '../lib/types'

const STATUS_ORDER: ChapterStatus[] = ['a_faire', 'en_cours', 'faible', 'maitrise']
const WORK_MODE_ORDER: WorkMode[] = ['mixte', 'memorisation', 'exercice']
const COURSE_STAGE_ORDER: CourseStage[] = ['a_venir', 'en_cours', 'termine']
const NEW_SUBJECT_COLOR = '#4338ca'

export default function Subjects() {
  const { store } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [studyLog, setStudyLog] = useState<StudyLogEntry[]>([])
  const [settings, setSettings] = useState<AlgoSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null)

  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState(NEW_SUBJECT_COLOR)
  const [newSubjectCoefficient, setNewSubjectCoefficient] = useState(1)
  const [newChapterTitle, setNewChapterTitle] = useState<Record<string, string>>({})

  async function refresh() {
    const [s, c, d, log, settingsRes] = await Promise.all([
      store.listSubjects(),
      store.listChapters(),
      store.listDeadlines(),
      store.listAllStudyLog(),
      store.getSettings(),
    ])
    setSubjects(s)
    setChapters(c)
    setDeadlines(d)
    setStudyLog(log)
    setSettings(settingsRes)
    setLoading(false)
  }

  const today = useMemo(() => todayIso(), [])

  function memoProgressLabel(chapter: Chapter): string | null {
    const progress = computeMemoProgress(chapter, deadlines, studyLog, settings, today)
    if (!progress) return null
    const palier =
      progress.nextMilestoneIndex !== null
        ? `palier ${progress.nextMilestoneIndex + 1}/${progress.totalMilestones} (${memoMilestoneLabel(settings.memoIntervalsDays[progress.nextMilestoneIndex])})`
        : "phase d'entretien"
    if (progress.overdue) {
      const late = daysBetween(progress.dueDate, today)
      return `Mémorisation : ${palier} · en retard${late > 0 ? ` de ${late} j` : ''}`
    }
    const inDays = daysBetween(today, progress.dueDate)
    const when = inDays === 0 ? "aujourd'hui" : inDays === 1 ? 'demain' : `dans ${inDays} j`
    const evalNote = progress.cappedByEvalTitle ? ` (avant « ${progress.cappedByEvalTitle} »)` : ''
    return `Mémorisation : ${palier} · prochain rappel ${when}${evalNote}`
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
    const subject: Subject = {
      id: newId(),
      name: newSubjectName.trim(),
      color: newSubjectColor,
      coefficient: newSubjectCoefficient,
    }
    await store.upsertSubject(subject)
    setNewSubjectName('')
    setNewSubjectCoefficient(1)
    setOpenSubjectId(subject.id)
    await refresh()
  }

  async function setSubjectCoefficient(subject: Subject, coefficient: number) {
    await store.upsertSubject({ ...subject, coefficient })
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
      workMode: 'mixte',
      memoStartDate: null,
      courseStage: null,
    }
    await store.upsertChapter(chapter)
    setNewChapterTitle((prev) => ({ ...prev, [subjectId]: '' }))
    await refresh()
  }

  async function setStatus(chapter: Chapter, status: ChapterStatus) {
    const memoStartDate = status === 'en_cours' && !chapter.memoStartDate ? todayIso() : chapter.memoStartDate
    await store.upsertChapter({ ...chapter, status, memoStartDate })
    await refresh()
  }

  async function setWorkMode(chapter: Chapter, workMode: WorkMode) {
    await store.upsertChapter({ ...chapter, workMode })
    await refresh()
  }

  async function setCourseStage(chapter: Chapter, stage: CourseStage) {
    const courseStage = chapter.courseStage === stage ? null : stage
    await store.upsertChapter({ ...chapter, courseStage })
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
          <input
            type="number"
            min={1}
            value={newSubjectCoefficient}
            onChange={(e) => setNewSubjectCoefficient(Number(e.target.value) || 1)}
            title="Coefficient au bac"
            style={{ width: 64 }}
          />
          <button onClick={addSubject}>Ajouter</button>
        </div>
        <p className="plan-item__meta">Coefficient au bac (1 par défaut) — sert à départager les priorités.</p>
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
                <div className="field">
                  <label>Coefficient au bac</label>
                  <input
                    type="number"
                    min={1}
                    value={subject.coefficient}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setSubjectCoefficient(subject, Number(e.target.value) || 1)}
                    style={{ width: 80 }}
                  />
                </div>
                {subjectChapters.map((chapter) => (
                  <div key={chapter.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                    <div className="row-between">
                      <span>{chapter.title}</span>
                      <button className="ghost" onClick={() => deleteChapter(chapter.id)} style={{ minHeight: 32, padding: '4px 10px' }}>
                        Suppr.
                      </button>
                    </div>
                    {memoProgressLabel(chapter) && (
                      <p className="plan-item__meta" style={{ marginTop: 2, marginBottom: 0 }}>
                        {memoProgressLabel(chapter)}
                      </p>
                    )}
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
                    <div className="status-pills" style={{ marginTop: 6 }}>
                      {WORK_MODE_ORDER.map((mode) => (
                        <button
                          key={mode}
                          className={'status-pill' + (chapter.workMode === mode ? ' status-pill--active' : '')}
                          style={chapter.workMode === mode ? { background: 'var(--color-primary)' } : undefined}
                          onClick={() => setWorkMode(chapter, mode)}
                        >
                          {WORK_MODE_LABELS[mode]}
                        </button>
                      ))}
                    </div>
                    <div className="status-pills" style={{ marginTop: 6, alignItems: 'center' }}>
                      {COURSE_STAGE_ORDER.map((stage) => (
                        <button
                          key={stage}
                          className={'status-pill' + (chapter.courseStage === stage ? ' status-pill--active' : '')}
                          style={chapter.courseStage === stage ? { background: '#0f766e' } : undefined}
                          onClick={() => setCourseStage(chapter, stage)}
                        >
                          {COURSE_STAGE_LABELS[stage]}
                        </button>
                      ))}
                      {!chapter.courseStage && (
                        <span className="plan-item__meta" style={{ fontStyle: 'italic' }}>
                          aucun → pas de tâche liée au cours
                        </span>
                      )}
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
