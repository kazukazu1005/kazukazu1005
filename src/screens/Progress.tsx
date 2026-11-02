import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AppData } from '../data'
import type { Exercise, Workout } from '../types'
import { PARTS } from '../exercises'
import { statsFor, type ExerciseStat } from '../calc'

interface Metric { key: string; label: string; unit: string; get: (s: ExerciseStat) => number | null }
interface Point { date: string; v: number }

const METRICS: Record<string, Metric[]> = {
  weight: [
    { key: '1rm', label: 'Est. 1RM', unit: 'kg', get: (s) => s.best1RM },
    { key: 'max', label: 'Max weight', unit: 'kg', get: (s) => s.maxWeight },
    { key: 'vol', label: 'Volume', unit: 'kg', get: (s) => s.volume },
  ],
  bodyweight: [
    { key: 'reps', label: 'Max reps', unit: 'reps', get: (s) => s.maxReps },
    { key: 'vol', label: 'Total reps', unit: 'reps', get: (s) => s.totalReps },
  ],
}

const fmt = (n: number) => String(Math.round(n * 10) / 10)
const longDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// chart geometry
const H = 220
const TOP = 28
const BOTTOM = 36
const PADX = 28
const STEP = 64 // minimum horizontal distance between recorded days; more points than fit -> scroll
const AXIS_W = 44

/**
 * Line chart with every recorded day labeled underneath.
 * Tap (or focus + Enter) a point to read its value. When the points do not fit, the plot scrolls
 * sideways while the value axis stays put. Mount it with a key so selection and scroll reset.
 */
function Chart({ points, metric }: { points: Point[]; metric: Metric }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewW, setViewW] = useState(280)
  const [sel, setSel] = useState(points.length - 1)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewW(el.clientWidth)
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = points.length
  const innerW = Math.max(viewW, PADX * 2 + (n - 1) * STEP)

  // show the newest records first
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [n, innerW])

  const vs = points.map((p) => p.v)
  let lo = Math.min(...vs)
  let hi = Math.max(...vs)
  const pad = (hi - lo) * 0.2 || Math.max(1, hi * 0.1)
  lo = Math.max(0, lo - pad)
  hi = hi + pad
  const plotH = H - TOP - BOTTOM
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH
  const x = (i: number) => (n === 1 ? innerW / 2 : PADX + (i * (innerW - PADX * 2)) / (n - 1))
  const ticks = [hi, (hi + lo) / 2, lo]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ')
  const cur = points[Math.min(sel, n - 1)]

  return (
    <div>
      <div className="readout" aria-live="polite">
        <span className="sub">{longDate(cur.date)}</span>
        <b>{fmt(cur.v)} <span className="unit">{metric.unit}</span></b>
      </div>
      <div className="chart-wrap">
        <svg className="chart-axis" width={AXIS_W} height={H} aria-hidden="true">
          {ticks.map((t, i) => (
            <text key={i} x={AXIS_W - 6} y={y(t) + 4} textAnchor="end" className="chart-text">{fmt(t)}</text>
          ))}
        </svg>
        <div className="chart-scroll" ref={scrollRef} tabIndex={0} role="group" aria-label={`${metric.label} chart. Scroll sideways to see earlier days.`}>
          <svg width={innerW} height={H} role="img" aria-label={`${metric.label} over ${n} recorded ${n === 1 ? 'day' : 'days'}`}>
            {ticks.map((t, i) => (
              <line key={i} x1={0} x2={innerW} y1={y(t)} y2={y(t)} className="chart-grid" />
            ))}
            {n > 1 && <path d={path} className="chart-line" />}
            {points.map((p, i) => {
              const on = i === sel
              return (
                <g
                  key={p.date}
                  className="chart-pt"
                  role="button"
                  tabIndex={0}
                  aria-label={`${longDate(p.date)}: ${fmt(p.v)} ${metric.unit}`}
                  aria-pressed={on}
                  onClick={() => setSel(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(i) } }}
                >
                  <circle cx={x(i)} cy={y(p.v)} r={22} className="chart-hit" />
                  <circle cx={x(i)} cy={y(p.v)} r={on ? 7 : 4.5} className={on ? 'chart-dot on' : 'chart-dot'} />
                  {on && <text x={x(i)} y={y(p.v) - 14} textAnchor="middle" className="chart-val">{fmt(p.v)}</text>}
                  <text x={x(i)} y={H - 12} textAnchor="middle" className={on ? 'chart-text chart-date on' : 'chart-text chart-date'}>{p.date.slice(5).replace('-', '/')}</text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
      {n > 1 && innerW > viewW && <p className="sub" style={{ margin: '4px 0 0' }}>Swipe sideways to see earlier days.</p>}
    </div>
  )
}

/** Own progress. */
export default function Progress({ data }: { data: AppData }) {
  return <ProgressView exercises={data.allExercises} workouts={data.workouts} />
}

/** Progress charts for any set of exercises and workouts (yours, or a friend's shared ones). */
export function ProgressView({ exercises, workouts }: { exercises: Exercise[]; workouts: Workout[] }) {
  const used = new Set(workouts.flatMap((w) => w.entries.map((e) => e.exerciseId)))
  const list = exercises.filter((e) => used.has(e.id))
  const [exId, setExId] = useState<string>('')
  const [mKey, setMKey] = useState<string>('')

  if (list.length === 0) return <p className="sub">Charts for each exercise will appear here once there are some records.</p>

  const ex = list.find((e) => e.id === exId) ?? list[0]
  const metrics = METRICS[ex.kind]
  const metric = metrics.find((m) => m.key === mKey) ?? metrics[0]
  const stats = statsFor(ex.id, workouts)
  const points: Point[] = stats.flatMap((s) => {
    const v = metric.get(s)
    return v && v > 0 ? [{ date: s.date, v }] : []
  })
  const best = points.length ? Math.max(...points.map((p) => p.v)) : null

  return (
    <>
      <div className="chips" role="group" aria-label="Body part">
        {PARTS.filter((p) => list.some((e) => e.part === p)).map((p) => (
          <button key={p} className="chip" aria-pressed={p === ex.part} onClick={() => { setExId(list.find((e) => e.part === p)!.id); setMKey('') }}>{p}</button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Exercise">
        {list.filter((e) => e.part === ex.part).map((e) => (
          <button key={e.id} className="chip" aria-pressed={e.id === ex.id} onClick={() => { setExId(e.id); setMKey('') }}>{e.name}</button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Metric">
        {metrics.map((m) => (
          <button key={m.key} className="chip" aria-pressed={m.key === metric.key} onClick={() => setMKey(m.key)}>{m.label}</button>
        ))}
      </div>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{ex.name}: {metric.label}</h2>
        {best !== null && <p style={{ margin: '0 0 8px' }}>Personal best: <b>{fmt(best)} {metric.unit}</b></p>}
        {points.length === 0 ? <p className="sub">No data to show.</p> : <Chart key={`${ex.id}-${metric.key}`} points={points} metric={metric} />}
      </section>
    </>
  )
}
