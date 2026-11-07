import { describe, expect, it } from 'vitest'
import { joinProfiles, profileIds, type RawFeedRow } from './feedJoin'

const row: RawFeedRow = {
  id: 'w1', user_id: 'u1', created_at: '2026-11-02T10:00:00Z', date: '2026-11-02', title: 'Push', note: '', data: { entries: [] },
  reactions: [{ user_id: 'u2', emoji: '🔥' }],
  comments: [
    { id: 'c2', user_id: 'u1', body: 'thanks', created_at: '2026-11-02T12:00:00Z' },
    { id: 'c1', user_id: 'u2', body: 'nice', created_at: '2026-11-02T11:00:00Z' },
  ],
}
const profiles = [
  { id: 'u1', username: 'haru', display_name: 'Haru', avatar: null },
  { id: 'u2', username: 'ren', display_name: 'Ren', avatar: 'data:image/jpeg;base64,xx' },
]

describe('feedJoin', () => {
  it('collects every person who appears once', () => {
    expect(profileIds([row, { ...row, id: 'w2' }]).sort()).toEqual(['u1', 'u2'])
  })
  it('attaches author, reactor and commenter names, and orders comments oldest first', () => {
    const [item] = joinProfiles([row], profiles)
    expect(item.profiles?.username).toBe('haru')
    expect(item.reactions[0].profiles?.username).toBe('ren')
    expect(item.comments.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(item.comments[0].profiles).toEqual({ username: 'ren', avatar: 'data:image/jpeg;base64,xx' })
  })
  it('still returns the workout when a profile is missing', () => {
    const [item] = joinProfiles([{ ...row, reactions: null, comments: null }], [])
    expect(item.profiles).toBeNull()
    expect(item.reactions).toEqual([])
    expect(item.comments).toEqual([])
  })
})
