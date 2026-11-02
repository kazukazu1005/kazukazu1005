import { useEffect, useState, type FormEvent } from 'react'
import type { Auth } from '../App'
import type { AppData } from '../data'
import Avatar from '../components/Avatar'
import { fileToAvatar } from '../avatar'
import { weekStreak } from '../calc'
import { signOut, updateAvatar, updateProfile } from '../social'
import { sharingConfigured } from '../supabase'
import { AuthForm, ProfileForm } from './Social'

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

export default function Profile({ data, auth }: { data: AppData; auth: Auth }) {
  if (!sharingConfigured)
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Profile</h2>
        <p>Profiles are used for sharing with friends. This build has no server settings, so there is nothing to set up yet. See docs/SETUP.md.</p>
      </section>
    )
  if (auth.loading) return <p>Loading…</p>
  if (!auth.session) return <><h2 style={{ marginTop: 0 }}>Create your profile</h2><AuthForm /></>
  if (!auth.profile) return <><h2 style={{ marginTop: 0 }}>Create your profile</h2><ProfileForm onDone={auth.refresh} /></>
  return <Editor data={data} auth={auth} />
}

function Editor({ data, auth }: { data: AppData; auth: Auth }) {
  const me = auth.profile!
  const [name, setName] = useState(me.display_name)
  const [bio, setBio] = useState(me.bio ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setName(me.display_name); setBio(me.bio ?? '') }, [me.display_name, me.bio])

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await f(); await auth.refresh(); setMsg({ ok: true, text: ok }) } catch (e) { setMsg({ ok: false, text: errText(e) }) }
    setBusy(false)
  }
  const save = (e: FormEvent) => {
    e.preventDefault()
    void run(() => updateProfile(me.id, { display_name: name.trim(), bio: bio.trim() }), 'Profile saved.')
  }

  const first = data.workouts.length ? data.workouts[data.workouts.length - 1].date : null
  const dirty = name.trim() !== me.display_name || bio.trim() !== (me.bio ?? '')

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Your profile</h2>
      {msg && <div role={msg.ok ? 'status' : 'alert'} className={`msg ${msg.ok ? 'ok' : ''}`}>{msg.text}</div>}

      <section className="card">
        <div className="row" style={{ gap: 16 }}>
          <Avatar profile={me} size={88} />
          <div className="grow">
            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{me.display_name || me.username}</div>
            <div className="sub">@{me.username}</div>
            <div className="sub">{auth.session?.user.email}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <label className="btn secondary small file-btn" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            {me.avatar ? 'Change photo' : 'Add photo'}
            <input
              className="visually-hidden"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) await run(async () => updateAvatar(me.id, await fileToAvatar(f)), 'Photo updated.')
              }}
            />
          </label>
          {me.avatar && <button className="btn danger small" disabled={busy} onClick={() => run(() => updateAvatar(me.id, null), 'Photo removed.')}>Remove photo</button>}
        </div>
      </section>

      <form className="card" onSubmit={save}>
        <div className="field-group">
          <label className="field" htmlFor="pname">Display name</label>
          <input id="pname" type="text" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={me.username} />
        </div>
        <div className="field-group">
          <label className="field" htmlFor="pbio">About you</label>
          <textarea id="pbio" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="e.g. Training 4 days a week. Goal: bench 100 kg." />
          <div className="sub" style={{ textAlign: 'right' }}>{bio.length}/160</div>
        </div>
        <p className="sub" style={{ marginTop: 0 }}>Your friends can see your photo, name and this text. Your username (@{me.username}) cannot be changed.</p>
        <button className="btn" disabled={busy || !dirty}>Save profile</button>
      </form>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Your training</h2>
        <div className="stats">
          <div className="stat"><span className="sub">Workouts logged</span><b>{data.workouts.length}</b></div>
          <div className="stat"><span className="sub">Week streak</span><b>{weekStreak(data.workouts)}</b></div>
          <div className="stat" style={{ gridColumn: '1 / -1' }}><span className="sub">Training since</span><b>{first ?? '—'}</b></div>
        </div>
      </section>

      <button className="btn secondary" onClick={() => run(signOut, 'Signed out.')}>Sign out</button>
    </>
  )
}
