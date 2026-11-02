import { useRef, useState } from 'react'
import type { AppData } from '../data'
import { db } from '../db'
import { buildBackup, buildCsv, download, importBackup } from '../exportData'
import { toDateStr } from '../calc'

export default function Settings({ data }: { data: AppData }) {
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = toDateStr(new Date())

  const onImport = async (f: File | undefined) => {
    if (!f) return
    try {
      const n = await importBackup(await f.text())
      setMsg({ type: 'ok', text: `Imported ${n} workouts.` })
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
    setMsg({ type: 'ok', text: 'All local data deleted.' })
  }

  return (
    <>
      {msg && <div role={msg.type === 'error' ? 'alert' : 'status'} className={`msg ${msg.type === 'ok' ? 'ok' : ''}`}>{msg.text}</div>}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Export</h2>
        <p className="sub">Your log lives in this browser. Save a backup now and then, especially before switching phones.</p>
        <div className="row">
          <button className="btn" onClick={async () => download(`gym-bro-${today}.json`, JSON.stringify(await buildBackup(), null, 2), 'application/json')}>
            Backup (JSON)
          </button>
          <button className="btn secondary" onClick={() => download(`gym-bro-${today}.csv`, buildCsv(data.workouts, data.custom), 'text/csv;charset=utf-8')}>
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
    </>
  )
}
