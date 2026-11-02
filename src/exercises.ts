import type { Exercise, ExerciseKind } from './types'

const w = (id: string, name: string, part: string): Exercise => ({ id, name, kind: 'weight', part })
const b = (id: string, name: string, part: string): Exercise => ({ id, name, kind: 'bodyweight', part })

export const PARTS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs'] as const

export const PRESET_EXERCISES: Exercise[] = [
  w('bench-press', 'Bench press', 'Chest'),
  w('incline-db-press', 'Incline dumbbell press', 'Chest'),
  w('chest-fly', 'Dumbbell fly', 'Chest'),
  w('chest-press-machine', 'Chest press (machine)', 'Chest'),
  b('push-up', 'Push-up', 'Chest'),
  w('deadlift', 'Deadlift', 'Back'),
  w('lat-pulldown', 'Lat pulldown', 'Back'),
  w('seated-row', 'Seated row', 'Back'),
  w('bent-over-row', 'Bent-over row', 'Back'),
  b('pull-up', 'Pull-up', 'Back'),
  w('squat', 'Squat', 'Legs'),
  w('leg-press', 'Leg press', 'Legs'),
  w('leg-extension', 'Leg extension', 'Legs'),
  w('leg-curl', 'Leg curl', 'Legs'),
  w('romanian-deadlift', 'Romanian deadlift', 'Legs'),
  w('calf-raise', 'Calf raise', 'Legs'),
  w('shoulder-press', 'Shoulder press', 'Shoulders'),
  w('side-raise', 'Lateral raise', 'Shoulders'),
  w('rear-delt-fly', 'Rear delt fly', 'Shoulders'),
  w('arm-curl', 'Biceps curl', 'Arms'),
  w('hammer-curl', 'Hammer curl', 'Arms'),
  w('triceps-pushdown', 'Triceps pushdown', 'Arms'),
  b('dips', 'Dips', 'Arms'),
  b('crunch', 'Crunch', 'Abs'),
  b('leg-raise', 'Leg raise', 'Abs'),
  b('plank-reps', 'Ab wheel', 'Abs'),
]

export function newCustomExercise(name: string, kind: ExerciseKind, part: string): Exercise {
  return { id: `custom-${crypto.randomUUID()}`, name: name.trim(), kind, part, custom: true }
}
