import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Auth } from '../App'
import type { AppData } from '../data'
import Calendar from '../components/Calendar'
import Avatar from '../components/Avatar'
import RefreshButton from '../components/RefreshButton'
import SharedCard from '../components/SharedCard'
import { fileToAvatar } from '../avatar'
import { toDateStr } from '../calc'
import {
  addFriend, createProfile, fetchFeed, fetchFriendLog, fetchFriends, fetchMyCode, regenerateCode, removeFriend,
  signIn, signOut, signUp, updateAvatar, type FeedItem, type Profile,
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
  const [viewing, setViewing] = useState<Profile | null>(null)
  if (viewing) return <FriendLog me={me} friend={viewing} onBack={() => setViewing(null)} />
  return (
    <>
      <div className="chips" role="group" aria-label="Section">
        <button className="chip" aria-pressed={tab === 'feed'} onClick={() => setTab('feed')}>Feed</button>
        <button className="chip" aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>Friends & account</button>
      </div>
      {tab === 'feed' ? <Feed me={me} data={data} onOpen={setViewing} /> : <Friends me={me} auth={auth} onOpen={setViewing} />}
    </>
  )
}

function Feed({ me, onOpen }: { me: Profile; data: AppData; onOpen: (p: Profile) => void }) {
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
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Feed</h2>
        <RefreshButton onRefresh={load} />
      </div>
      {error && <div role="alert" className="msg">{error}</div>}
      {items === null && !error && <p>Loading…</p>}
      {items?.length === 0 && <p className="sub">Nothing here yet. Add friends in the next tab; every workout you save is shared with them automatically.</p>}
      {items?.map((it) => <SharedCard key={it.id} it={it} me={me} act={act} onOpenAuthor={onOpen} />)}
    </>
  )
}

function FriendLog({ me, friend, onBack }: { me: Profile; friend: Profile; onBack: () => void }) {
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(toDateStr(new Date()))
  const load = useCallback(async () => {
    try {
      setItems(await fetchFriendLog(friend.id))
      setError('')
    } catch (e) {
      setError(errText(e))
    }
  }, [friend.id])
  useEffect(() => { void load() }, [load])
  const act = async (f: () => Promise<void>) => {
    try { await f(); await load() } catch (e) { setError(errText(e)) }
  }

  const byDate = useMemo(() => {
    const m = new Map<string, FeedItem[]>()
    for (const it of items ?? []) m.set(it.date, [...(m.get(it.date) ?? []), it])
    return m
  }, [items])
  const marks = (date: string) => ({ count: byDate.get(date)?.length ?? 0 })
  const day = byDate.get(selected) ?? []
  const selLabel = new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const name = friend.display_name || friend.username

  return (
    <>
      <div className="row spread">
        <button className="btn secondary small" onClick={onBack}>‹ Back</button>
        <RefreshButton onRefresh={load} />
      </div>
      <h2 className="who" style={{ marginTop: 12 }}><Avatar profile={friend} size={48} /><span>{name} <span className="sub">@{friend.username}</span></span></h2>
      {error && <div role="alert" className="msg">{error}</div>}
      {items === null && !error && <p>Loading…</p>}
      {items && (
        <>
          <p className="sub">{items.length} shared {items.length === 1 ? 'workout' : 'workouts'} in total. Only workouts {name} chose to share appear here.</p>
          <Calendar marks={marks} selected={selected} onSelect={setSelected} />
          <h2>{selLabel}</h2>
          {day.length === 0 && <p className="sub">Nothing shared on this day.</p>}
          {day.map((it) => <SharedCard key={it.id} it={it} me={me} act={act} detail />)}
        </>
      )}
    </>
  )
}

function Friends({ me, auth, onOpen }: { me: Profile; auth: Auth; onOpen: (p: Profile) => void }) {
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
        <p className="sub">Send this to a friend. Anyone who enters it becomes your friend and can see every workout you save. Regenerate it if it leaks.</p>
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
            <span className="who"><Avatar profile={f} size={36} /><span>{f.display_name || f.username} <span className="sub">@{f.username}</span></span></span>
            <span className="row">
              <button className="btn secondary small" onClick={() => onOpen(f)}>View log</button>
              <button className="btn danger small" onClick={() => confirm(`Remove @${f.username}? You will stop seeing each other's workouts.`) && run(() => removeFriend(me.id, f.id), 'Friend removed.')}>Remove</button>
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Profile</h2>
        <div className="row" style={{ gap: 16 }}>
          <Avatar profile={me} size={72} />
          <div>
            <div style={{ fontWeight: 600 }}>{me.display_name || me.username}</div>
            <div className="sub">@{me.username} · {auth.session?.user.email}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <label className="btn secondary small file-btn" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            {me.avatar ? 'Change photo' : 'Add photo'}
            <input
              className="visually-hidden"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                await run(async () => { await updateAvatar(me.id, await fileToAvatar(f)); await auth.refresh() }, 'Photo updated.')
              }}
            />
          </label>
          {me.avatar && <button className="btn danger small" onClick={() => run(async () => { await updateAvatar(me.id, null); await auth.refresh() }, 'Photo removed.')}>Remove photo</button>}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Account</h2>
        <button className="btn secondary" onClick={() => run(signOut, 'Signed out.')}>Sign out</button>
      </section>
    </>
  )
}
