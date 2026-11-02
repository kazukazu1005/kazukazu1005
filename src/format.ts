import type { ExerciseKind, SetRec } from './types'
import { formatPace, pace } from './calc'

/** One set as short text, e.g. "72.5 kg × 8", "12 reps", "5 km · 30 min · 6:00/km". */
export function describeSet(s: SetRec, kind: ExerciseKind): string {
  if (kind === 'weight') return `${s.weight ?? 0} kg × ${s.reps ?? 0}`
  if (kind === 'bodyweight') return `${s.reps ?? 0} reps`
  const p = pace(s.durationMin, s.distanceKm)
  return `${s.distanceKm ?? 0} km · ${s.durationMin ?? 0} min${p === null ? '' : ` · ${formatPace(p)}/km`}`
}
