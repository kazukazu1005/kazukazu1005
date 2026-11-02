import { describe, expect, it } from 'vitest'
import { fmtKg, setRM } from './format'

describe('format', () => {
  it('setRM needs both weight and reps', () => {
    expect(setRM({ id: 'a' })).toBeNull()
    expect(setRM({ id: 'a', weight: 80 })).toBeNull()
    expect(setRM({ id: 'a', reps: 5 })).toBeNull()
    expect(fmtKg(setRM({ id: 'a', weight: 80, reps: 5 })!)).toBe('93.3')
    expect(setRM({ id: 'a', weight: 100, reps: 1 })).toBe(100)
  })
})
