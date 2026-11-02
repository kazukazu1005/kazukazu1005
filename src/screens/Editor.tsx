import { useState } from 'react'
import type { Auth, Route } from '../App'
import type { AppData } from '../data'
import { db, uid } from '../db'
import { detectPRs, formatPace, pace, toDateStr } from '../calc'
import { PARTS, newCustomExercise } from '../exercises'
import { buildPayload, pushWorkout, removeShared } from '../social'
import { sharingConfigured } from '../supabase'
import { KIND_LABEL, type Entry, type Exercise, type ExerciseKind, type SetRec, type Workout } from '../types'

const num = (v: string): number | undefined => (v === '' || isNaN(Number(v)) || Number(v) < 0 ? undefined : Number(v))

function lastRecord(data: AppData, exerciseId: string, date: string, selfId: string): { date: string; sets: SetRec[] } | null {
  for (const w of data.workouts) {
    if (w.id === selfId || w.date > date) continue
    const e = w.entries.find((x) => x.exerciseId === exerciseId)
    if (e && e.sets.length) return { date: w.date, sets: e.sets }
  }
  return null
}

function describeSet(s: SetRec, kind: ExerciseKind): string {
  if (kind === 'weight') return `${s.weight ?? 0}kg×${s.reps ?? 0}`
  if (kind === 'bodyweight') return `${s.reps ?? 0} reps`
  return `${s.distanceKm ?? 0} km / ${s.durationMin ?? 0} min`
}

export default function Editor({ data, auth, id, date, go }: { data: AppData; auth: Auth; id?: string; date?: string; go: (r: Route) => void }) {
  const existing = id ? data.workouts.find((w) => w.id === id) : undefined
  const [w, setW] = useState<Workout>(
    () =>
      existing ?? { id: uid(), date: date ?? toDateStr(new Date()), title: '', note: '', entries: [], createdAt: Date.now(), updatedAt: Date.now() },
  )
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState('')

  const patchEntry = (eid: string, f: (e: Entry) => Entry) => setW({ ...w, entries: w.entries.map((e) => (e.id === eid ? f(e) : e)) })
  const patchSet = (eid: string, sid: string, p: Partial<SetRec>) =>
    patchEntry(eid, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === sid ? { ...s, ...p } : s)) }))

  const addExercise = (ex: Exercise) => {
    const prev = lastRecord(data, ex.id, w.date, w.id)
    const first: SetRec = prev ? { ...prev.sets[prev.sets.length - 1], id: uid(), warmup: false } : { id: uid() }
    setW({ ...w, entries: [...w.entries, { id: uid(), exerciseId: ex.id, sets: [first] }] })
    setPicker(false)
  }

  const addSet = (e: Entry) => {
    const last = e.sets[e.sets.length - 1]
    patchEntry(e.id, (x) => ({ ...x, sets: [...x.sets, last ? { ...last, id: uid(), warmup: false } : { id: uid() }] }))
  }

  const canShare = sharingConfigured && !!auth.session && !!auth.profile
  const wasShared = existing?.visibility === 'friends'

  const save = async () => {
    setError('')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) return setError('Please enter a date.')
    if (w.entries.length === 0) return setError('Add at least one exercise.')
    const wantShare = w.visibility === 'friends'

    // Stopping sharing must remove the server copy first, so nothing stays visible by mistake.
    if (wasShared && !wantShare && sharingConfigured) {
      try {
        if (!auth.session) throw new Error('Sign in (Friends tab) to stop sharing this workout.')
        await removeShared(w.id)
      } catch (e) {
        return setError(`Could not remove the shared copy: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }

    const next: Workout = { ...w, visibility: wantShare ? 'friends' : 'private', synced: false, updatedAt: Date.now() }
    if (wantShare && canShare) {
      try {
        await pushWorkout(auth.session!.user.id, next, buildPayload(next, data.exercises, data.workouts))
        next.synced = true
      } catch (e) {
        await db.workouts.put(next)
        setW(next)
        return setError(`Saved on this device, but sharing failed (it will retry later): ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
    if (!wantShare) next.synced = undefined
    await db.workouts.put(next)
    go({ name: 'home' })
  }

  const remove = async () => {
    if (!confirm('Delete this workout? This cannot be undone.')) return
    if (wasShared && sharingConfigured) {
      try {
        if (!auth.session) throw new Error('Sign in (Friends tab) to delete a shared workout.')
        await removeShared(w.id)
      } catch (e) {
        return setError(`Could not remove the shared copy: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
    await db.workouts.delete(w.id)
    go({ name: 'home' })
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{existing ? 'Edit workout' : 'Log a workout'}</h2>
      {error && <div role="alert" className="msg">{error}</div>}

      <div className="row">
        <div className="field-group grow">
          <label className="field" htmlFor="date">Date</label>
          <input id="date" type="date" value={w.date} onChange={(e) => setW({ ...w, date: e.target.value })} />
        </div>
        <div className="field-group grow">
          <label className="field" htmlFor="title">Title (optional)</label>
          <input id="title" type="text" value={w.title} placeholder="e.g. Chest day" onChange={(e) => setW({ ...w, title: e.target.value })} />
        </div>
      </div>

      {w.entries.map((e) => {
        const ex = data.exercises.get(e.exerciseId)
        if (!ex) return null
        const prev = lastRecord(data, ex.id, w.date, w.id)
        const prs = detectPRs(e, ex, w.date, data.workouts, w.id)
        return (
          <section key={e.id} className="card" aria-label={ex.name}>
            <div className="row spread">
              <h3>{ex.name}</h3>
              <button className="btn danger small" onClick={() => setW({ ...w, entries: w.entries.filter((x) => x.id !== e.id) })} aria-label={`Remove ${ex.name}`}>Remove</button>
            </div>
            {prs.length > 0 && <p style={{ margin: '4px 0' }}>{prs.map((p) => <span key={p} className="badge" style={{ marginRight: 4 }}>New PR: {p}</span>)}</p>}
            {prev && <p className="sub">Last time ({prev.date}): {prev.sets.map((s) => describeSet(s, ex.kind)).join(', ')}</p>}

            {e.sets.map((s, i) => (
              <div key={s.id}>
                <div className={`set-row${s.warmup ? ' warm' : ''}`}>
                  <span className="num">{i + 1}</span>
                  {ex.kind === 'weight' && (
                    <>
                      <div><label className="sub" htmlFor={`w${s.id}`}>Weight (kg)</label><input id={`w${s.id}`} type="number" inputMode="decimal" min="0" step="0.5" value={s.weight ?? ''} onChange={(ev) => patchSet(e.id, s.id, { weight: num(ev.target.value) })} /></div>
                      <div><label className="sub" htmlFor={`r${s.id}`}>Reps</label><input id={`r${s.id}`} type="number" inputMode="numeric" min="0" step="1" value={s.reps ?? ''} onChange={(ev) => patchSet(e.id, s.id, { reps: num(ev.target.value) })} /></div>
                    </>
                  )}
                  {ex.kind === 'bodyweight' && (
                    <>
                      <div><label className="sub" htmlFor={`r${s.id}`}>Reps</label><input id={`r${s.id}`} type="number" inputMode="numeric" min="0" step="1" value={s.reps ?? ''} onChange={(ev) => patchSet(e.id, s.id, { reps: num(ev.target.value) })} /></div>
                      <div />
                    </>
                  )}
                  {ex.kind === 'cardio' && (
                    <>
                      <div><label className="sub" htmlFor={`t${s.id}`}>Minutes</label><input id={`t${s.id}`} type="number" inputMode="decimal" min="0" step="0.5" value={s.durationMin ?? ''} onChange={(ev) => patchSet(e.id, s.id, { durationMin: num(ev.target.value) })} /></div>
                      <div><label className="sub" htmlFor={`d${s.id}`}>Distance (km)</label><input id={`d${s.id}`} type="number" inputMode="decimal" min="0" step="0.1" value={s.distanceKm ?? ''} onChange={(ev) => patchSet(e.id, s.id, { distanceKm: num(ev.target.value) })} /></div>
                    </>
                  )}
                  <button className="btn danger small" aria-label={`Delete set ${i + 1}`} onClick={() => patchEntry(e.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}>Delete</button>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  {ex.kind !== 'cardio' && (
                    <label className="check"><input type="checkbox" checked={!!s.warmup} onChange={(ev) => patchSet(e.id, s.id, { warmup: ev.target.checked })} />Warm-up (not counted)</label>
                  )}
                  {ex.kind === 'cardio' && <span className="sub">Pace: {formatPace(pace(s.durationMin, s.distanceKm))} min/km</span>}
                </div>
              </div>
            ))}
            <button className="btn secondary block" onClick={() => addSet(e)}>Add set (copy previous)</button>
          </section>
        )
      })}

      <button className="btn secondary block" onClick={() => setPicker(true)}>Add exercise</button>

      <div className="field-group" style={{ marginTop: 16 }}>
        <label className="check">
          <input
            type="checkbox"
            checked={w.visibility === 'friends'}
            disabled={!sharingConfigured}
            onChange={(e) => setW({ ...w, visibility: e.target.checked ? 'friends' : 'private' })}
          />
          Share with friends
        </label>
        {!sharingConfigured && <div className="sub">Sharing is not set up in this build.</div>}
        {sharingConfigured && w.visibility === 'friends' && !canShare && (
          <div className="sub">Sign in on the Friends tab. It will be shared automatically afterwards.</div>
        )}
      </div>

      <div className="field-group">
        <label className="field" htmlFor="note">Notes (optional)</label>
        <textarea id="note" value={w.note} onChange={(e) => setW({ ...w, note: e.target.value })} />
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn grow" onClick={save}>Save</button>
        {existing && <button className="btn danger" onClick={remove}>Delete</button>}
      </div>

      {picker && <Picker data={data} onPick={addExercise} onClose={() => setPicker(false)} />}
    </>
  )
}

function Picker({ data, onPick, onClose }: { data: AppData; onPick: (e: Exercise) => void; onClose: () => void }) {
  const [part, setPart] = useState<string>('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ExerciseKind>('weight')
  const [cPart, setCPart] = useState<string>('Chest')

  const list = data.allExercises.filter((e) => (!part || e.part === part) && e.name.includes(q.trim()))

  const create = async () => {
    if (!name.trim()) return
    const ex = newCustomExercise(name, kind, kind === 'cardio' ? 'Cardio' : cPart)
    await db.customExercises.put(ex)
    onPick(ex)
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Choose exercise" onClick={(e) => e.stopPropagation()}>
        <div className="row spread">
          <h2 style={{ margin: 0 }}>Choose exercise</h2>
          <button className="btn secondary small" onClick={onClose}>Close</button>
        </div>
        {!creating ? (
          <>
            <div className="field-group" style={{ marginTop: 8 }}>
              <label className="field" htmlFor="q">Search</label>
              <input id="q" type="text" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="chips" role="group" aria-label="Body part">
              <button className="chip" aria-pressed={part === ''} onClick={() => setPart('')}>All</button>
              {PARTS.map((p) => <button key={p} className="chip" aria-pressed={part === p} onClick={() => setPart(p)}>{p}</button>)}
            </div>
            <div>
              {list.map((e) => <button key={e.id} className="list-btn" onClick={() => onPick(e)}>{e.name}<span className="sub">  {e.part}{e.custom ? ' · custom' : ''}</span></button>)}
              {list.length === 0 && <p className="sub">Nothing found. You can create your own below.</p>}
            </div>
            <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => { setName(q); setCreating(true) }}>Create custom exercise</button>
          </>
        ) : (
          <>
            <div className="field-group" style={{ marginTop: 8 }}>
              <label className="field" htmlFor="cn">Name</label>
              <input id="cn" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field" htmlFor="ck">Tracking type</label>
              <select id="ck" value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
                {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            {kind !== 'cardio' && (
              <div className="field-group">
                <label className="field" htmlFor="cp">Body part</label>
                <select id="cp" value={cPart} onChange={(e) => setCPart(e.target.value)}>
                  {PARTS.filter((p) => p !== 'Cardio').map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div className="row">
              <button className="btn grow" disabled={!name.trim()} onClick={create}>Create and add</button>
              <button className="btn secondary" onClick={() => setCreating(false)}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
