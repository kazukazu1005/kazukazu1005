import type { Entry, Exercise } from './types'

/** Point a logged entry at another exercise, keeping its sets. Bodyweight exercises have no weight. */
export function retargetEntry(entry: Entry, to: Exercise): Entry {
  return {
    ...entry,
    exerciseId: to.id,
    sets: to.kind === 'bodyweight' ? entry.sets.map((s) => ({ id: s.id, reps: s.reps })) : entry.sets,
  }
}
