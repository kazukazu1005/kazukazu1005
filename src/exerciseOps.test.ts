import { describe, expect, it } from 'vitest'
import { usageCount } from './exerciseOps'

describe('usageCount', () => {
  it('counts workouts, not entries', () => {
    const ws = [
      { entries: [{ exerciseId: 'a' }, { exerciseId: 'a' }] },
      { entries: [{ exerciseId: 'b' }] },
      { entries: [] },
    ]
    expect(usageCount(ws, 'a')).toBe(1)
    expect(usageCount(ws, 'b')).toBe(1)
    expect(usageCount(ws, 'zzz')).toBe(0)
  })
})
