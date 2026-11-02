import { isFilledSet } from './calc'
import type { Entry, Exercise, SetRec } from './types'

/**
 * Fill empty sets with last time's values, and add sets until there are as many as last time.
 * Sets that already have something typed in are left alone.
 */
export function fillFromPrevious(sets: SetRec[], prev: SetRec[], newId: () => string): SetRec[] {
  const out = sets.map((s, i) => (!isFilledSet(s) && prev[i] ? { ...s, weight: prev[i].weight, reps: prev[i].reps } : s))
  for (let i = out.length; i < prev.length; i++) out.push({ id: newId(), weight: prev[i].weight, reps: prev[i].reps })
  return out
}

/** Point a logged entry at another exercise, keeping its sets. Bodyweight exercises have no weight. */
export function retargetEntry(entry: Entry, to: Exercise): Entry {
  return {
    ...entry,
    exerciseId: to.id,
    sets: to.kind === 'bodyweight' ? entry.sets.map((s) => ({ id: s.id, reps: s.reps })) : entry.sets,
  }
}
