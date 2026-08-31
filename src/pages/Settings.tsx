import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { buildDemoBundle } from '../lib/demoData'
import { newId } from '../lib/id'
import { addDays, isoWeekday } from '../lib/scheduler'
import { DAY_LABELS, DEFAULT_SETTINGS, WEEK_TYPE_LABELS } from '../lib/types'
import type { AlgoSettings, Subject, TimetableSlot, WeekType } from '../lib/types'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7]
const WEEK_TYPE_ORDER: WeekType[] = ['toutes', 'A', 'B']

function mondayOf(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1))
}

export default function Settings() {
  const { store, isCloud, userEmail, signOut } = useAuth()
  const [settings, setSettings] = useState<AlgoSettings>(DEFAULT_SETTINGS)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [timetable, setTimetable] = useState<TimetableSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [memoIntervalsText, setMemoIntervalsText] = useState('')
  const [exerciseOffsetsText, setExerciseOffsetsText] = useState('')
  const [demoLoaded, setDemoLoaded] = useState(false)

  const [newSlotSubjectId, setNewSlotSubjectId] = useState('')
  const [newSlotDay, setNewSlotDay] = useState(1)
  const [newSlotWeekType, setNewSlotWeekType] = useState<WeekType>('toutes')

  async function refresh() {
    const [s, subj, tt] = await Promise.all([store.getSettings(), store.listSubjects(), store.listTimetable()])
    setSettings(s)
    setMemoIntervalsText(s.memoIntervalsDays.join(','))
    setExerciseOffsetsText(s.exercisePreEvalOffsetsDays.join(','))
    setSubjects(subj)
    setTimetable(tt)
    if (!newSlotSubjectId && subj.length > 0) setNewSlotSubjectId(subj[0].id)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [store])

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  async function save(next: AlgoSettings) {
    setSettings(next)
    await store.setSettings(next)
    setSavedAt(Date.now())
  }

  function commitMemoIntervals() {
    const values = memoIntervalsText
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b)
    if (values.length === 0) return
    save({ ...settings, memoIntervalsDays: values })
  }

  function commitExerciseOffsets() {
    const values = exerciseOffsetsText
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a)
    if (values.length === 0) return
    save({ ...settings, exercisePreEvalOffsetsDays: values })
  }

  async function setWeekAnchorDate(dateInput: string) {
    if (!dateInput) return
    const monday = mondayOf(dateInput)
    await save({ ...settings, weekAnchor: { mondayIso: monday, type: settings.weekAnchor?.type ?? 'A' } })
  }

  async function setWeekAnchorType(type: 'A' | 'B') {
    const mondayIso = settings.weekAnchor?.mondayIso ?? mondayOf(new Date().toISOString().slice(0, 10))
    await save({ ...settings, weekAnchor: { mondayIso, type } })
  }

  async function addTimetableSlot() {
    if (!newSlotSubjectId) return
    const slot: TimetableSlot = {
      id: newId(),
      subjectId: newSlotSubjectId,
      dayOfWeek: newSlotDay,
      weekType: newSlotWeekType,
    }
    await store.upsertTimetableSlot(slot)
    await refresh()
  }

  async function deleteTimetableSlot(id: string) {
    await store.deleteTimetableSlot(id)
    await refresh()
  }

  async function loadDemoData() {
    const demo = buildDemoBundle()
    for (const s of demo.subjects) await store.upsertSubject(s)
    await store.upsertChaptersBulk(demo.chapters)
    for (const d of demo.deadlines) await store.upsertDeadline(d)
    await store.upsertTimetableSlotsBulk(demo.timetable)
    for (const l of demo.studyLog) await store.upsertStudyLog(l)
    await refresh()
    setDemoLoaded(true)
  }

  async function exportData() {
    const bundle = await store.exportAll()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revisions-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="empty-state">Chargement…</div>

  return (
    <div>
      <h1>Réglages</h1>
      <p className="subtitle">Ajuste comment le plan de la semaine est calculé.</p>

      <div className="card">
        <h2>Compte</h2>
        {isCloud ? (
          <div>
            <p className="plan-item__meta">Connecté : {userEmail}</p>
            <button className="ghost" onClick={signOut}>
              Se déconnecter
            </button>
          </div>
        ) : (
          <div>
            <p className="plan-item__meta">
              Mode local : Supabase n’est pas encore configuré, les données sont stockées uniquement sur cet
              appareil.
            </p>
            {subjects.length === 0 ? (
              <button className="secondary" onClick={loadDemoData} style={{ marginTop: 8 }}>
                Charger des données de démo
              </button>
            ) : (
              <p className="plan-item__meta" style={{ marginTop: 8 }}>
                Des matières existent déjà — le bouton de démo est masqué pour éviter les doublons.
              </p>
            )}
            {demoLoaded && (
              <p className="plan-item__meta" style={{ marginTop: 8 }}>
                ✓ Données de démo chargées. Va dans « Semaine » pour voir le plan généré.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Emploi du temps</h2>
        <p className="plan-item__meta">
          Utilisé pour planifier les exercices (après/avant un cours, week-end).
        </p>

        {subjects.length === 0 ? (
          <p className="plan-item__meta">Ajoute d’abord une matière dans l’onglet « Matières ».</p>
        ) : (
          <>
            {DAY_ORDER.map((day) => {
              const slots = timetable.filter((t) => t.dayOfWeek === day)
              if (slots.length === 0) return null
              return (
                <div key={day} style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>{DAY_LABELS[day]}</strong>
                  {slots.map((slot) => (
                    <div className="row-between" key={slot.id} style={{ marginTop: 4 }}>
                      <span className="plan-item__meta">
                        {subjectById.get(slot.subjectId)?.name ?? '—'} · {WEEK_TYPE_LABELS[slot.weekType]}
                      </span>
                      <button
                        className="ghost"
                        onClick={() => deleteTimetableSlot(slot.id)}
                        style={{ minHeight: 28, padding: '2px 8px' }}
                      >
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}

            <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <select value={newSlotSubjectId} onChange={(e) => setNewSlotSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={newSlotDay} onChange={(e) => setNewSlotDay(Number(e.target.value))}>
                {DAY_ORDER.map((day) => (
                  <option key={day} value={day}>
                    {DAY_LABELS[day]}
                  </option>
                ))}
              </select>
              <select value={newSlotWeekType} onChange={(e) => setNewSlotWeekType(e.target.value as WeekType)}>
                {WEEK_TYPE_ORDER.map((wt) => (
                  <option key={wt} value={wt}>
                    {WEEK_TYPE_LABELS[wt]}
                  </option>
                ))}
              </select>
              <button onClick={addTimetableSlot}>Ajouter</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Semaine A / B</h2>
        <p className="plan-item__meta">
          Nécessaire seulement si ton emploi du temps alterne. Indique un lundi et son type.
        </p>
        <div className="field">
          <label>Lundi de référence</label>
          <input
            type="date"
            value={settings.weekAnchor?.mondayIso ?? ''}
            onChange={(e) => setWeekAnchorDate(e.target.value)}
          />
        </div>
        <div className="status-pills">
          {(['A', 'B'] as const).map((type) => (
            <button
              key={type}
              className={'status-pill' + (settings.weekAnchor?.type === type ? ' status-pill--active' : '')}
              style={settings.weekAnchor?.type === type ? { background: 'var(--color-primary)' } : undefined}
              onClick={() => setWeekAnchorType(type)}
            >
              Semaine {type}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Mémorisation (méthode des J)</h2>
        <div className="field">
          <label>Paliers (jours après le début, séparés par des virgules)</label>
          <input
            type="text"
            value={memoIntervalsText}
            onChange={(e) => setMemoIntervalsText(e.target.value)}
            onBlur={commitMemoIntervals}
            placeholder="1,3,7,15,30"
          />
        </div>
        <div className="field">
          <label>Rappel d’entretien après le dernier palier (jours)</label>
          <input
            type="number"
            min={1}
            value={settings.memoRepeatDays}
            onChange={(e) => save({ ...settings, memoRepeatDays: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="field">
          <label>Décalage minimum avant une éval (jours)</label>
          <input
            type="number"
            min={0}
            value={settings.memoBufferBeforeEvalDays}
            onChange={(e) => save({ ...settings, memoBufferBeforeEvalDays: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="field">
          <label>Durée d’un rappel mémorisation (minutes)</label>
          <input
            type="number"
            min={5}
            step={5}
            value={settings.memoBlockMinutes}
            onChange={(e) => save({ ...settings, memoBlockMinutes: Number(e.target.value) || 5 })}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Étaler les rattrapages avant éval sur (jours)</label>
          <input
            type="number"
            min={1}
            value={settings.memoSpreadDays}
            onChange={(e) => save({ ...settings, memoSpreadDays: Number(e.target.value) || 1 })}
          />
          <p className="plan-item__meta" style={{ marginTop: 0 }}>
            Évite que plusieurs chapitres se rattrapent tous le même jour juste avant une éval.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Exercices &amp; filet de sécurité</h2>
        <div className="field">
          <label>Durée d’un bloc d’exercice (minutes)</label>
          <input
            type="number"
            min={5}
            step={5}
            value={settings.blockMinutes}
            onChange={(e) => save({ ...settings, blockMinutes: Number(e.target.value) || 5 })}
          />
        </div>
        <div className="field">
          <label>Séances avant une éval (jours avant, séparés par des virgules)</label>
          <input
            type="text"
            value={exerciseOffsetsText}
            onChange={(e) => setExerciseOffsetsText(e.target.value)}
            onBlur={commitExerciseOffsets}
            placeholder="7,4,2,1"
          />
          <p className="plan-item__meta" style={{ marginTop: 0 }}>
            La dernière (la plus proche de l’éval) est automatiquement plus courte — révision légère, pas
            bachotage.
          </p>
        </div>
        <div className="field">
          <label>Horizon "échéance proche" (jours)</label>
          <input
            type="number"
            min={1}
            value={settings.horizonDays}
            onChange={(e) => save({ ...settings, horizonDays: Number(e.target.value) || 1 })}
          />
        </div>
        <p className="plan-item__meta">
          Poids du filet de sécurité, utilisés seulement pour les chapitres sans tâche mémorisation/exercice
          ce jour-là.
        </p>
        <div className="field">
          <label>Poids — Point faible</label>
          <input
            type="number"
            step={0.1}
            value={settings.weights.faible}
            onChange={(e) => save({ ...settings, weights: { ...settings.weights, faible: Number(e.target.value) } })}
          />
        </div>
        <div className="field">
          <label>Poids — En cours</label>
          <input
            type="number"
            step={0.1}
            value={settings.weights.en_cours}
            onChange={(e) => save({ ...settings, weights: { ...settings.weights, en_cours: Number(e.target.value) } })}
          />
        </div>
        <div className="field">
          <label>Poids — À faire</label>
          <input
            type="number"
            step={0.1}
            value={settings.weights.a_faire}
            onChange={(e) => save({ ...settings, weights: { ...settings.weights, a_faire: Number(e.target.value) } })}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Poids — Maîtrisé</label>
          <input
            type="number"
            step={0.1}
            value={settings.weights.maitrise}
            onChange={(e) => save({ ...settings, weights: { ...settings.weights, maitrise: Number(e.target.value) } })}
          />
        </div>
        {savedAt && <p className="plan-item__meta">Enregistré</p>}
      </div>

      <div className="card">
        <h2>Devoirs</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Fenêtre de crédit après un devoir fait (jours)</label>
          <input
            type="number"
            min={0}
            value={settings.homeworkCreditWindowDays}
            onChange={(e) => save({ ...settings, homeworkCreditWindowDays: Number(e.target.value) || 0 })}
          />
          <p className="plan-item__meta" style={{ marginTop: 0 }}>
            Un devoir lié à un chapitre et fait récemment réduit les séances d’exercices proposées pour ce
            chapitre pendant cette durée, au lieu de s’y ajouter.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Sauvegarde</h2>
        <p className="plan-item__meta">Exporte toutes tes données dans un fichier JSON de secours.</p>
        <button className="secondary" onClick={exportData}>
          Exporter mes données
        </button>
      </div>
    </div>
  )
}
