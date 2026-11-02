import { PRESET_EXERCISES } from './exercises'
import { db } from './db'
import type { Exercise, Workout } from './types'

const FORMAT = 'kintore-memo'
const VERSION = 1

export async function buildBackup() {
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    workouts: await db.workouts.toArray(),
    customExercises: await db.customExercises.toArray(),
  }
}

export function validateBackup(data: unknown): { workouts: Workout[]; customExercises: Exercise[] } {
  const d = data as { format?: string; workouts?: unknown; customExercises?: unknown }
  if (!d || d.format !== FORMAT || !Array.isArray(d.workouts) || !Array.isArray(d.customExercises)) {
    throw new Error('This is not a Gym Bro backup file.')
  }
  for (const w of d.workouts as Workout[]) {
    if (typeof w.id !== 'string' || typeof w.date !== 'string' || !Array.isArray(w.entries)) {
      throw new Error('The workout data format is invalid.')
    }
  }
  return { workouts: d.workouts as Workout[], customExercises: d.customExercises as Exercise[] }
}

const csvCell = (v: unknown) => {
  let s = String(v ?? '')
  // CSVインジェクション対策: 式として解釈され得る先頭文字を無効化
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(workouts: Workout[], custom: Exercise[]): string {
  const map = new Map([...PRESET_EXERCISES, ...custom].map((e) => [e.id, e]))
  const rows = [['Date', 'Title', 'Exercise', 'Part', 'Set', 'Weight kg', 'Reps']]
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  for (const w of sorted) {
    for (const e of w.entries) {
      const ex = map.get(e.exerciseId)
      e.sets.forEach((s, i) =>
        rows.push([w.date, w.title, ex?.name ?? e.exerciseId, ex?.part ?? '', String(i + 1), s.weight ?? '', s.reps ?? ''] as string[]),
      )
    }
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importBackup(text: string): Promise<number> {
  const { workouts, customExercises } = validateBackup(JSON.parse(text))
  await db.transaction('rw', db.workouts, db.customExercises, async () => {
    await db.workouts.bulkPut(workouts.map((w) => ({ ...w, synced: false, everShared: undefined })))
    await db.customExercises.bulkPut(customExercises)
  })
  return workouts.length
}
