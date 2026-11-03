import { useRef, useState } from 'react'
import type { AppData } from '../data'
import { db } from '../db'
import { buildBackup, buildCsv, download, importBackup } from '../exportData'
import { toDateStr } from '../calc'
import { showToast } from '../toast'
import { BUILD_TIME } from '../supabase'
import { deleteCustomExercise, MAX_EXERCISE_NAME, renameCustomExercise, usageCount } from '../exerciseOps'
import type { Exercise } from '../types'

export default function Settings({ data }: { data: AppData }) {
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = toDateStr(new Date())
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)

  const run = async (f: () => Promise<unknown>, ok: string) => {
    try { await f(); (setMsg(null), showToast(ok)) } catch (e) { setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' }) }
  }

  const onImport = async (f: File | undefined) => {
    if (!f) return
    try {
      const n = await importBackup(await f.text())
      setMsg(null)
      showToast(`Imported ${n} ${n === 1 ? 'workout' : 'workouts'}`)
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Import failed.' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const onDeleteAll = async () => {
    if (!confirm('Delete all local records? This cannot be undone. Export a backup first. (Workouts already shared with friends stay on the server until you unshare or delete them one by one.)')) return
    await db.transaction('rw', db.workouts, db.customExercises, async () => {
      await db.workouts.clear()
      await db.customExercises.clear()
    })
    setMsg(null)
    showToast('All local data deleted.')
  }

  return (
    <>
      {msg && <div role={msg.type === 'error' ? 'alert' : 'status'} className={`msg ${msg.type === 'ok' ? 'ok' : ''}`}>{msg.text}</div>}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>My exercises</h2>
        {data.custom.length === 0 && <p className="sub">Exercises you create while logging show up here, where you can rename or delete them.</p>}
        {data.custom.map((ex: Exercise) => {
          const used = usageCount(data.workouts, ex.id)
          const isEditing = editing?.id === ex.id
          return (
            <div key={ex.id} className="comment">
              {isEditing ? (
                <form
                  className="row"
                  onSubmit={(e) => { e.preventDefault(); void run(async () => { await renameCustomExercise(ex.id, editing.name); setEditing(null) }, 'Renamed.') }}
                >
                  <input type="text" className="grow" aria-label={`New name for ${ex.name}`} maxLength={MAX_EXERCISE_NAME} autoFocus value={editing.name} onChange={(e) => setEditing({ id: ex.id, name: e.target.value })} style={{ width: 'auto' }} />
                  <button className="btn small" disabled={!editing.name.trim()}>Save</button>
                  <button type="button" className="btn secondary small" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <div className="row spread">
                  <span>
                    {ex.name} <span className="sub">{ex.part} · {used === 0 ? 'unused' : `${used} ${used === 1 ? 'workout' : 'workouts'}`}</span>
                  </span>
                  <span className="row">
                    <button className="btn secondary small" onClick={() => setEditing({ id: ex.id, name: ex.name })}>Rename</button>
                    <button
                      className="btn danger small"
                      disabled={used > 0}
                      title={used > 0 ? 'Used in saved workouts. Change those first.' : undefined}
                      onClick={() => confirm(`Delete “${ex.name}”?`) && run(() => deleteCustomExercise(ex.id), 'Deleted.')}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              )}
            </div>
          )
        })}
        {data.custom.some((ex) => usageCount(data.workouts, ex.id) > 0) && (
          <p className="sub" style={{ marginBottom: 0 }}>An exercise used in saved workouts can be renamed but not deleted. Use “Change” on the exercise inside a workout to move its sets to another exercise first.</p>
        )}
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Export</h2>
        <p className="sub">Your log lives in this browser. Save a backup now and then, especially before switching phones.</p>
        <div className="row">
          <button className="btn" onClick={async () => { download(`gym-bro-${today}.json`, JSON.stringify(await buildBackup(), null, 2), 'application/json'); showToast('Backup downloaded') }}>
            Backup (JSON)
          </button>
          <button className="btn secondary" onClick={() => { download(`gym-bro-${today}.csv`, buildCsv(data.workouts, data.custom), 'text/csv;charset=utf-8'); showToast('CSV downloaded') }}>
            Spreadsheet (CSV)
          </button>
        </div>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Import</h2>
        <p className="sub">Choose a backup (JSON). Records are added or overwritten by ID.</p>
        <label className="field" htmlFor="import">Backup file</label>
        <input id="import" ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onImport(e.target.files?.[0])} />
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Delete everything</h2>
        <button className="btn danger" onClick={onDeleteAll}>Delete all local data</button>
      </section>
      <p className="sub" style={{ textAlign: 'center' }}>Gym Bro · built {new Date(BUILD_TIME).toLocaleString()}</p>
    </>
  )
}
