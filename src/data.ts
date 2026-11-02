import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './db'
import { PRESET_EXERCISES } from './exercises'
import type { Exercise, Workout } from './types'

export interface AppData {
  ready: boolean
  workouts: Workout[] // 日付降順
  custom: Exercise[]
  exercises: Map<string, Exercise>
  allExercises: Exercise[]
}

export function useAppData(): AppData {
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const custom = useLiveQuery(() => db.customExercises.toArray(), [])
  return useMemo(() => {
    const c = custom ?? []
    const all = [...PRESET_EXERCISES, ...c]
    return {
      ready: workouts !== undefined && custom !== undefined,
      workouts: [...(workouts ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
      custom: c,
      exercises: new Map(all.map((e) => [e.id, e])),
      allExercises: all,
    }
  }, [workouts, custom])
}
