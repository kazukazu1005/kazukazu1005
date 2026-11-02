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
  createdAt: number
  updatedAt: number
}

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weight: '重量（重量×回数）',
  bodyweight: '自重（回数）',
  cardio: '有酸素（時間・距離）',
}
