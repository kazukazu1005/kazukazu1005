import type { FeedItem, Profile } from './social'

/** A shared workout as it comes back from the server, before names and photos are attached. */
export interface RawFeedRow {
  id: string
  user_id: string
  created_at: string
  date: string
  title: string
  note: string
  data: FeedItem['data']
  reactions: { user_id: string; emoji: string }[] | null
  comments: { id: string; user_id: string; body: string; created_at: string }[] | null
}

/** Every person who appears in these rows (authors, people who reacted, people who commented). */
export function profileIds(rows: RawFeedRow[]): string[] {
  const ids = new Set<string>()
  for (const r of rows) {
    ids.add(r.user_id)
    for (const x of r.reactions ?? []) ids.add(x.user_id)
    for (const c of r.comments ?? []) ids.add(c.user_id)
  }
  return [...ids]
}

/**
 * Attach names and photos. They are fetched in a separate query on purpose: asking the server to
 * embed profiles inside shared workouts is ambiguous (comments and reactions also link the two
 * tables), and the server answers with an error instead of data.
 */
export function joinProfiles(rows: RawFeedRow[], profiles: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar'>[]): FeedItem[] {
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const name = (id: string) => byId.get(id)
  return rows.map((r) => {
    const author = name(r.user_id)
    return {
      id: r.id,
      user_id: r.user_id,
      created_at: r.created_at,
      date: r.date,
      title: r.title,
      note: r.note,
      data: r.data,
      profiles: author ? { username: author.username, display_name: author.display_name, avatar: author.avatar ?? null } : null,
      reactions: (r.reactions ?? []).map((x) => ({ user_id: x.user_id, emoji: x.emoji, profiles: name(x.user_id) ? { username: name(x.user_id)!.username } : null })),
      comments: (r.comments ?? [])
        .slice()
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
        .map((c) => ({ ...c, profiles: name(c.user_id) ? { username: name(c.user_id)!.username, avatar: name(c.user_id)!.avatar ?? null } : null })),
    }
  })
}
