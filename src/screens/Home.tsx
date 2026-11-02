import type { Route } from '../App'
import type { AppData } from '../data'
import { toDateStr, weekStart, weekStreak, workoutVolume } from '../calc'

export default function Home({ data, go }: { data: AppData; go: (r: Route) => void }) {
  const ws = toDateStr(weekStart(new Date()))
  const thisWeek = data.workouts.filter((w) => w.date >= ws)
  const volume = thisWeek.reduce((a, w) => a + workoutVolume(w, data.exercises), 0)
  let km = 0
  let min = 0
  for (const w of thisWeek)
    for (const e of w.entries)
      if (data.exercises.get(e.exerciseId)?.kind === 'cardio')
        for (const s of e.sets) {
          km += s.distanceKm ?? 0
          min += s.durationMin ?? 0
        }

  return (
    <>
      <section className="card" aria-labelledby="week">
        <h2 id="week" style={{ marginTop: 0 }}>今週のまとめ</h2>
        <div className="stats">
          <div className="stat"><span className="sub">トレーニング</span><b>{thisWeek.length}回</b></div>
          <div className="stat"><span className="sub">連続週数</span><b>{weekStreak(data.workouts)}週</b></div>
          <div className="stat"><span className="sub">総ボリューム</span><b>{Math.round(volume).toLocaleString()}kg</b></div>
          <div className="stat"><span className="sub">有酸素</span><b>{km.toFixed(1)}km / {Math.round(min)}分</b></div>
        </div>
      </section>

      <button className="btn block" onClick={() => go({ name: 'edit' })}>ワークアウトを記録する</button>

      <h2>履歴</h2>
      {data.workouts.length === 0 && <p className="sub">まだ記録がありません。「ワークアウトを記録する」から始めましょう。</p>}
      {data.workouts.map((w) => (
        <button key={w.id} className="card list-btn" style={{ borderRadius: 8 }} onClick={() => go({ name: 'edit', id: w.id })}>
          <div className="row spread">
            <h3>{w.date}{w.title ? `　${w.title}` : ''}</h3>
            <span className="sub">{w.entries.length}種目</span>
          </div>
          <div className="sub">
            {w.entries.map((e) => data.exercises.get(e.exerciseId)?.name ?? '（削除された種目）').join('、') || '種目なし'}
          </div>
        </button>
      ))}
    </>
  )
}
