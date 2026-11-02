import { describe, expect, it } from 'vitest'
import { retargetEntry } from './entryOps'
import type { Entry, Exercise } from './types'

describe('retargetEntry', () => {
  const entry: Entry = { id: 'e', exerciseId: 'bench', sets: [{ id: 's', weight: 60, reps: 8 }] }
  it('keeps sets when moving between weighted exercises', () => {
    const to: Exercise = { id: 'incline', name: 'Incline', kind: 'weight', part: 'Chest' }
    expect(retargetEntry(entry, to)).toEqual({ ...entry, exerciseId: 'incline' })
  })
  it('drops weights when the new exercise is bodyweight', () => {
    const to: Exercise = { id: 'pushup', name: 'Push-up', kind: 'bodyweight', part: 'Chest' }
    expect(retargetEntry(entry, to).sets).toEqual([{ id: 's', reps: 8 }])
  })
})
