import { describe, expect, it } from 'vitest'
import { detectPRs, estimate1RM, isFilledSet, monthGrid, statsFor, weekStreak } from './calc'
import type { Exercise, Workout } from './types'

const bench: Exercise = { id: 'bench', name: 'Bench', kind: 'weight', part: 'Chest' }

const wk = (id: string, date: string, exerciseId: string, sets: Workout['entries'][0]['sets']): Workout => ({
  id, date, title: '', note: '', createdAt: 0, updatedAt: 0,
  entries: [{ id: 'e' + id, exerciseId, sets }],
})

describe('calc', () => {
  it('estimate1RM', () => {
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(100, 3)).toBeCloseTo(110)
    expect(estimate1RM(0, 5)).toBe(0)
  })
  it('isFilledSet ignores empty rows', () => {
    expect(isFilledSet({ id: 'a' })).toBe(false)
    expect(isFilledSet({ id: 'a', weight: 0, reps: 0 })).toBe(false)
    expect(isFilledSet({ id: 'a', reps: 8 })).toBe(true)
    expect(isFilledSet({ id: 'a', weight: 60 })).toBe(true)
  })
  it('stats sum every set', () => {
    const ws = [wk('1', '2026-01-01', 'bench', [{ id: 'a', weight: 60, reps: 10 }, { id: 'b', weight: 50, reps: 10 }])]
    const [s] = statsFor('bench', ws)
    expect(s.maxWeight).toBe(60)
    expect(s.volume).toBe(1100)
    expect(s.totalReps).toBe(20)
  })
  it('PR detection: first record is not a PR, later improvement is', () => {
    const w1 = wk('1', '2026-01-01', 'bench', [{ id: 'a', weight: 60, reps: 10 }])
    const w2 = wk('2', '2026-01-08', 'bench', [{ id: 'b', weight: 70, reps: 8 }])
    expect(detectPRs(w1.entries[0], bench, w1.date, [w1, w2], w1.id)).toEqual([])
    expect(detectPRs(w2.entries[0], bench, w2.date, [w1, w2], w2.id)).toEqual(['Est. 1RM', 'Max weight'])
  })
  it('weekStreak', () => {
    const ws = [
      wk('1', '2026-10-26', 'bench', []), // 週: 10/26
      wk('2', '2026-10-19', 'bench', []),
      wk('3', '2026-10-05', 'bench', []), // 1週空き
    ]
    expect(weekStreak(ws, new Date(2026, 10, 2))).toBe(2) // 2026-11-02(月)
    expect(weekStreak([], new Date(2026, 10, 2))).toBe(0)
  })
  it('monthGrid is Monday-first and whole weeks', () => {
    const g = monthGrid(2026, 10) // Nov 2026: Nov 1 is Sunday
    expect(g.length % 7).toBe(0)
    expect(g.slice(0, 6).every((c) => c === null)).toBe(true)
    expect(g[6]).toBe('2026-11-01')
    expect(g.filter(Boolean).length).toBe(30)
    expect(monthGrid(2026, 1)[6]).toBe('2026-02-01') // Feb 1 2026 is Sunday, so 6 blanks first
  })
})
