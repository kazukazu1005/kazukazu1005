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
      setMsg({ type: 'ok', text: `${n}件のワークアウトを読み込みました。` })
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : '読み込みに失敗しました。' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const onDeleteAll = async () => {
    if (!confirm('すべての記録を削除します。この操作は元に戻せません。先にバックアップを保存することをおすすめします。続けますか？')) return
    await db.transaction('rw', db.workouts, db.customExercises, async () => {
      await db.workouts.clear()
      await db.customExercises.clear()
    })
    setMsg({ type: 'ok', text: 'すべてのデータを削除しました。' })
  }

  return (
    <>
      {msg && <div role={msg.type === 'error' ? 'alert' : 'status'} className={`msg ${msg.type}`}>{msg.text}</div>}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>データの書き出し</h2>
        <p className="sub">記録はこの端末のブラウザ内に保存されています。機種変更や万一に備えて、定期的に保存してください。</p>
        <div className="row">
          <button className="btn" onClick={async () => download(`kintore-memo-${today}.json`, JSON.stringify(await buildBackup(), null, 2), 'application/json')}>
            バックアップ（JSON）
          </button>
          <button className="btn secondary" onClick={() => download(`kintore-memo-${today}.csv`, buildCsv(data.workouts, data.custom), 'text/csv;charset=utf-8')}>
            表計算用（CSV）
          </button>
        </div>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>データの読み込み</h2>
        <p className="sub">バックアップ（JSON）を選ぶと、記録を追加・上書きします。</p>
        <label className="field" htmlFor="import">バックアップファイル</label>
        <input id="import" ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onImport(e.target.files?.[0])} />
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>すべてのデータを削除</h2>
        <button className="btn danger" onClick={onDeleteAll}>すべて削除する</button>
      </section>
    </>
  )
}
