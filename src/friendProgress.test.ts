import { describe, expect, it } from 'vitest'
import { toProgressData } from './friendProgress'
import { statsFor } from './calc'
import type { FeedItem } from './social'

const item = (id: string, date: string, entries: FeedItem['data']['entries']): FeedItem => ({
  id, user_id: 'u', date, title: '', note: '', created_at: '', data: { entries }, profiles: null, reactions: [], comments: [],
})

describe('toProgressData', () => {
  it('merges the same exercise across days and ignores unknown kinds', () => {
    const { exercises, workouts } = toProgressData([
      item('a', '2026-10-01', [{ name: 'Bench press', kind: 'weight', part: 'Chest', sets: [{ id: '1', weight: 60, reps: 10 }], prs: [] }]),
      item('b', '2026-10-08', [
        { name: 'Bench press', kind: 'weight', part: 'Chest', sets: [{ id: '2', weight: 70, reps: 5 }], prs: [] },
        { name: 'Running', kind: 'cardio' as never, part: 'Cardio', sets: [], prs: [] },
      ]),
    ])
    expect(exercises).toHaveLength(1)
    const stats = statsFor(exercises[0].id, workouts)
    expect(stats.map((s) => s.date)).toEqual(['2026-10-01', '2026-10-08'])
    expect(stats[1].maxWeight).toBe(70)
  })
})
