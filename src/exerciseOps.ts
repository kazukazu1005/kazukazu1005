import { db } from './db'

export const MAX_EXERCISE_NAME = 40

/** How many saved workouts include this exercise. */
export function usageCount(workouts: { entries: { exerciseId: string }[] }[], exerciseId: string): number {
  return workouts.filter((w) => w.entries.some((e) => e.exerciseId === exerciseId)).length
}

/**
 * Rename a custom exercise. Workouts that use it are marked unsynced so friends get the new name
 * the next time they are sent (shared copies carry the exercise name).
 */
export async function renameCustomExercise(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Please enter a name.')
  if (trimmed.length > MAX_EXERCISE_NAME) throw new Error(`Names can be up to ${MAX_EXERCISE_NAME} characters.`)
  await db.transaction('rw', db.customExercises, db.workouts, async () => {
    await db.customExercises.update(id, { name: trimmed })
    await db.workouts.toCollection().modify((w) => {
      if (w.entries.some((e) => e.exerciseId === id)) w.synced = false
    })
  })
}

/** Delete a custom exercise that no saved workout uses. */
export async function deleteCustomExercise(id: string): Promise<void> {
  const used = usageCount(await db.workouts.toArray(), id)
  if (used > 0) throw new Error(`It is used in ${used} saved ${used === 1 ? 'workout' : 'workouts'}. Change those first.`)
  await db.customExercises.delete(id)
}
