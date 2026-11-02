import type { FeedItem } from './social'
import type { Exercise, Workout } from './types'

/**
 * A friend's shared workouts only carry exercise names, so rebuild exercise ids from kind + name.
 * That lets the same chart code used for your own log draw a friend's progress.
 */
export function toProgressData(items: FeedItem[]): { exercises: Exercise[]; workouts: Workout[] } {
  const exercises = new Map<string, Exercise>()
  const workouts: Workout[] = items.map((it) => ({
    id: it.id,
    date: it.date,
    title: it.title,
    note: it.note,
    createdAt: 0,
    updatedAt: 0,
    entries: it.data.entries
      .filter((e) => e.kind === 'weight' || e.kind === 'bodyweight')
      .map((e, i) => {
        const id = `${e.kind}:${e.name}`
        if (!exercises.has(id)) exercises.set(id, { id, name: e.name, kind: e.kind, part: e.part })
        return { id: `${it.id}-${i}`, exerciseId: id, sets: e.sets }
      }),
  }))
  return { exercises: [...exercises.values()], workouts }
}
