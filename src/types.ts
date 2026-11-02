export type ExerciseKind = 'weight' | 'bodyweight'

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
  /** True once the latest version of this workout is on the server (friends can see it). */
  synced?: boolean
  /** True once a copy has ever been sent to the server, so deleting it must also delete the copy. */
  everShared?: boolean
  createdAt: number
  updatedAt: number
}

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weight: 'Weights (kg × reps)',
  bodyweight: 'Bodyweight (reps)',
}
