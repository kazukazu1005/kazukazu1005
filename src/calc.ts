import type { Entry, Exercise, SetRec, Workout } from './types'

/** 推定1RM（Epley式）。回数1なら重量そのもの。 */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** A set counts only when something was entered (new sets start empty). */
export function isFilledSet(s: SetRec): boolean {
  return (s.weight ?? 0) > 0 || (s.reps ?? 0) > 0
}

export function setVolume(s: SetRec): number {
  return (s.weight ?? 0) * (s.reps ?? 0)
}

export function entryVolume(e: Entry): number {
  return e.sets.reduce((a, s) => a + setVolume(s), 0)
}

export function workoutVolume(w: Workout, exercises: Map<string, Exercise>): number {
  return w.entries.reduce((a, e) => (exercises.get(e.exerciseId)?.kind === 'weight' ? a + entryVolume(e) : a), 0)
}

export interface ExerciseStat {
  date: string
  maxWeight: number
  best1RM: number
  volume: number
  maxReps: number
  totalReps: number
}

/** ワークアウト履歴から、指定種目の日別統計を作る（日付昇順）。 */
export function statsFor(exerciseId: string, workouts: Workout[]): ExerciseStat[] {
  const byDate = new Map<string, ExerciseStat>()
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.exerciseId !== exerciseId) continue
      const st = byDate.get(w.date) ?? { date: w.date, maxWeight: 0, best1RM: 0, volume: 0, maxReps: 0, totalReps: 0 }
      for (const s of e.sets) {
        st.maxWeight = Math.max(st.maxWeight, s.weight ?? 0)
        st.best1RM = Math.max(st.best1RM, estimate1RM(s.weight ?? 0, s.reps ?? 0))
        st.volume += setVolume(s)
        st.maxReps = Math.max(st.maxReps, s.reps ?? 0)
        st.totalReps += s.reps ?? 0
      }
      byDate.set(w.date, st)
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export type PRType = 'Est. 1RM' | 'Max weight' | 'Max reps'

/**
 * 指定ワークアウトの指定種目で更新された自己ベストを返す。
 * 同じ日付より前の履歴（過去）だけと比較する。初回記録は PR としない。
 */
export function detectPRs(entry: Entry, exercise: Exercise, date: string, workouts: Workout[], selfId: string): PRType[] {
  const past = statsFor(
    exercise.id,
    workouts.filter((w) => w.id !== selfId && w.date <= date),
  )
  if (past.length === 0) return []
  const now = statsFor(exercise.id, [{ id: 'x', date, title: '', note: '', entries: [entry], createdAt: 0, updatedAt: 0 }])[0]
  if (!now) return []
  const prs: PRType[] = []
  const max = (f: (s: ExerciseStat) => number) => Math.max(...past.map(f))
  if (exercise.kind === 'weight') {
    if (now.best1RM > max((s) => s.best1RM)) prs.push('Est. 1RM')
    if (now.maxWeight > max((s) => s.maxWeight)) prs.push('Max weight')
  } else if (now.maxReps > max((s) => s.maxReps)) {
    prs.push('Max reps')
  }
  return prs
}

/**
 * A new personal best for estimated 1RM, or null. `workouts` are the saved ones (before this save),
 * so the earlier saved version of the workout being edited counts too, and re-saving an unchanged
 * record never counts again. The very first record of an exercise is not a record to beat.
 */
export function new1RMRecord(entry: Entry, exercise: Exercise, workouts: Workout[]): { prev: number; next: number } | null {
  if (exercise.kind !== 'weight') return null
  const next = Math.max(0, ...entry.sets.map((s) => estimate1RM(s.weight ?? 0, s.reps ?? 0)))
  const prev = Math.max(0, ...statsFor(exercise.id, workouts).map((s) => s.best1RM))
  return prev > 0 && next > prev + 0.05 ? { prev, next } : null
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 月曜始まりの週の開始日 */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - diff)
  return x
}

/** 連続でトレーニングした週数（今週は未実施でも先週から数える） */
export function weekStreak(workouts: Workout[], today = new Date()): number {
  const weeks = new Set(workouts.map((w) => toDateStr(weekStart(new Date(w.date + 'T00:00:00')))))
  let cur = weekStart(today)
  if (!weeks.has(toDateStr(cur))) cur.setDate(cur.getDate() - 7)
  let n = 0
  while (weeks.has(toDateStr(cur))) {
    n++
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7)
  }
  return n
}

/** Month grid, Monday-first. Each cell is a date string, or null for padding. Always whole weeks. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(toDateStr(new Date(year, month, d)))
  while (cells.length % 7) cells.push(null)
  return cells
}
