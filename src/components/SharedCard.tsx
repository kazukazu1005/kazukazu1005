import { useState } from 'react'
import { formatPace, pace } from '../calc'
import type { FeedItem, Profile, SharedEntry } from '../social'
import { addComment, deleteComment, setLike } from '../social'

export function describeShared(e: SharedEntry): string {
  const sets = e.sets.filter((s) => !s.warmup)
  if (e.kind === 'weight') return sets.map((s) => `${s.weight ?? 0}×${s.reps ?? 0}`).join('  ')
  if (e.kind === 'bodyweight') return sets.map((s) => `${s.reps ?? 0}`).join('  ') + ' reps'
  const km = sets.reduce((a, s) => a + (s.distanceKm ?? 0), 0)
  const min = sets.reduce((a, s) => a + (s.durationMin ?? 0), 0)
  return `${Math.round(km * 10) / 10} km · ${Math.round(min)} min · ${formatPace(pace(min, km))} /km`
}

/** Per-set lines for a shared entry (warm-ups marked). */
function setLine(e: SharedEntry, i: number): string {
  const s = e.sets[i]
  const w = s.warmup ? ' (warm-up)' : ''
  if (e.kind === 'weight') return `${s.weight ?? 0} kg × ${s.reps ?? 0}${w}`
  if (e.kind === 'bodyweight') return `${s.reps ?? 0} reps${w}`
  const p = pace(s.durationMin, s.distanceKm)
  return `${s.distanceKm ?? 0} km · ${s.durationMin ?? 0} min${p === null ? '' : ` · ${formatPace(p)}/km`}`
}

function CommentBox({ onSend }: { onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('')
  return (
    <form
      className="row"
      style={{ marginTop: 8 }}
      onSubmit={async (e) => {
        e.preventDefault()
        if (!body.trim()) return
        await onSend(body.trim())
        setBody('')
      }}
    >
      <input type="text" className="grow" aria-label="Write a comment" placeholder="Write a comment" maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} style={{ width: 'auto' }} />
      <button className="btn secondary small">Send</button>
    </form>
  )
}

/**
 * One shared workout. `detail` lists every set; otherwise a compact summary (used in the feed).
 * `act` runs a server action and then reloads the list.
 */
export default function SharedCard({
  it, me, act, detail, onOpenAuthor,
}: {
  it: FeedItem
  me: Profile
  act: (f: () => Promise<void>) => Promise<void>
  detail?: boolean
  onOpenAuthor?: (p: Profile) => void
}) {
  const liked = it.reactions.some((r) => r.user_id === me.id)
  const author = it.profiles
  const name = author?.display_name || author?.username
  return (
    <article className="card" aria-label={`${author?.username ?? 'user'} ${it.date}`}>
      <div className="row spread">
        <h3>
          {onOpenAuthor && author && it.user_id !== me.id ? (
            <button className="link" onClick={() => onOpenAuthor({ id: it.user_id, username: author.username, display_name: author.display_name })}>{name}</button>
          ) : name}{' '}
          <span className="sub">@{author?.username}</span>
        </h3>
        <span className="sub">{it.date}</span>
      </div>
      {it.title && <p style={{ margin: '4px 0', fontWeight: 600 }}>{it.title}</p>}
      {it.data.entries.map((e, i) => (
        <div key={i} className={detail ? 'day-entry' : undefined} style={detail ? undefined : { margin: '6px 0' }}>
          <div className="row spread">
            <span>
              <b>{e.name}</b> {e.prs.map((p) => <span key={p} className="badge" style={{ marginLeft: 4 }}>PR: {p}</span>)}
            </span>
            {detail && <span className="badge plain">{e.part}</span>}
          </div>
          {detail ? (
            <ol className="sets">{e.sets.map((_, j) => <li key={j}>{setLine(e, j)}</li>)}</ol>
          ) : (
            <div className="sub">{describeShared(e)}</div>
          )}
        </div>
      ))}
      {it.note && <p className="sub" style={{ whiteSpace: 'pre-wrap' }}>{it.note}</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn secondary small" aria-pressed={liked} onClick={() => act(() => setLike(it.id, me.id, !liked))}>
          {liked ? 'Liked' : 'Like'} · {it.reactions.length}
        </button>
      </div>
      {it.comments.map((c) => (
        <div key={c.id} className="comment row spread">
          <span><b>{c.profiles?.username ?? 'user'}</b> {c.body}</span>
          {(c.user_id === me.id || it.user_id === me.id) && (
            <button className="btn danger small" aria-label="Delete comment" onClick={() => act(() => deleteComment(c.id))}>Delete</button>
          )}
        </div>
      ))}
      <CommentBox onSend={(body) => act(() => addComment(it.id, me.id, body))} />
    </article>
  )
}
