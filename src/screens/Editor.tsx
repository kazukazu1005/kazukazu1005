import { useState } from 'react'
import type { Route } from '../App'
import type { AppData } from '../data'
import { db, uid } from '../db'
import { detectPRs, formatPace, pace, toDateStr } from '../calc'
import { PARTS, newCustomExercise } from '../exercises'
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
  if (kind === 'bodyweight') return `${s.reps ?? 0}回`
  return `${s.distanceKm ?? 0}km/${s.durationMin ?? 0}分`
}

export default function Editor({ data, id, go }: { data: AppData; id?: string; go: (r: Route) => void }) {
  const existing = id ? data.workouts.find((w) => w.id === id) : undefined
  const [w, setW] = useState<Workout>(
    () =>
      existing ?? { id: uid(), date: toDateStr(new Date()), title: '', note: '', entries: [], createdAt: Date.now(), updatedAt: Date.now() },
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

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) return setError('日付を入力してください。')
    if (w.entries.length === 0) return setError('種目を1つ以上追加してください。')
    await db.workouts.put({ ...w, updatedAt: Date.now() })
    go({ name: 'home' })
  }

  const remove = async () => {
    if (!confirm('このワークアウトを削除します。元に戻せません。よろしいですか？')) return
    await db.workouts.delete(w.id)
    go({ name: 'home' })
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{existing ? 'ワークアウトを編集' : 'ワークアウトを記録'}</h2>
      {error && <div role="alert" className="msg error">{error}</div>}

      <div className="row">
        <div className="field-group grow">
          <label className="field" htmlFor="date">日付</label>
          <input id="date" type="date" value={w.date} onChange={(e) => setW({ ...w, date: e.target.value })} />
        </div>
        <div className="field-group grow">
          <label className="field" htmlFor="title">タイトル（任意）</label>
          <input id="title" type="text" value={w.title} placeholder="例: 胸の日" onChange={(e) => setW({ ...w, title: e.target.value })} />
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
              <button className="btn danger small" onClick={() => setW({ ...w, entries: w.entries.filter((x) => x.id !== e.id) })} aria-label={`${ex.name}を削除`}>種目を削除</button>
            </div>
            {prs.length > 0 && <p style={{ margin: '4px 0' }}>{prs.map((p) => <span key={p} className="badge" style={{ marginRight: 4 }}>自己ベスト更新: {p}</span>)}</p>}
            {prev && <p className="sub">前回（{prev.date}）: {prev.sets.map((s) => describeSet(s, ex.kind)).join('、')}</p>}

            {e.sets.map((s, i) => (
              <div key={s.id}>
                <div className={`set-row${s.warmup ? ' warm' : ''}`}>
                  <span className="num">{i + 1}</span>
                  {ex.kind === 'weight' && (
                    <>
                      <div><label className="sub" htmlFor={`w${s.id}`}>重量(kg)</label><input id={`w${s.id}`} type="number" inputMode="decimal" min="0" step="0.5" value={s.weight ?? ''} onChange={(ev) => patchSet(e.id, s.id, { weight: num(ev.target.value) })} /></div>
                      <div><label className="sub" htmlFor={`r${s.id}`}>回数</label><input id={`r${s.id}`} type="number" inputMode="numeric" min="0" step="1" value={s.reps ?? ''} onChange={(ev) => patchSet(e.id, s.id, { reps: num(ev.target.value) })} /></div>
                    </>
                  )}
                  {ex.kind === 'bodyweight' && (
                    <>
                      <div><label className="sub" htmlFor={`r${s.id}`}>回数</label><input id={`r${s.id}`} type="number" inputMode="numeric" min="0" step="1" value={s.reps ?? ''} onChange={(ev) => patchSet(e.id, s.id, { reps: num(ev.target.value) })} /></div>
                      <div />
                    </>
                  )}
                  {ex.kind === 'cardio' && (
                    <>
                      <div><label className="sub" htmlFor={`t${s.id}`}>時間(分)</label><input id={`t${s.id}`} type="number" inputMode="decimal" min="0" step="0.5" value={s.durationMin ?? ''} onChange={(ev) => patchSet(e.id, s.id, { durationMin: num(ev.target.value) })} /></div>
                      <div><label className="sub" htmlFor={`d${s.id}`}>距離(km)</label><input id={`d${s.id}`} type="number" inputMode="decimal" min="0" step="0.1" value={s.distanceKm ?? ''} onChange={(ev) => patchSet(e.id, s.id, { distanceKm: num(ev.target.value) })} /></div>
                    </>
                  )}
                  <button className="btn danger small" aria-label={`${i + 1}セット目を削除`} onClick={() => patchEntry(e.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}>削除</button>
                </div>
                <div className="row" style={{ marginBottom: 8 }}>
                  {ex.kind !== 'cardio' && (
                    <label className="check"><input type="checkbox" checked={!!s.warmup} onChange={(ev) => patchSet(e.id, s.id, { warmup: ev.target.checked })} />ウォームアップ（集計に含めない）</label>
                  )}
                  {ex.kind === 'cardio' && <span className="sub">ペース: {formatPace(pace(s.durationMin, s.distanceKm))} 分/km</span>}
                </div>
              </div>
            ))}
            <button className="btn secondary block" onClick={() => addSet(e)}>セットを追加（前の内容をコピー）</button>
          </section>
        )
      })}

      <button className="btn secondary block" onClick={() => setPicker(true)}>種目を追加</button>

      <div className="field-group" style={{ marginTop: 16 }}>
        <label className="field" htmlFor="note">メモ（任意）</label>
        <textarea id="note" value={w.note} onChange={(e) => setW({ ...w, note: e.target.value })} />
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn grow" onClick={save}>保存する</button>
        {existing && <button className="btn danger" onClick={remove}>削除</button>}
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
  const [cPart, setCPart] = useState<string>('胸')

  const list = data.allExercises.filter((e) => (!part || e.part === part) && e.name.includes(q.trim()))

  const create = async () => {
    if (!name.trim()) return
    const ex = newCustomExercise(name, kind, kind === 'cardio' ? '有酸素' : cPart)
    await db.customExercises.put(ex)
    onPick(ex)
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="種目を選ぶ" onClick={(e) => e.stopPropagation()}>
        <div className="row spread">
          <h2 style={{ margin: 0 }}>種目を選ぶ</h2>
          <button className="btn secondary small" onClick={onClose}>閉じる</button>
        </div>
        {!creating ? (
          <>
            <div className="field-group" style={{ marginTop: 8 }}>
              <label className="field" htmlFor="q">種目名で検索</label>
              <input id="q" type="text" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="chips" role="group" aria-label="部位">
              <button className="chip" aria-pressed={part === ''} onClick={() => setPart('')}>すべて</button>
              {PARTS.map((p) => <button key={p} className="chip" aria-pressed={part === p} onClick={() => setPart(p)}>{p}</button>)}
            </div>
            <div>
              {list.map((e) => <button key={e.id} className="list-btn" onClick={() => onPick(e)}>{e.name}<span className="sub">　{e.part}{e.custom ? '・自作' : ''}</span></button>)}
              {list.length === 0 && <p className="sub">見つかりません。下のボタンから作成できます。</p>}
            </div>
            <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => { setName(q); setCreating(true) }}>オリジナル種目を作る</button>
          </>
        ) : (
          <>
            <div className="field-group" style={{ marginTop: 8 }}>
              <label className="field" htmlFor="cn">種目名</label>
              <input id="cn" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field" htmlFor="ck">記録のしかた</label>
              <select id="ck" value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
                {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            {kind !== 'cardio' && (
              <div className="field-group">
                <label className="field" htmlFor="cp">部位</label>
                <select id="cp" value={cPart} onChange={(e) => setCPart(e.target.value)}>
                  {PARTS.filter((p) => p !== '有酸素').map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div className="row">
              <button className="btn grow" disabled={!name.trim()} onClick={create}>作成して追加</button>
              <button className="btn secondary" onClick={() => setCreating(false)}>戻る</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
