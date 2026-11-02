import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Auth } from '../App'
import type { AppData } from '../data'
import { formatPace, pace } from '../calc'
import {
  addComment, addFriend, createProfile, deleteComment, fetchFeed, fetchFriends, fetchMyCode, regenerateCode, removeFriend,
  setLike, signIn, signOut, signUp, type FeedItem, type Profile, type SharedEntry,
} from '../social'
import { sharingConfigured } from '../supabase'

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

export default function Social({ data, auth }: { data: AppData; auth: Auth }) {
  if (!sharingConfigured)
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Sharing is not set up</h2>
        <p>This build has no server settings, so the app works as a private log. See docs/SETUP.md to turn on friend sharing.</p>
      </section>
    )
  if (auth.loading) return <p>Loading…</p>
  if (!auth.session) return <AuthForm />
  if (!auth.profile) return <ProfileForm onDone={auth.refresh} />
  return <SignedIn data={data} auth={auth} me={auth.profile} />
}

function AuthForm() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await (mode === 'in' ? signIn(email.trim(), password) : signUp(email.trim(), password))
    } catch (err) {
      setError(errText(err))
    }
    setBusy(false)
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>{mode === 'in' ? 'Sign in' : 'Create account'}</h2>
      <p className="sub">Only needed to share with friends. Your own log works without an account.</p>
      {error && <div role="alert" className="msg">{error}</div>}
      <div className="field-group">
        <label className="field" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field-group">
        <label className="field" htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === 'up' && <div className="sub">At least 8 characters.</div>}
      </div>
      <div className="row">
        <button className="btn grow" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="btn secondary" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError('') }}>
          {mode === 'in' ? 'New here?' : 'Have an account?'}
        </button>
      </div>
    </form>
  )
}

function ProfileForm({ onDone }: { onDone: () => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [display, setDisplay] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createProfile(username.trim(), display.trim())
      await onDone()
    } catch (err) {
      setError(errText(err))
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Choose a username</h2>
      {error && <div role="alert" className="msg">{error}</div>}
      <div className="field-group">
        <label className="field" htmlFor="un">Username</label>
        <input id="un" type="text" autoCapitalize="none" required pattern="[A-Za-z0-9_]{3,20}" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div className="sub">3–20 characters: letters, numbers, _</div>
      </div>
      <div className="field-group">
        <label className="field" htmlFor="dn">Display name (optional)</label>
        <input id="dn" type="text" maxLength={40} value={display} onChange={(e) => setDisplay(e.target.value)} />
      </div>
      <button className="btn">Save</button>
    </form>
  )
}

function SignedIn({ data, auth, me }: { data: AppData; auth: Auth; me: Profile }) {
  const [tab, setTab] = useState<'feed' | 'friends'>('feed')
  return (
    <>
      <div className="chips" role="group" aria-label="Section">
        <button className="chip" aria-pressed={tab === 'feed'} onClick={() => setTab('feed')}>Feed</button>
        <button className="chip" aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>Friends & account</button>
      </div>
      {tab === 'feed' ? <Feed me={me} data={data} /> : <Friends me={me} auth={auth} />}
    </>
  )
}

function describe(e: SharedEntry): string {
  const sets = e.sets.filter((s) => !s.warmup)
  if (e.kind === 'weight') return sets.map((s) => `${s.weight ?? 0}×${s.reps ?? 0}`).join('  ')
  if (e.kind === 'bodyweight') return sets.map((s) => `${s.reps ?? 0}`).join('  ') + ' reps'
  const km = sets.reduce((a, s) => a + (s.distanceKm ?? 0), 0)
  const min = sets.reduce((a, s) => a + (s.durationMin ?? 0), 0)
  return `${Math.round(km * 10) / 10} km · ${Math.round(min)} min · ${formatPace(pace(min, km))} /km`
}

function Feed({ me }: { me: Profile; data: AppData }) {
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setItems(await fetchFeed())
      setError('')
    } catch (e) {
      setError(errText(e))
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const act = async (f: () => Promise<void>) => {
    try { await f(); await load() } catch (e) { setError(errText(e)) }
  }

  return (
    <>
      {error && <div role="alert" className="msg">{error}</div>}
      <button className="btn secondary small" onClick={load}>Refresh</button>
      {items === null && !error && <p>Loading…</p>}
      {items?.length === 0 && <p className="sub">Nothing here yet. Tick “Share with friends” when you log a workout, and add friends in the next tab.</p>}
      {items?.map((it) => {
        const liked = it.reactions.some((r) => r.user_id === me.id)
        return (
          <article key={it.id} className="card" aria-label={`${it.profiles?.username ?? 'user'} ${it.date}`}>
            <div className="row spread">
              <h3>{it.profiles?.display_name || it.profiles?.username} <span className="sub">@{it.profiles?.username}</span></h3>
              <span className="sub">{it.date}</span>
            </div>
            {it.title && <p style={{ margin: '4px 0', fontWeight: 600 }}>{it.title}</p>}
            {it.data.entries.map((e, i) => (
              <div key={i} style={{ margin: '6px 0' }}>
                <b>{e.name}</b> {e.prs.map((p) => <span key={p} className="badge" style={{ marginLeft: 4 }}>PR: {p}</span>)}
                <div className="sub">{describe(e)}</div>
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
      })}
    </>
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

function Friends({ me, auth }: { me: Profile; auth: Auth }) {
  const [friends, setFriends] = useState<Profile[]>([])
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setFriends(await fetchFriends(me.id))
      setCode(await fetchMyCode())
    } catch (e) {
      setMsg({ ok: false, text: errText(e) })
    }
  }, [me.id])
  useEffect(() => { void load() }, [load])

  const run = async (f: () => Promise<unknown>, ok: string) => {
    try { await f(); setMsg({ ok: true, text: ok }); await load() } catch (e) { setMsg({ ok: false, text: errText(e) }) }
  }

  return (
    <>
      {msg && <div role={msg.ok ? 'status' : 'alert'} className={`msg ${msg.ok ? 'ok' : ''}`}>{msg.text}</div>}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Your invite code</h2>
        <p className="sub">Send this to a friend. Anyone who enters it becomes your friend and can see workouts you share. Regenerate it if it leaks.</p>
        <p><code aria-label="Your invite code" style={{ fontSize: '1.25rem' }}>{code}</code></p>
        <div className="row">
          <button className="btn secondary small" onClick={() => navigator.clipboard?.writeText(code).then(() => setMsg({ ok: true, text: 'Copied.' }), () => setMsg({ ok: false, text: 'Could not copy.' }))}>Copy</button>
          <button className="btn secondary small" onClick={() => run(async () => setCode(await regenerateCode()), 'New code created. The old one no longer works.')}>Regenerate</button>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Add a friend</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void run(async () => { await addFriend(input); setInput('') }, 'Friend added.') }}>
          <div className="grow">
            <label className="field" htmlFor="fc">Friend’s invite code</label>
            <input id="fc" type="text" autoCapitalize="none" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <button className="btn" style={{ alignSelf: 'flex-end' }} disabled={!input.trim()}>Add</button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Friends ({friends.length})</h2>
        {friends.length === 0 && <p className="sub">No friends yet.</p>}
        {friends.map((f) => (
          <div key={f.id} className="row spread comment">
            <span>{f.display_name || f.username} <span className="sub">@{f.username}</span></span>
            <button className="btn danger small" onClick={() => confirm(`Remove @${f.username}? You will stop seeing each other's workouts.`) && run(() => removeFriend(me.id, f.id), 'Friend removed.')}>Remove</button>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Account</h2>
        <p className="sub">Signed in as @{me.username} ({auth.session?.user.email})</p>
        <button className="btn secondary" onClick={() => run(signOut, 'Signed out.')}>Sign out</button>
      </section>
    </>
  )
}
