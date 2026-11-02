import { useState } from 'react'
import type { AppData } from '../data'
import { formatPace, statsFor, type ExerciseStat } from '../calc'

interface Metric { key: string; label: string; unit: string; get: (s: ExerciseStat) => number | null; fmt?: (n: number) => string }

const METRICS: Record<string, Metric[]> = {
  weight: [
    { key: '1rm', label: '推定1RM', unit: 'kg', get: (s) => s.best1RM },
    { key: 'max', label: '最大重量', unit: 'kg', get: (s) => s.maxWeight },
    { key: 'vol', label: 'ボリューム', unit: 'kg', get: (s) => s.volume },
  ],
  bodyweight: [
    { key: 'reps', label: '最大回数', unit: '回', get: (s) => s.maxReps },
    { key: 'vol', label: '総回数', unit: '回', get: (s) => s.volume || null },
  ],
  cardio: [
    { key: 'dist', label: '距離', unit: 'km', get: (s) => s.distance },
    { key: 'time', label: '時間', unit: '分', get: (s) => s.duration },
    { key: 'pace', label: 'ペース', unit: '分/km', get: (s) => s.bestPace, fmt: formatPace },
  ],
}

function Chart({ points, metric }: { points: { date: string; v: number }[]; metric: Metric }) {
  const W = 320, H = 180, P = { l: 40, r: 12, t: 12, b: 28 }
  const fmt = metric.fmt ?? ((n: number) => String(Math.round(n * 10) / 10))
  if (points.length === 0) return <p className="sub">表示できるデータがありません。</p>
  const vs = points.map((p) => p.v)
  let lo = Math.min(...vs), hi = Math.max(...vs)
  if (lo === hi) { lo -= 1; hi += 1 }
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1))
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ')
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric.label}の推移。最新は${fmt(points[points.length - 1].v)}${metric.unit}`}>
      <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} stroke="#7a7a7a" />
      <line x1={P.l} y1={P.t} x2={P.l} y2={H - P.b} stroke="#7a7a7a" />
      <text x={P.l - 4} y={P.t + 8} textAnchor="end" fontSize="10" fill="#4d4d4d">{fmt(hi)}</text>
      <text x={P.l - 4} y={H - P.b} textAnchor="end" fontSize="10" fill="#4d4d4d">{fmt(lo)}</text>
      <text x={P.l} y={H - 8} fontSize="10" fill="#4d4d4d">{points[0].date.slice(5)}</text>
      <text x={W - P.r} y={H - 8} textAnchor="end" fontSize="10" fill="#4d4d4d">{points[points.length - 1].date.slice(5)}</text>
      <path d={d} fill="none" stroke="#0017c1" strokeWidth="2" />
      {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.v)} r="4" fill="#0017c1" />)}
    </svg>
  )
}

export default function Progress({ data }: { data: AppData }) {
  const used = new Set(data.workouts.flatMap((w) => w.entries.map((e) => e.exerciseId)))
  const list = data.allExercises.filter((e) => used.has(e.id))
  const [exId, setExId] = useState<string>('')
  const [mKey, setMKey] = useState<string>('')

  if (list.length === 0) return <p className="sub">記録がたまると、ここに種目ごとの成長グラフが表示されます。</p>

  const ex = data.exercises.get(exId) ?? list[0]
  const metrics = METRICS[ex.kind]
  const metric = metrics.find((m) => m.key === mKey) ?? metrics[0]
  const stats = statsFor(ex.id, data.workouts)
  const points = stats.flatMap((s) => {
    const v = metric.get(s)
    return v && v > 0 ? [{ date: s.date, v }] : []
  })
  const fmt = metric.fmt ?? ((n: number) => String(Math.round(n * 10) / 10))
  const best = points.length ? (metric.key === 'pace' ? Math.min(...points.map((p) => p.v)) : Math.max(...points.map((p) => p.v))) : null

  return (
    <>
      <div className="field-group">
        <label className="field" htmlFor="ex">種目</label>
        <select id="ex" value={ex.id} onChange={(e) => { setExId(e.target.value); setMKey('') }}>
          {list.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="chips" role="group" aria-label="指標">
        {metrics.map((m) => (
          <button key={m.key} className="chip" aria-pressed={m.key === metric.key} onClick={() => setMKey(m.key)}>{m.label}</button>
        ))}
      </div>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{ex.name}の{metric.label}</h2>
        {best !== null && <p>自己ベスト: <b>{fmt(best)}{metric.unit}</b></p>}
        <Chart points={points} metric={metric} />
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>記録（新しい順）</h2>
        {points.slice().reverse().slice(0, 10).map((p) => (
          <div key={p.date} className="row spread"><span>{p.date}</span><b>{fmt(p.v)}{metric.unit}</b></div>
        ))}
      </section>
    </>
  )
}
