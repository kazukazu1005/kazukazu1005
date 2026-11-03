import type { ExerciseStat } from './calc'

export interface MetricDef {
  key: string
  label: string
  unit: string
  /** 'a' = main (left) axis; 'b' = a much larger scale (e.g. volume) that gets its own right axis. */
  axis: 'a' | 'b'
  /** 1-3: picks the line style (solid, dashed, dotted) and marker shape. Stable per metric. */
  style: 1 | 2 | 3
  get: (s: ExerciseStat) => number | null
}

export const METRICS: Record<string, MetricDef[]> = {
  weight: [
    { key: '1rm', label: 'Est. 1RM', unit: 'kg', axis: 'a', style: 1, get: (s) => s.best1RM },
    { key: 'max', label: 'Max weight', unit: 'kg', axis: 'a', style: 2, get: (s) => s.maxWeight },
    { key: 'vol', label: 'Volume', unit: 'kg', axis: 'b', style: 3, get: (s) => s.volume },
  ],
  bodyweight: [
    { key: 'reps', label: 'Max reps', unit: 'reps', axis: 'a', style: 1, get: (s) => s.maxReps },
    { key: 'vol', label: 'Total reps', unit: 'reps', axis: 'b', style: 3, get: (s) => s.totalReps },
  ],
}

export interface Series { def: MetricDef; values: (number | null)[] }

/**
 * One column per recorded day (a day counts if any selected metric has a value that day).
 * `values` lines up with `dates`; null where that metric has nothing.
 */
export function buildSeries(stats: ExerciseStat[], defs: MetricDef[]): { dates: string[]; series: Series[] } {
  const rows = stats.filter((s) => defs.some((d) => (d.get(s) ?? 0) > 0))
  return {
    dates: rows.map((s) => s.date),
    series: defs.map((def) => ({ def, values: rows.map((s) => { const v = def.get(s); return v && v > 0 ? v : null }) })),
  }
}

/** Axis range with some breathing room, never below 0. */
export function domain(values: number[]): [number, number] {
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = (hi - lo) * 0.2 || Math.max(1, hi * 0.1)
  lo = Math.max(0, lo - pad)
  hi = hi + pad
  return [lo, hi]
}

/** Which series use the right axis. Only when there is also something on the main axis. */
export function splitAxes(series: Series[]): { right: Series[]; left: Series[]; dual: boolean } {
  const a = series.filter((s) => s.def.axis === 'a')
  const b = series.filter((s) => s.def.axis === 'b')
  const dual = a.length > 0 && b.length > 0
  return dual ? { left: a, right: b, dual } : { left: series, right: [], dual }
}
