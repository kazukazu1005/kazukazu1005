import { describe, expect, it } from 'vitest'
import { cleanEntries, contentKey, retargetEntry } from './entryOps'
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

describe('cleanEntries / contentKey', () => {
  const entries: Entry[] = [
    { id: 'a', exerciseId: 'bench', sets: [{ id: '1', weight: 60, reps: 8 }, { id: '2' }, { id: '3', weight: 0, reps: 0 }] },
    { id: 'b', exerciseId: 'squat', sets: [{ id: '4' }, { id: '5' }, { id: '6' }] },
  ]
  it('drops empty sets and exercises with nothing entered', () => {
    const out = cleanEntries(entries)
    expect(out).toHaveLength(1)
    expect(out[0].sets.map((s) => s.id)).toEqual(['1'])
  })
  it('contentKey ignores empty rows but notices real changes', () => {
    const base = { date: '2026-11-02', title: '', note: '', entries }
    const withMoreEmpties = { ...base, entries: [...entries, { id: 'c', exerciseId: 'row', sets: [{ id: '7' }] }] }
    expect(contentKey(withMoreEmpties)).toBe(contentKey(base))
    const edited = { ...base, entries: [{ ...entries[0], sets: [{ id: '1', weight: 65, reps: 8 }] }] }
    expect(contentKey(edited)).not.toBe(contentKey(base))
    expect(contentKey({ ...base, title: 'Chest day' })).not.toBe(contentKey(base))
  })
})
