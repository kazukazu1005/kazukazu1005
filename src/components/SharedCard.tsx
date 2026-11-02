import { useState } from 'react'
import Avatar from './Avatar'
import { REACTIONS } from '../reactions'
import type { FeedItem, Profile, SharedEntry } from '../social'
import { addComment, deleteComment, setReaction } from '../social'

export function describeShared(e: SharedEntry): string {
  if (e.kind === 'weight') return e.sets.map((s) => `${s.weight ?? 0}×${s.reps ?? 0}`).join('  ')
  return e.sets.map((s) => `${s.reps ?? 0}`).join('  ') + ' reps'
}

/** Per-set line for a shared entry. */
function setLine(e: SharedEntry, i: number): string {
  const s = e.sets[i]
  if (e.kind === 'weight') return `${s.weight ?? 0} kg × ${s.reps ?? 0}`
  return `${s.reps ?? 0} reps`
}

/** Teams-style reactions: one pill per emoji with a count, plus a "+" picker. */
function ReactionBar({ it, me, act }: { it: FeedItem; me: Profile; act: (f: () => Promise<void>) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const groups = REACTIONS.map((emoji) => {
    const list = it.reactions.filter((r) => r.emoji === emoji)
    return { emoji, count: list.length, mine: list.some((r) => r.user_id === me.id), names: list.map((r) => r.profiles?.username ?? 'user') }
  })
  const toggle = (emoji: string, mine: boolean) => {
    setOpen(false)
    return act(() => setReaction(it.id, me.id, emoji, !mine))
  }
  return (
    <div className="reactions">
      {groups.filter((g) => g.count > 0).map((g) => (
        <button
          key={g.emoji}
          className="react-pill"
          aria-pressed={g.mine}
          title={g.names.join(', ')}
          aria-label={`${g.emoji} ${g.count}: ${g.names.join(', ')}. ${g.mine ? 'Remove your reaction' : 'React'}`}
          onClick={() => toggle(g.emoji, g.mine)}
        >
          <span aria-hidden="true">{g.emoji}</span> {g.count}
        </button>
      ))}
      <span className="react-add">
        <button className="react-pill" aria-expanded={open} aria-label="Add reaction" onClick={() => setOpen(!open)}>＋</button>
        {open && (
          <div className="react-picker" role="group" aria-label="Choose a reaction">
            {groups.map((g) => (
              <button key={g.emoji} className="react-opt" aria-pressed={g.mine} aria-label={`${g.emoji}${g.mine ? ' (selected)' : ''}`} onClick={() => toggle(g.emoji, g.mine)}>
                {g.emoji}
              </button>
            ))}
          </div>
        )}
      </span>
    </div>
  )
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
  const author = it.profiles
  const name = author?.display_name || author?.username
  return (
    <article className="card" aria-label={`${author?.username ?? 'user'} ${it.date}`}>
      <div className="row spread">
        <h3 className="who">
          <Avatar profile={author} size={32} />
          {onOpenAuthor && author && it.user_id !== me.id ? (
            <button className="link" onClick={() => onOpenAuthor({ id: it.user_id, username: author.username, display_name: author.display_name, avatar: author.avatar })}>{name}</button>
          ) : name}{' '}
          <span className="sub">@{author?.username}</span>
        </h3>
        <span className="sub">{it.date}</span>
      </div>
      {it.title && <p style={{ margin: '4px 0', fontWeight: 600 }}>{it.title}</p>}
      {it.data.entries.filter((e) => e.kind === 'weight' || e.kind === 'bodyweight').map((e, i) => (
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
      <ReactionBar it={it} me={me} act={act} />
      {it.comments.map((c) => (
        <div key={c.id} className="comment row spread">
          <span className="who"><Avatar profile={c.profiles} size={20} /><span><b>{c.profiles?.username ?? 'user'}</b> {c.body}</span></span>
          {(c.user_id === me.id || it.user_id === me.id) && (
            <button className="btn danger small" aria-label="Delete comment" onClick={() => act(() => deleteComment(c.id))}>Delete</button>
          )}
        </div>
      ))}
      <CommentBox onSend={(body) => act(() => addComment(it.id, me.id, body))} />
    </article>
  )
}
