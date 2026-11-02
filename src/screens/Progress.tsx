import { useState } from 'react'
import type { AppData } from '../data'
import { formatPace, statsFor, type ExerciseStat } from '../calc'

interface Metric { key: string; label: string; unit: string; get: (s: ExerciseStat) => number | null; fmt?: (n: number) => string }

const METRICS: Record<string, Metric[]> = {
  weight: [
    { key: '1rm', label: 'Est. 1RM', unit: 'kg', get: (s) => s.best1RM },
    { key: 'max', label: 'Max weight', unit: 'kg', get: (s) => s.maxWeight },
    { key: 'vol', label: 'Volume', unit: 'kg', get: (s) => s.volume },
  ],
  bodyweight: [
    { key: 'reps', label: 'Max reps', unit: 'reps', get: (s) => s.maxReps },
    { key: 'vol', label: 'Total reps', unit: 'reps', get: (s) => s.volume || null },
  ],
  cardio: [
    { key: 'dist', label: 'Distance', unit: 'km', get: (s) => s.distance },
    { key: 'time', label: 'Time', unit: 'min', get: (s) => s.duration },
    { key: 'pace', label: 'Pace', unit: 'min/km', get: (s) => s.bestPace, fmt: formatPace },
  ],
}

function Chart({ points, metric }: { points: { date: string; v: number }[]; metric: Metric }) {
  const W = 320, H = 180, P = { l: 40, r: 12, t: 12, b: 28 }
  const fmt = metric.fmt ?? ((n: number) => String(Math.round(n * 10) / 10))
  if (points.length === 0) return <p className="sub">No data to show.</p>
  const vs = points.map((p) => p.v)
  let lo = Math.min(...vs), hi = Math.max(...vs)
  if (lo === hi) { lo -= 1; hi += 1 }
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1))
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ')
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric.label} trend. Latest: ${fmt(points[points.length - 1].v)}${metric.unit}`}>
      <line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} stroke="#a5a29b" />
      <line x1={P.l} y1={P.t} x2={P.l} y2={H - P.b} stroke="#a5a29b" />
      <text x={P.l - 4} y={P.t + 8} textAnchor="end" fontSize="10" fill="#787774">{fmt(hi)}</text>
      <text x={P.l - 4} y={H - P.b} textAnchor="end" fontSize="10" fill="#787774">{fmt(lo)}</text>
      <text x={P.l} y={H - 8} fontSize="10" fill="#787774">{points[0].date.slice(5)}</text>
      <text x={W - P.r} y={H - 8} textAnchor="end" fontSize="10" fill="#787774">{points[points.length - 1].date.slice(5)}</text>
      <path d={d} fill="none" stroke="#2383e2" strokeWidth="2" />
      {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.v)} r="4" fill="#2383e2" />)}
    </svg>
  )
}

export default function Progress({ data }: { data: AppData }) {
  const used = new Set(data.workouts.flatMap((w) => w.entries.map((e) => e.exerciseId)))
  const list = data.allExercises.filter((e) => used.has(e.id))
  const [exId, setExId] = useState<string>('')
  const [mKey, setMKey] = useState<string>('')

  if (list.length === 0) return <p className="sub">Charts for each exercise will appear here once you have some records.</p>

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
        <label className="field" htmlFor="ex">Exercise</label>
        <select id="ex" value={ex.id} onChange={(e) => { setExId(e.target.value); setMKey('') }}>
          {list.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="chips" role="group" aria-label="Metric">
        {metrics.map((m) => (
          <button key={m.key} className="chip" aria-pressed={m.key === metric.key} onClick={() => setMKey(m.key)}>{m.label}</button>
        ))}
      </div>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{ex.name}: {metric.label}</h2>
        {best !== null && <p>Personal best: <b>{fmt(best)}{metric.unit}</b></p>}
        <Chart points={points} metric={metric} />
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Recent records</h2>
        {points.slice().reverse().slice(0, 10).map((p) => (
          <div key={p.date} className="row spread"><span>{p.date}</span><b>{fmt(p.v)}{metric.unit}</b></div>
        ))}
      </section>
    </>
  )
}
