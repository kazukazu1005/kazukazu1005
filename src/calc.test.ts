import { describe, expect, it } from 'vitest'
import { detectPRs, estimate1RM, formatPace, pace, statsFor, weekStreak } from './calc'
import type { Exercise, Workout } from './types'

const bench: Exercise = { id: 'bench', name: 'ベンチ', kind: 'weight', part: '胸' }
const run: Exercise = { id: 'run', name: 'ラン', kind: 'cardio', part: '有酸素' }

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
  it('pace', () => {
    expect(pace(30, 5)).toBe(6)
    expect(pace(undefined, 5)).toBeNull()
    expect(formatPace(6.5)).toBe('6:30')
    expect(formatPace(null)).toBe('-')
  })
  it('warmup sets excluded from stats', () => {
    const ws = [wk('1', '2026-01-01', 'bench', [{ id: 'a', weight: 200, reps: 1, warmup: true }, { id: 'b', weight: 60, reps: 10 }])]
    const [s] = statsFor('bench', ws)
    expect(s.maxWeight).toBe(60)
    expect(s.volume).toBe(600)
  })
  it('PR detection: first record is not a PR, later improvement is', () => {
    const w1 = wk('1', '2026-01-01', 'bench', [{ id: 'a', weight: 60, reps: 10 }])
    const w2 = wk('2', '2026-01-08', 'bench', [{ id: 'b', weight: 70, reps: 8 }])
    expect(detectPRs(w1.entries[0], bench, w1.date, [w1, w2], w1.id)).toEqual([])
    expect(detectPRs(w2.entries[0], bench, w2.date, [w1, w2], w2.id)).toEqual(['推定1RM', '最大重量'])
  })
  it('cardio PR', () => {
    const w1 = wk('1', '2026-01-01', 'run', [{ id: 'a', durationMin: 30, distanceKm: 5 }])
    const w2 = wk('2', '2026-01-08', 'run', [{ id: 'b', durationMin: 28, distanceKm: 5.5 }])
    expect(detectPRs(w2.entries[0], run, w2.date, [w1, w2], w2.id)).toEqual(['最長距離', '最速ペース'])
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
})
