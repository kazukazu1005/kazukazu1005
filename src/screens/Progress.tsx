import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AppData } from '../data'
import type { Exercise, Workout } from '../types'
import { PARTS } from '../exercises'
import { statsFor } from '../calc'
import { buildSeries, domain, METRICS, splitAxes, type MetricDef, type Series } from '../chartData'

const fmt = (n: number) => String(Math.round(n * 10) / 10)
const longDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// chart geometry
const H = 220
const TOP = 28
const BOTTOM = 36
const PADX = 28
const STEP = 64 // minimum horizontal distance between recorded days; more days than fit -> scroll
const AXIS_W = 44

/** Marker shape per line style, so lines can be told apart without relying on colour. */
function Marker({ style, cx, cy, on }: { style: 1 | 2 | 3; cx: number; cy: number; on: boolean }) {
  const cls = `mk mk${style}${on ? ' on' : ''}`
  if (style === 1) return <circle cx={cx} cy={cy} r={on ? 7 : 4.5} className={cls} />
  const s = on ? 6.5 : 4.5
  if (style === 2) return <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} rx={1.5} className={cls} />
  return <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} className={cls} transform={`rotate(45 ${cx} ${cy})`} />
}

/** Small sample of a line style (used in the metric buttons and the readout). */
function Swatch({ style }: { style: 1 | 2 | 3 }) {
  return (
    <svg className="swatch" width="34" height="14" viewBox="0 0 34 14" aria-hidden="true">
      <line x1="2" x2="32" y1="7" y2="7" className={`ln ln${style}`} />
      <Marker style={style} cx={17} cy={7} on={false} />
    </svg>
  )
}

/**
 * Line chart with every recorded day labeled underneath. Several metrics can be drawn at once, each
 * with its own line style. Tap a day (or focus it and press Enter) to read the values. When the days
 * do not fit, the plot scrolls sideways while the value axes stay put.
 * Mount it with a key so the selection and scroll position reset.
 */
function Chart({ dates, series }: { dates: string[]; series: Series[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewW, setViewW] = useState(280)
  const [sel, setSel] = useState(dates.length - 1)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewW(el.clientWidth)
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = dates.length
  const innerW = Math.max(viewW, PADX * 2 + (n - 1) * STEP)

  // show the newest records first
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [n, innerW])

  const { left, right, dual } = splitAxes(series)
  const nums = (g: Series[]) => g.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const [loA, hiA] = domain(nums(left))
  const [loB, hiB] = dual ? domain(nums(right)) : [0, 1]
  const plotH = H - TOP - BOTTOM
  const scale = (lo: number, hi: number) => (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH
  const yA = scale(loA, hiA)
  const yB = scale(loB, hiB)
  const yOf = (s: Series) => (dual && s.def.axis === 'b' ? yB : yA)
  const x = (i: number) => (n === 1 ? innerW / 2 : PADX + (i * (innerW - PADX * 2)) / (n - 1))
  const ticksA = [hiA, (hiA + loA) / 2, loA]
  const ticksB = [hiB, (hiB + loB) / 2, loB]
  const cur = Math.min(sel, n - 1)

  const colW = n === 1 ? Math.min(innerW, STEP * 2) : (innerW - PADX * 2) / (n - 1)
  const summary = (i: number) => series.map((s) => `${s.def.label} ${s.values[i] === null ? 'none' : fmt(s.values[i]!) + ' ' + s.def.unit}`).join(', ')

  return (
    <div>
      <div className="readout" aria-live="polite">
        <div className="sub">{longDate(dates[cur])}</div>
        {series.map((s) => (
          <div key={s.def.key} className="readout-row">
            <span className="readout-label"><Swatch style={s.def.style} />{s.def.label}</span>
            <b>{s.values[cur] === null ? '–' : fmt(s.values[cur]!)} <span className="unit">{s.def.unit}</span></b>
          </div>
        ))}
      </div>
      <div className="chart-wrap">
        <svg className="chart-axis" width={AXIS_W} height={H} aria-hidden="true">
          {ticksA.map((t, i) => (
            <text key={i} x={AXIS_W - 6} y={yA(t) + 4} textAnchor="end" className="chart-text">{fmt(t)}</text>
          ))}
        </svg>
        <div className="chart-scroll" ref={scrollRef} tabIndex={0} role="group" aria-label="Chart. Scroll sideways to see earlier days.">
          <svg width={innerW} height={H} role="group" aria-label={`${series.map((s) => s.def.label).join(', ')} over ${n} recorded ${n === 1 ? 'day' : 'days'}`}>
            {ticksA.map((t, i) => <line key={i} x1={0} x2={innerW} y1={yA(t)} y2={yA(t)} className="chart-grid" />)}
            <rect x={x(cur) - colW / 2} y={TOP - 14} width={colW} height={plotH + 22} className="chart-sel" />
            {series.map((s) => {
              const pts = s.values.flatMap((v, i) => (v === null ? [] : [{ i, v }]))
              const y = yOf(s)
              return (
                <g key={s.def.key}>
                  {pts.length > 1 && <path d={pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)},${y(p.v)}`).join(' ')} className={`ln ln${s.def.style}`} />}
                  {pts.map((p) => <Marker key={p.i} style={s.def.style} cx={x(p.i)} cy={y(p.v)} on={p.i === cur} />)}
                  {series.length === 1 && s.values[cur] !== null && (
                    <text x={x(cur)} y={y(s.values[cur]!) - 14} textAnchor="middle" className="chart-val">{fmt(s.values[cur]!)}</text>
                  )}
                </g>
              )
            })}
            {dates.map((d, i) => (
              <g
                key={d}
                className="chart-col"
                role="button"
                tabIndex={0}
                aria-label={`${longDate(d)}: ${summary(i)}`}
                aria-pressed={i === cur}
                onClick={() => setSel(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(i) } }}
              >
                <rect x={x(i) - colW / 2} y={0} width={colW} height={H} className="chart-hit" />
                <text x={x(i)} y={H - 12} textAnchor="middle" className={i === cur ? 'chart-text chart-date on' : 'chart-text chart-date'}>{d.slice(5).replace('-', '/')}</text>
              </g>
            ))}
          </svg>
        </div>
        {dual && (
          <svg className="chart-axis" width={AXIS_W} height={H} aria-hidden="true">
            {ticksB.map((t, i) => (
              <text key={i} x={6} y={yB(t) + 4} textAnchor="start" className="chart-text">{fmt(t)}</text>
            ))}
          </svg>
        )}
      </div>
      {dual && (
        <p className="sub" style={{ margin: '4px 0 0' }}>
          Left axis: {left.map((s) => s.def.label).join(', ')}. Right axis: {right.map((s) => s.def.label).join(', ')}.
        </p>
      )}
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
  const [keys, setKeys] = useState<string[]>([])

  if (list.length === 0) return <p className="sub">Charts for each exercise will appear here once there are some records.</p>

  const ex = list.find((e) => e.id === exId) ?? list[0]
  const metrics = METRICS[ex.kind]
  // Keep the chosen metrics that exist for this exercise; at least one stays selected.
  const chosen = metrics.filter((m) => keys.includes(m.key))
  const active: MetricDef[] = chosen.length ? chosen : [metrics[0]]
  const toggle = (key: string) => {
    const on = active.some((m) => m.key === key)
    if (on && active.length === 1) return
    setKeys(on ? active.filter((m) => m.key !== key).map((m) => m.key) : [...active.map((m) => m.key), key])
  }

  const { dates, series } = buildSeries(statsFor(ex.id, workouts), active)
  const best = (s: Series) => { const v = s.values.filter((x): x is number => x !== null); return v.length ? Math.max(...v) : null }

  return (
    <>
      <div className="chips" role="group" aria-label="Body part">
        {PARTS.filter((p) => list.some((e) => e.part === p)).map((p) => (
          <button key={p} className="chip" aria-pressed={p === ex.part} onClick={() => setExId(list.find((e) => e.part === p)!.id)}>{p}</button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Exercise">
        {list.filter((e) => e.part === ex.part).map((e) => (
          <button key={e.id} className="chip" aria-pressed={e.id === ex.id} onClick={() => setExId(e.id)}>{e.name}</button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Metrics (pick one or more)">
        {metrics.map((m) => (
          <button key={m.key} className="chip metric-chip" aria-pressed={active.some((a) => a.key === m.key)} onClick={() => toggle(m.key)}>
            <Swatch style={m.style} />{m.label}
          </button>
        ))}
      </div>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{ex.name}</h2>
        <p style={{ margin: '0 0 8px' }} className="sub">
          Personal best:{' '}
          {series.map((s, i) => (
            <span key={s.def.key}>{i > 0 && ' · '}{s.def.label} <b style={{ color: 'var(--ink)' }}>{best(s) === null ? '–' : fmt(best(s)!)} {s.def.unit}</b></span>
          ))}
        </p>
        {dates.length === 0 ? <p className="sub">No data to show.</p> : <Chart key={`${ex.id}-${active.map((m) => m.key).join('+')}`} dates={dates} series={series} />}
      </section>
    </>
  )
}
