import { isFilledSet } from './calc'
import type { Entry, Exercise, Workout } from './types'

/** Point a logged entry at another exercise, keeping its sets. Bodyweight exercises have no weight. */
export function retargetEntry(entry: Entry, to: Exercise): Entry {
  return {
    ...entry,
    exerciseId: to.id,
    sets: to.kind === 'bodyweight' ? entry.sets.map((s) => ({ id: s.id, reps: s.reps })) : entry.sets,
  }
}

/** Keep only sets that have something entered, and only exercises that still have a set. */
export function cleanEntries(entries: Entry[]): Entry[] {
  return entries.map((e) => ({ ...e, sets: e.sets.filter(isFilledSet) })).filter((e) => e.sets.length > 0)
}

/** What counts as "the same content" when deciding whether a workout needs saving again. */
export function contentKey(w: Pick<Workout, 'date' | 'title' | 'note' | 'entries'>): string {
  return JSON.stringify({ d: w.date, t: w.title, n: w.note, e: cleanEntries(w.entries).map((e) => [e.id, e.exerciseId, e.sets.map((s) => [s.id, s.weight ?? null, s.reps ?? null])]) })
}
