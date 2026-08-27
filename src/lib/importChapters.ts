import Papa from 'papaparse'
import { newId } from './id'
import type { Chapter, Subject } from './types'

export interface ImportRow {
  matiere: string
  chapitre: string
  sousChapitre?: string
  ordre?: number
}

export function parseChaptersCsv(text: string): ImportRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message)
  }
  return result.data
    .filter((row) => row.matiere && row.chapitre)
    .map((row, i) => ({
      matiere: row.matiere.trim(),
      chapitre: row.chapitre.trim(),
      sousChapitre: row.sous_chapitre?.trim() || undefined,
      ordre: row.ordre ? Number(row.ordre) : i,
    }))
}

export function parseChaptersJson(text: string): ImportRow[] {
  const data = JSON.parse(text) as unknown
  if (!Array.isArray(data)) throw new Error('Le JSON doit être une liste')
  return data.map((row: Record<string, unknown>, i: number) => ({
    matiere: String(row.matiere ?? '').trim(),
    chapitre: String(row.chapitre ?? '').trim(),
    sousChapitre: row.sous_chapitre ? String(row.sous_chapitre).trim() : undefined,
    ordre: typeof row.ordre === 'number' ? row.ordre : i,
  }))
}

const SUBJECT_COLORS = ['#4338ca', '#0891b2', '#d97706', '#16a34a', '#db2777', '#7c3aed', '#dc2626', '#0284c7']

export function rowsToEntities(
  rows: ImportRow[],
  existingSubjects: Subject[],
): { newSubjects: Subject[]; chapters: Chapter[] } {
  const subjectByName = new Map(existingSubjects.map((s) => [s.name.toLowerCase(), s]))
  const newSubjects: Subject[] = []
  const chapters: Chapter[] = []

  for (const row of rows) {
    if (!row.matiere || !row.chapitre) continue
    const key = row.matiere.toLowerCase()
    let subject = subjectByName.get(key)
    if (!subject) {
      subject = {
        id: newId(),
        name: row.matiere,
        color: SUBJECT_COLORS[(newSubjects.length + existingSubjects.length) % SUBJECT_COLORS.length],
      }
      subjectByName.set(key, subject)
      newSubjects.push(subject)
    }
    const title = row.sousChapitre ? `${row.chapitre} — ${row.sousChapitre}` : row.chapitre
    chapters.push({
      id: newId(),
      subjectId: subject.id,
      title,
      orderIndex: row.ordre ?? chapters.length,
      status: 'a_faire',
      notes: '',
      workMode: 'mixte',
      memoStartDate: null,
      courseStage: null,
    })
  }

  return { newSubjects, chapters }
}
