import type { ExerciseKind, SetRec } from './types'

/** One set as short text, e.g. "72.5 kg × 8" or "12 reps". */
export function describeSet(s: SetRec, kind: ExerciseKind): string {
  if (kind === 'weight') return `${s.weight ?? 0} kg × ${s.reps ?? 0}`
  return `${s.reps ?? 0} reps`
}
