import { useEffect, useRef, useState } from 'react'
import type { Auth, Route } from '../App'
import type { AppData } from '../data'
import { db, uid } from '../db'
import { detectPRs, new1RMRecord, toDateStr } from '../calc'
import { celebrate } from '../celebrate'
import { PARTS, newCustomExercise } from '../exercises'
import { clearDraft, hasContent, loadDraft, saveDraft } from '../draft'
import { cleanEntries, contentKey, retargetEntry } from '../entryOps'
import { describeSet, fmtKg, setRM } from '../format'
import { buildPayload, pushWorkout, removeShared } from '../social'
import { sharingConfigured } from '../supabase'
import { showToast } from '../toast'
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

export default function Editor({ data, auth, id, date, go }: { data: AppData; auth: Auth; id?: string; date?: string; go: (r: Route) => void }) {
  const existing = id ? data.workouts.find((w) => w.id === id) : undefined
  const fresh = (): Workout => ({ id: uid(), date: date ?? toDateStr(new Date()), title: '', note: '', entries: [], createdAt: Date.now(), updatedAt: Date.now() })

  // A brand-new workout with nothing filled in yet is only kept as a draft; as soon as a set is
  // filled in, everything is saved automatically (see below).
  const [start] = useState(() => {
    const d = existing ? null : loadDraft('new')
    return d ? { w: d.w, restored: true } : { w: existing ?? fresh(), restored: false }
  })
  const [w, setW] = useState<Workout>(start.w)
  const [restored, setRestored] = useState(start.restored)
  const [picker, setPicker] = useState<{ entryId?: string } | null>(null)
  const [error, setError] = useState('')
  const [savedOnce, setSavedOnce] = useState(!!existing)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(existing ? 'saved' : 'idle')

  const latest = useRef(w)
  latest.current = w
  const dataRef = useRef(data)
  dataRef.current = data
  const opened = useRef(existing) // the saved version when this screen opened: the bar a new 1RM record must beat
  const lastSaved = useRef(existing ? contentKey(existing) : '')
  const finished = useRef(false) // left the screen, or deleted: stop saving
  const celebrated = useRef(false)
  const chain = useRef<Promise<void>>(Promise.resolve()) // saves run one at a time

  /** Save what is filled in to this device. Sharing happens through the normal "send pending" step. */
  const saveLocal = (x: Workout): Promise<void> => {
    const key = contentKey(x)
    const entries = cleanEntries(x.entries)
    if (entries.length === 0 || key === lastSaved.current || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return chain.current
    lastSaved.current = key
    setStatus('saving')
    chain.current = chain.current.then(async () => {
      try {
        const row = await db.workouts.get(x.id)
        await db.workouts.put({ ...x, entries, everShared: row?.everShared ?? x.everShared, synced: false, updatedAt: Date.now() })
        setSavedOnce(true)
        setStatus('saved')
      } catch {
        lastSaved.current = '' // try again on the next change
        setStatus('error')
      }
    })
    return chain.current
  }

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (finished.current) return
    const t = setTimeout(() => void saveLocal(w), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])

  // Drafts only matter for a new workout that has nothing filled in yet.
  useEffect(() => {
    if (existing || finished.current) return
    const t = setTimeout(() => {
      if (cleanEntries(w.entries).length > 0) clearDraft('new')
      else if (hasContent(w) || w.entries.length > 0) saveDraft('new', w, 0)
      else clearDraft('new')
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])

  // A new personal best for estimated 1RM? Compare with the workouts as they were when this screen opened.
  const celebrateRecords = (saved: Workout) => {
    if (celebrated.current) return
    const base = [...dataRef.current.workouts.filter((x) => x.id !== saved.id), ...(opened.current ? [opened.current] : [])]
    const items = saved.entries.flatMap((e) => {
      const ex = dataRef.current.exercises.get(e.exerciseId)
      const r = ex ? new1RMRecord(e, ex, base) : null
      return ex && r ? [{ name: ex.name, next: r.next, prev: r.prev, date: saved.date }] : []
    })
    if (items.length) {
      celebrated.current = true
      celebrate(items)
    }
  }

  // Leaving the screen any other way (tab, back): write what is pending, and still celebrate a record.
  useEffect(
    () => () => {
      if (finished.current) return
      const x = latest.current
      void saveLocal(x)
      if (cleanEntries(x.entries).length > 0) celebrateRecords({ ...x, entries: cleanEntries(x.entries) })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const discardDraft = () => {
    clearDraft('new')
    setW(fresh())
    setRestored(false)
  }

  const patchEntry = (eid: string, f: (e: Entry) => Entry) => setW({ ...w, entries: w.entries.map((e) => (e.id === eid ? f(e) : e)) })
  const patchSet = (eid: string, sid: string, p: Partial<SetRec>) =>
    patchEntry(eid, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === sid ? { ...s, ...p } : s)) }))

  const pickExercise = (ex: Exercise) => {
    if (picker?.entryId) {
      // Change which exercise an entry is for; its sets stay.
      setW({ ...w, entries: w.entries.map((e) => (e.id === picker.entryId ? retargetEntry(e, ex) : e)) })
    } else {
      // A new exercise starts with 3 empty sets, ready to fill in.
      const sets: SetRec[] = [{ id: uid() }, { id: uid() }, { id: uid() }]
      setW({ ...w, entries: [...w.entries, { id: uid(), exerciseId: ex.id, sets }] })
    }
    setPicker(null)
  }

  const addSet = (e: Entry) => patchEntry(e.id, (x) => ({ ...x, sets: [...x.sets, { id: uid() }] }))

  const canShare = sharingConfigured && !!auth.session && !!auth.profile

  /** "Done": make sure everything is saved (and sent, when signed in), then close. */
  const [saving, setSaving] = useState(false)
  const done = async () => {
    if (saving) return
    setSaving(true)
    try { await finish() } finally { setSaving(false) }
  }

  const finish = async () => {
    setError('')
    await chain.current
    const entries = cleanEntries(w.entries)
    if (entries.length === 0) {
      if (savedOnce) return setError('Enter at least one set (weight and reps), or delete this workout.')
      finished.current = true // nothing was entered: just close
      clearDraft('new')
      return go({ name: 'home' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) return setError('Please enter a date.')

    const row = await db.workouts.get(w.id)
    const next: Workout = { ...w, entries, everShared: row?.everShared ?? w.everShared, synced: false, updatedAt: Date.now() }
    lastSaved.current = contentKey(next)
    if (canShare) {
      try {
        await pushWorkout(auth.session!.user.id, next, buildPayload(next, data.exercises, data.workouts))
        next.synced = true
        next.everShared = true
      } catch (e) {
        await db.workouts.put(next)
        setSavedOnce(true)
        celebrateRecords(next)
        return setError(`Saved on this device, but sharing failed (it will retry later): ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
    await db.workouts.put(next)
    finished.current = true
    clearDraft('new')
    showToast(next.synced ? 'Saved and shared with friends' : 'Saved on this device')
    go({ name: 'home' })
    celebrateRecords(next)
  }

  const remove = async () => {
    if (!confirm('Delete this workout? Friends will no longer see it either. This cannot be undone.')) return
    finished.current = true // stop autosaving, or it could bring the workout back
    await chain.current
    // The shared copy must be removed first so it never stays visible by mistake.
    const row = await db.workouts.get(w.id)
    if (sharingConfigured && (row?.everShared || w.everShared || auth.session)) {
      try {
        if (!auth.session) throw new Error('Sign in (Friends tab) to delete a workout that was shared.')
        await removeShared(w.id)
      } catch (e) {
        finished.current = false
        return setError(`Could not remove the shared copy: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
    await db.workouts.delete(w.id)
    clearDraft('new')
    showToast('Workout deleted')
    go({ name: 'home' })
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{savedOnce ? 'Edit workout' : 'Log a workout'}</h2>
      {restored && (
        <div role="status" className="msg ok row spread">
          <span>Restored your unsaved input.</span>
          <button className="btn secondary small" onClick={discardDraft}>Discard</button>
        </div>
      )}
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
              <span className="row">
                <button className="btn secondary small" onClick={() => setPicker({ entryId: e.id })} aria-label={`Change exercise for ${ex.name}`}>Change</button>
                <button className="btn danger small" onClick={() => setW({ ...w, entries: w.entries.filter((x) => x.id !== e.id) })} aria-label={`Remove ${ex.name}`}>Remove</button>
              </span>
            </div>
            {prs.length > 0 && <p style={{ margin: '4px 0' }}>{prs.map((p) => <span key={p} className="badge" style={{ marginRight: 4 }}>New PR: {p}</span>)}</p>}
            {prev && <p className="sub">Last time ({prev.date}): {prev.sets.map((s) => describeSet(s, ex.kind)).join(' / ')}</p>}

            <div role="group" aria-label={`${ex.name} sets`}>
              <div className={`set-grid set-head ${ex.kind}`} aria-hidden="true">
                <span>Set</span>
                {ex.kind === 'weight' && <span>kg</span>}
                <span>Reps</span>
                {ex.kind === 'weight' && <span className="r" title="Estimated 1RM: weight × (1 + reps ÷ 30)">1RM</span>}
                <span />
              </div>
              {e.sets.map((s, i) => {
                const rm = ex.kind === 'weight' ? setRM(s) : null
                return (
                  <div key={s.id} className={`set-grid ${ex.kind}`}>
                    <span className="num">{i + 1}</span>
                    {ex.kind === 'weight' && (
                      <input type="number" inputMode="decimal" min="0" step="0.5" aria-label={`Set ${i + 1} weight (kg)`} value={s.weight ?? ''} onChange={(ev) => patchSet(e.id, s.id, { weight: num(ev.target.value) })} />
                    )}
                    <input type="number" inputMode="numeric" min="0" step="1" aria-label={`Set ${i + 1} reps`} value={s.reps ?? ''} onChange={(ev) => patchSet(e.id, s.id, { reps: num(ev.target.value) })} />
                    {ex.kind === 'weight' && <span className="rm-cell" aria-label={rm === null ? undefined : `Estimated 1RM ${fmtKg(rm)} kg`}>{rm === null ? '–' : fmtKg(rm)}</span>}
                    <button className="icon-x" aria-label={`Delete set ${i + 1}`} onClick={() => patchEntry(e.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}>
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                )
              })}
            </div>
            {ex.kind === 'weight' && e.sets.some((x) => setRM(x) !== null) && (
              <p className="rm-best">Best est. 1RM today: <b>{fmtKg(Math.max(...e.sets.map((x) => setRM(x) ?? 0)))} kg</b></p>
            )}
            <button className="btn secondary block" style={{ marginTop: 16 }} onClick={() => addSet(e)}>Add set</button>
          </section>
        )
      })}

      <button className="btn secondary block" onClick={() => setPicker({})}>Add exercise</button>

      <div className="field-group" style={{ marginTop: 16 }}>
        <label className="field" htmlFor="note">Notes (optional)</label>
        <textarea id="note" value={w.note} onChange={(e) => setW({ ...w, note: e.target.value })} />
      </div>

      {sharingConfigured && (
        <p className="sub">
          {canShare ? 'Saved workouts are shared with your friends automatically.' : 'Sign in on the Friends tab to share your workouts with friends. Past ones are sent once you sign in.'}
        </p>
      )}
      <p className="sub" style={{ margin: '12px 0 0' }} role="status" aria-live="polite">
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'All changes are saved on this device.' : status === 'error' ? 'Could not save on this device. Try again.' : 'Whatever you fill in is saved automatically.'}
      </p>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn grow" onClick={done} disabled={saving}>{saving ? 'Saving…' : 'Done'}</button>
        {savedOnce && <button className="btn danger" onClick={remove}>Delete</button>}
      </div>

      {picker && <Picker data={data} onPick={pickExercise} onClose={() => setPicker(null)} />}
    </>
  )
}

function Picker({ data, onPick, onClose }: { data: AppData; onPick: (e: Exercise) => void; onClose: () => void }) {
  // view: null = list of body parts, a part name = exercises in that part, 'create' = new custom exercise
  const [view, setView] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ExerciseKind>('weight')
  const [cPart, setCPart] = useState<string>('Chest')

  const inPart = (part: string) => data.allExercises.filter((e) => e.part === part)
  const searching = q.trim() !== ''
  const found = data.allExercises.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()))

  const startCreate = (part?: string) => {
    if (part) setCPart(part)
    setName(q.trim())
    setCreating(true)
  }
  const create = async () => {
    if (!name.trim()) return
    const ex = newCustomExercise(name, kind, cPart)
    await db.customExercises.put(ex)
    onPick(ex)
  }

  const row = (e: Exercise) => (
    <button key={e.id} className="list-btn" onClick={() => onPick(e)}>
      {e.name}
      <span className="sub">  {searching ? e.part : ''}{e.custom ? ' · custom' : ''}</span>
    </button>
  )

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Choose exercise" onClick={(e) => e.stopPropagation()}>
        <div className="row spread">
          <h2 style={{ margin: 0 }}>{creating ? 'New exercise' : view ?? 'Choose exercise'}</h2>
          <button className="btn secondary small" onClick={onClose}>Close</button>
        </div>

        {creating ? (
          <>
            <div className="field-group" style={{ marginTop: 8 }}>
              <label className="field" htmlFor="cn">Name</label>
              <input id="cn" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <fieldset className="choice">
              <legend className="field">Tracking type</legend>
              {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => (
                <label key={k} className="check">
                  <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                  {KIND_LABEL[k]}
                </label>
              ))}
            </fieldset>
            {(
              <div className="field-group">
                <div className="field" id="cp-label">Body part</div>
                <div className="chips" role="group" aria-labelledby="cp-label">
                  {PARTS.map((p) => (
                    <button key={p} className="chip" aria-pressed={cPart === p} onClick={() => setCPart(p)}>{p}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="row">
              <button className="btn grow" disabled={!name.trim()} onClick={create}>Create and add</button>
              <button className="btn secondary" onClick={() => setCreating(false)}>Back</button>
            </div>
          </>
        ) : view !== null && !searching ? (
          <>
            <button className="btn secondary small" style={{ margin: '8px 0' }} onClick={() => setView(null)}>‹ All body parts</button>
            <div>{inPart(view).map(row)}</div>
            <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => startCreate(view === 'Cardio' ? undefined : view)}>
              Create custom exercise
            </button>
          </>
        ) : (
          <>
            <div className="field-group" style={{ marginTop: 8 }}>
              <label className="field" htmlFor="q">Search</label>
              <input id="q" type="text" placeholder="e.g. squat" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {searching ? (
              <>
                <div>{found.map(row)}</div>
                {found.length === 0 && <p className="sub">Nothing found.</p>}
                <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => startCreate()}>Create “{q.trim()}” as custom exercise</button>
              </>
            ) : (
              <>
                <div className="parts" role="group" aria-label="Body parts">
                  {PARTS.map((p) => (
                    <button key={p} className="part-tile" onClick={() => setView(p)}>
                      <b>{p}</b>
                      <span className="sub">{inPart(p).length} exercises</span>
                    </button>
                  ))}
                </div>
                <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => startCreate()}>Create custom exercise</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
