import Papa from 'papaparse'
import { newId } from './id'
import type { Subject, TimetableSlot, WeekType } from './types'

export interface TimetableImportRow {
  matiere: string
  jour: string
  semaine?: string
}

const DAY_NAME_TO_ISO: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
}

function parseDay(value: string): number | null {
  const key = value.trim().toLowerCase()
  if (key in DAY_NAME_TO_ISO) return DAY_NAME_TO_ISO[key]
  const n = Number(key)
  if (Number.isInteger(n) && n >= 1 && n <= 7) return n
  return null
}

function parseWeekType(value: string | undefined): WeekType {
  const key = (value ?? '').trim().toLowerCase()
  if (key === 'a') return 'A'
  if (key === 'b') return 'B'
  return 'toutes'
}

export function parseTimetableCsv(text: string): TimetableImportRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  if (result.errors.length > 0) {
    throw new Error(result.errors[0].message)
  }
  return result.data
    .filter((row) => row.matiere && row.jour)
    .map((row) => ({
      matiere: row.matiere.trim(),
      jour: row.jour.trim(),
      semaine: row.semaine?.trim() || undefined,
    }))
}

export function timetableRowsToSlots(
  rows: TimetableImportRow[],
  existingSubjects: Subject[],
): { unmatchedSubjectNames: string[]; slots: TimetableSlot[] } {
  const subjectByName = new Map(existingSubjects.map((s) => [s.name.toLowerCase(), s]))
  const unmatchedSubjectNames: string[] = []
  const slots: TimetableSlot[] = []

  for (const row of rows) {
    const subject = subjectByName.get(row.matiere.toLowerCase())
    if (!subject) {
      unmatchedSubjectNames.push(row.matiere)
      continue
    }
    const dayOfWeek = parseDay(row.jour)
    if (dayOfWeek === null) continue
    slots.push({
      id: newId(),
      subjectId: subject.id,
      dayOfWeek,
      weekType: parseWeekType(row.semaine),
    })
  }

  return { unmatchedSubjectNames, slots }
}
