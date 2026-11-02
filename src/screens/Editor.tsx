import { useEffect, useRef, useState } from 'react'
import type { Auth, Route } from '../App'
import type { AppData } from '../data'
import { db, uid } from '../db'
import { detectPRs, isFilledSet, toDateStr } from '../calc'
import { PARTS, newCustomExercise } from '../exercises'
import { clearDraft, hasContent, loadDraft, saveDraft } from '../draft'
import { retargetEntry } from '../entryOps'
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
  const draftKey = id ?? 'new'
  const fresh = (): Workout => ({ id: uid(), date: date ?? toDateStr(new Date()), title: '', note: '', entries: [], createdAt: Date.now(), updatedAt: Date.now() })

  // Unsaved input is kept on this device; reopen the screen and it comes back.
  const [start] = useState(() => {
    const d = loadDraft(draftKey)
    if (d && (!existing || existing.updatedAt <= d.base)) return { w: d.w, restored: true }
    if (d) clearDraft(draftKey) // the workout changed since this draft was made
    return { w: existing ?? fresh(), restored: false }
  })
  const [w, setW] = useState<Workout>(start.w)
  const [restored, setRestored] = useState(start.restored)
  const [picker, setPicker] = useState<{ entryId?: string } | null>(null)
  const [error, setError] = useState('')

  const latest = useRef(w)
  latest.current = w
  const finished = useRef(false) // saved, deleted or discarded: stop keeping a draft
  const persist = (x: Workout) => {
    if (finished.current) return
    const changed = existing ? JSON.stringify(x) !== JSON.stringify(existing) : hasContent(x)
    if (changed) saveDraft(draftKey, x, existing?.updatedAt ?? 0)
    else clearDraft(draftKey)
  }
  useEffect(() => {
    const t = setTimeout(() => persist(w), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])
  useEffect(() => () => persist(latest.current), []) // eslint-disable-line react-hooks/exhaustive-deps

  const discardDraft = () => {
    finished.current = true
    clearDraft(draftKey)
    setW(existing ?? fresh())
    setRestored(false)
    setTimeout(() => { finished.current = false }, 0)
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

  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (saving) return
    setSaving(true)
    try { await doSave() } finally { setSaving(false) }
  }

  const doSave = async () => {
    setError('')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) return setError('Please enter a date.')
    if (w.entries.length === 0) return setError('Add at least one exercise.')

    // Empty sets are dropped; an exercise with no filled set is dropped too.
    const entries = w.entries.map((e) => ({ ...e, sets: e.sets.filter(isFilledSet) })).filter((e) => e.sets.length > 0)
    if (entries.length === 0) return setError('Enter at least one set (weight and reps).')

    // Every saved workout is shared with friends automatically (when signed in).
    const next: Workout = { ...w, entries, synced: false, updatedAt: Date.now() }
    if (canShare) {
      try {
        await pushWorkout(auth.session!.user.id, next, buildPayload(next, data.exercises, data.workouts))
        next.synced = true
        next.everShared = true
      } catch (e) {
        await db.workouts.put(next)
        finished.current = true
        clearDraft(draftKey)
        setW(next)
        return setError(`Saved on this device, but sharing failed (it will retry later): ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
    await db.workouts.put(next)
    finished.current = true
    clearDraft(draftKey)
    showToast(next.synced ? 'Saved and shared with friends' : 'Saved on this device')
    go({ name: 'home' })
  }

  const remove = async () => {
    if (!confirm('Delete this workout? Friends will no longer see it either. This cannot be undone.')) return
    // The shared copy must be removed first so it never stays visible by mistake.
    if (sharingConfigured && (w.everShared || auth.session)) {
      try {
        if (!auth.session) throw new Error('Sign in (Friends tab) to delete a workout that was shared.')
        await removeShared(w.id)
      } catch (e) {
        return setError(`Could not remove the shared copy: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
    await db.workouts.delete(w.id)
    finished.current = true
    clearDraft(draftKey)
    showToast('Workout deleted')
    go({ name: 'home' })
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{existing ? 'Edit workout' : 'Log a workout'}</h2>
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
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn grow" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        {existing && <button className="btn danger" onClick={remove}>Delete</button>}
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
