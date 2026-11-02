import { describe, expect, it } from 'vitest'
import { fillFromPrevious, retargetEntry } from './entryOps'
import type { Entry, Exercise } from './types'

let n = 0
const id = () => `n${++n}`

describe('fillFromPrevious', () => {
  it('fills empty sets, keeps typed ones, and adds missing sets', () => {
    const sets = [{ id: 'a' }, { id: 'b', weight: 50, reps: 5 }, { id: 'c' }]
    const prev = [{ id: 'p1', weight: 60, reps: 10 }, { id: 'p2', weight: 60, reps: 9 }, { id: 'p3', weight: 60, reps: 8 }, { id: 'p4', weight: 55, reps: 8 }]
    const out = fillFromPrevious(sets, prev, id)
    expect(out.map((s) => [s.weight, s.reps])).toEqual([[60, 10], [50, 5], [60, 8], [55, 8]])
    expect(out).toHaveLength(4)
    expect(out[0].id).toBe('a') // existing rows keep their ids
  })
  it('does not shrink the list when last time had fewer sets', () => {
    expect(fillFromPrevious([{ id: 'a' }, { id: 'b' }], [{ id: 'p', weight: 40, reps: 12 }], id)).toHaveLength(2)
  })
})

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
