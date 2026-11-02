import Dexie, { type Table } from 'dexie'
import type { Exercise, Workout } from './types'

class AppDB extends Dexie {
  workouts!: Table<Workout, string>
  customExercises!: Table<Exercise, string>
  constructor() {
    super('kintore-memo')
    this.version(1).stores({
      workouts: 'id, date',
      customExercises: 'id',
    })
  }
}

export const db = new AppDB()

export const uid = () => crypto.randomUUID()
