import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { DEFAULT_SETTINGS } from '../lib/types'
import type { AlgoSettings } from '../lib/types'

export default function Settings() {
  const { store, isCloud, userEmail, signOut } = useAuth()
  const [settings, setSettings] = useState<AlgoSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    store.getSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [store])

  async function save(next: AlgoSettings) {
    setSettings(next)
    await store.setSettings(next)
    setSavedAt(Date.now())
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
      <p className="subtitle">Ajuste comment le plan du jour est calculé.</p>

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
          <p className="plan-item__meta">
            Mode local : Supabase n’est pas encore configuré, les données sont stockées uniquement sur cet
            appareil.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Algorithme</h2>
        <div className="field">
          <label>Durée d’un bloc de révision (minutes)</label>
          <input
            type="number"
            min={5}
            step={5}
            value={settings.blockMinutes}
            onChange={(e) => save({ ...settings, blockMinutes: Number(e.target.value) || 5 })}
          />
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
        <h2>Sauvegarde</h2>
        <p className="plan-item__meta">Exporte toutes tes données dans un fichier JSON de secours.</p>
        <button className="secondary" onClick={exportData}>
          Exporter mes données
        </button>
      </div>
    </div>
  )
}
