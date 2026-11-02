import { estimate1RM } from './calc'
import type { ExerciseKind, SetRec } from './types'

/** One set as short text, e.g. "72.5 kg × 8" or "12 reps". */
export function describeSet(s: SetRec, kind: ExerciseKind): string {
  if (kind === 'weight') return `${s.weight ?? 0} kg × ${s.reps ?? 0}`
  return `${s.reps ?? 0} reps`
}

export const fmtKg = (n: number) => String(Math.round(n * 10) / 10)

/** Estimated 1RM (Epley) for one weighted set, or null while weight or reps is missing. */
export function setRM(s: SetRec): number | null {
  const w = s.weight ?? 0
  const r = s.reps ?? 0
  return w > 0 && r > 0 ? estimate1RM(w, r) : null
}
