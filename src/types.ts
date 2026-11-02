export type ExerciseKind = 'weight' | 'bodyweight' | 'cardio'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  part: string
  custom?: boolean
}

export interface SetRec {
  id: string
  weight?: number // kg
  reps?: number
  durationMin?: number
  distanceKm?: number
  warmup?: boolean
}

export interface Entry {
  id: string
  exerciseId: string
  sets: SetRec[]
}

export interface Workout {
  id: string
  date: string // YYYY-MM-DD
  title: string
  note: string
  entries: Entry[]
  /** 'friends' = shared with friends (needs sign-in). Missing = private. */
  visibility?: 'private' | 'friends'
  /** For 'friends' workouts: true once the latest version reached the server. */
  synced?: boolean
  createdAt: number
  updatedAt: number
}

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weight: 'Weights (kg × reps)',
  bodyweight: 'Bodyweight (reps)',
  cardio: 'Cardio (time, distance)',
}
