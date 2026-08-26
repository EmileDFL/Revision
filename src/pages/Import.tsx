import { useRef, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import { parseChaptersCsv, parseChaptersJson, rowsToEntities, type ImportRow } from '../lib/importChapters'
import type { Subject } from '../lib/types'

const EXAMPLE_CSV = `matiere,chapitre,sous_chapitre,ordre
Mathématiques,Suites numériques,,1
Mathématiques,Fonction exponentielle,,2
Histoire-Géographie,La guerre froide,Origines et débuts,1
Histoire-Géographie,La guerre froide,La détente,2
`

export default function Import() {
  const { store } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setDone(false)
    try {
      const text = await file.text()
      const parsed = file.name.toLowerCase().endsWith('.json') ? parseChaptersJson(text) : parseChaptersCsv(text)
      if (parsed.length === 0) throw new Error('Aucune ligne valide trouvée (colonnes attendues : matiere, chapitre)')
      setRows(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fichier invalide')
      setRows([])
    }
  }

  async function confirmImport() {
    setImporting(true)
    try {
      const existingSubjects: Subject[] = await store.listSubjects()
      const { newSubjects, chapters } = rowsToEntities(rows, existingSubjects)
      for (const s of newSubjects) {
        await store.upsertSubject(s)
      }
      await store.upsertChaptersBulk(chapters)
      setRows([])
      setDone(true)
      if (fileInput.current) fileInput.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'import")
    } finally {
      setImporting(false)
    }
  }

  function downloadExample() {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'exemple-import.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1>Importer des chapitres</h1>
      <p className="subtitle">
        Importe un fichier CSV ou JSON listant tes matières et chapitres. Tu peux en demander un à Claude à
        partir d’une photo du sommaire d’un livre — voir le format ci-dessous.
      </p>

      <div className="card">
        <h2>Fichier</h2>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {error && <p className="error-text">{error}</p>}
      </div>

      {rows.length > 0 && (
        <div className="card">
          <h2>Aperçu ({rows.length} chapitres)</h2>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <div key={i} className="plan-item__meta" style={{ marginBottom: 4 }}>
                <strong>{r.matiere}</strong> — {r.chapitre}
                {r.sousChapitre ? ` — ${r.sousChapitre}` : ''}
              </div>
            ))}
          </div>
          <button onClick={confirmImport} disabled={importing} style={{ marginTop: 12 }}>
            {importing ? 'Import…' : `Importer ces ${rows.length} chapitres`}
          </button>
        </div>
      )}

      {done && <p className="card">✓ Import terminé. Va dans « Matières » pour vérifier.</p>}

      <div className="card">
        <h2>Format attendu</h2>
        <p className="plan-item__meta">
          CSV avec en-têtes : <code>matiere,chapitre,sous_chapitre,ordre</code> (sous_chapitre et ordre sont
          optionnels). Une matière déjà existante (même nom) est réutilisée automatiquement.
        </p>
        <button className="secondary" onClick={downloadExample} style={{ marginTop: 8 }}>
          Télécharger un exemple
        </button>
      </div>
    </div>
  )
}
