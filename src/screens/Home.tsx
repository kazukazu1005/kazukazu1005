import { useMemo, useState } from 'react'
import type { Route } from '../App'
import type { AppData } from '../data'
import { monthGrid, toDateStr, weekStart, weekStreak, workoutVolume } from '../calc'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Home({ data, go }: { data: AppData; go: (r: Route) => void }) {
  const todayStr = toDateStr(new Date())
  const [ym, setYm] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  const [selected, setSelected] = useState(todayStr)

  const byDate = useMemo(() => {
    const m = new Map<string, typeof data.workouts>()
    for (const w of data.workouts) m.set(w.date, [...(m.get(w.date) ?? []), w])
    return m
  }, [data.workouts])

  const kindsOn = (date: string) => {
    let strength = false
    let cardio = false
    for (const w of byDate.get(date) ?? [])
      for (const e of w.entries) {
        if (data.exercises.get(e.exerciseId)?.kind === 'cardio') cardio = true
        else strength = true
      }
    return { strength, cardio }
  }

  const move = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }
  const goToday = () => {
    const n = new Date()
    setYm({ y: n.getFullYear(), m: n.getMonth() })
    setSelected(todayStr)
  }

  const cells = monthGrid(ym.y, ym.m)
  const monthPrefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
  const monthCount = new Set(data.workouts.filter((w) => w.date.startsWith(monthPrefix)).map((w) => w.date)).size
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const ws = toDateStr(weekStart(new Date()))
  const thisWeek = data.workouts.filter((w) => w.date >= ws)
  const volume = thisWeek.reduce((a, w) => a + workoutVolume(w, data.exercises), 0)
  let km = 0
  for (const w of thisWeek)
    for (const e of w.entries)
      if (data.exercises.get(e.exerciseId)?.kind === 'cardio') for (const s of e.sets) km += s.distanceKm ?? 0

  const dayWorkouts = byDate.get(selected) ?? []
  const selLabel = new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <>
      <section aria-label="Calendar" className="cal">
        <div className="row spread" style={{ marginBottom: 4 }}>
          <button className="btn secondary small" onClick={() => move(-1)} aria-label="Previous month">‹</button>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0 }} aria-live="polite">{label}</h2>
            <span className="sub">{monthCount} {monthCount === 1 ? 'day' : 'days'} trained</span>
          </div>
          <button className="btn secondary small" onClick={() => move(1)} aria-label="Next month">›</button>
        </div>
        <div className="cal-grid" role="grid" aria-label={label}>
          {DOW.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
          {cells.map((c, i) => {
            if (!c) return <div key={i} />
            const k = kindsOn(c)
            const n = byDate.get(c)?.length ?? 0
            return (
              <button
                key={c}
                className="cal-day"
                aria-pressed={c === selected}
                aria-current={c === todayStr ? 'date' : undefined}
                aria-label={`${c}, ${n} ${n === 1 ? 'workout' : 'workouts'}`}
                onClick={() => setSelected(c)}
              >
                <span className="cal-num">{Number(c.slice(8))}</span>
                <span className="cal-dots" aria-hidden="true">
                  {k.strength && <i className="dot strength" />}
                  {k.cardio && <i className="dot cardio" />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="row sub" style={{ marginTop: 4, gap: 16 }}>
          <span><i className="dot strength" /> Strength</span>
          <span><i className="dot cardio" /> Cardio</span>
          <button className="btn secondary small" style={{ marginLeft: 'auto' }} onClick={goToday}>Today</button>
        </div>
      </section>

      <h2>{selLabel}</h2>
      {dayWorkouts.length === 0 && <p className="sub">No workouts on this day.</p>}
      {dayWorkouts.map((w) => (
        <button key={w.id} className="card list-btn" onClick={() => go({ name: 'edit', id: w.id })}>
          <div className="row spread">
            <h3>{w.title || 'Workout'}</h3>
            <span className="row">
              {w.visibility === 'friends' && <span className={`badge${w.synced ? '' : ' plain'}`}>{w.synced ? 'Shared' : 'Share pending'}</span>}
              <span className="sub">{w.entries.length} {w.entries.length === 1 ? 'exercise' : 'exercises'}</span>
            </span>
          </div>
          <div className="sub">{w.entries.map((e) => data.exercises.get(e.exerciseId)?.name ?? '(deleted exercise)').join(', ') || 'No exercises'}</div>
        </button>
      ))}
      <button className="btn block" onClick={() => go({ name: 'edit', date: selected })}>
        {selected === todayStr ? 'Log a workout' : `Log a workout on ${selected.slice(5).replace('-', '/')}`}
      </button>

      <section className="card" aria-labelledby="week" style={{ marginTop: 20 }}>
        <h2 id="week" style={{ marginTop: 0 }}>This week</h2>
        <div className="stats">
          <div className="stat"><span className="sub">Workouts</span><b>{thisWeek.length}</b></div>
          <div className="stat"><span className="sub">Week streak</span><b>{weekStreak(data.workouts)}</b></div>
          <div className="stat"><span className="sub">Volume</span><b>{Math.round(volume).toLocaleString()} kg</b></div>
          <div className="stat"><span className="sub">Cardio</span><b>{km.toFixed(1)} km</b></div>
        </div>
      </section>
    </>
  )
}
