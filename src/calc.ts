import type { Entry, Exercise, SetRec, Workout } from './types'

/** 推定1RM（Epley式）。回数1なら重量そのもの。 */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export function setVolume(s: SetRec): number {
  return (s.weight ?? 0) * (s.reps ?? 0)
}

export function entryVolume(e: Entry): number {
  return e.sets.filter((s) => !s.warmup).reduce((a, s) => a + setVolume(s), 0)
}

export function workoutVolume(w: Workout, exercises: Map<string, Exercise>): number {
  return w.entries.reduce((a, e) => (exercises.get(e.exerciseId)?.kind === 'weight' ? a + entryVolume(e) : a), 0)
}

/** ペース（分/km）。距離か時間が無ければ null。 */
export function pace(durationMin?: number, distanceKm?: number): number | null {
  if (!durationMin || !distanceKm || durationMin <= 0 || distanceKm <= 0) return null
  return durationMin / distanceKm
}

export function formatPace(p: number | null): string {
  if (p === null) return '-'
  const m = Math.floor(p)
  const s = Math.round((p - m) * 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}

export interface ExerciseStat {
  date: string
  maxWeight: number
  best1RM: number
  volume: number
  maxReps: number
  distance: number
  duration: number
  bestPace: number | null
}

/** ワークアウト履歴から、指定種目の日別統計を作る（日付昇順）。 */
export function statsFor(exerciseId: string, workouts: Workout[]): ExerciseStat[] {
  const byDate = new Map<string, ExerciseStat>()
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.exerciseId !== exerciseId) continue
      const st =
        byDate.get(w.date) ??
        { date: w.date, maxWeight: 0, best1RM: 0, volume: 0, maxReps: 0, distance: 0, duration: 0, bestPace: null }
      for (const s of e.sets) {
        if (s.warmup) continue
        st.maxWeight = Math.max(st.maxWeight, s.weight ?? 0)
        st.best1RM = Math.max(st.best1RM, estimate1RM(s.weight ?? 0, s.reps ?? 0))
        st.volume += setVolume(s)
        st.maxReps = Math.max(st.maxReps, s.reps ?? 0)
        st.distance += s.distanceKm ?? 0
        st.duration += s.durationMin ?? 0
        const p = pace(s.durationMin, s.distanceKm)
        if (p !== null && (st.bestPace === null || p < st.bestPace)) st.bestPace = p
      }
      byDate.set(w.date, st)
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export type PRType = 'Est. 1RM' | 'Max weight' | 'Max reps' | 'Longest distance' | 'Best pace'

/**
 * 指定ワークアウトの指定種目で更新された自己ベストを返す。
 * 同じ日付より前の履歴（過去）だけと比較する。初回記録は PR としない。
 */
export function detectPRs(entry: Entry, exercise: Exercise, date: string, workouts: Workout[], selfId: string): PRType[] {
  const past = statsFor(
    exercise.id,
    workouts.filter((w) => w.id !== selfId && w.date <= date),
  ).filter((s) => s.date <= date)
  if (past.length === 0) return []
  const now = statsFor(exercise.id, [{ id: 'x', date, title: '', note: '', entries: [entry], createdAt: 0, updatedAt: 0 }])[0]
  if (!now) return []
  const prs: PRType[] = []
  const max = (f: (s: ExerciseStat) => number) => Math.max(...past.map(f))
  if (exercise.kind === 'weight') {
    if (now.best1RM > max((s) => s.best1RM)) prs.push('Est. 1RM')
    if (now.maxWeight > max((s) => s.maxWeight)) prs.push('Max weight')
  } else if (exercise.kind === 'bodyweight') {
    if (now.maxReps > max((s) => s.maxReps)) prs.push('Max reps')
  } else {
    if (now.distance > max((s) => s.distance)) prs.push('Longest distance')
    const paces = past.map((s) => s.bestPace).filter((p): p is number => p !== null)
    if (now.bestPace !== null && paces.length > 0 && now.bestPace < Math.min(...paces)) prs.push('Best pace')
  }
  return prs
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
