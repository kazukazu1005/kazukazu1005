import { useMemo, useState } from 'react'
import type { Route } from '../App'
import type { AppData } from '../data'
import Calendar from '../components/Calendar'
import { describeSet, fmtKg, setRM } from '../format'
import { monthStats, toDateStr } from '../calc'

export default function Home({ data, go, signedIn }: { data: AppData; go: (r: Route) => void; signedIn: boolean }) {
  const todayStr = toDateStr(new Date())
  const [selected, setSelected] = useState(todayStr)

  const byDate = useMemo(() => {
    const m = new Map<string, typeof data.workouts>()
    for (const w of data.workouts) m.set(w.date, [...(m.get(w.date) ?? []), w])
    return m
  }, [data.workouts])

  const marks = (date: string) => ({ count: byDate.get(date)?.length ?? 0 })

  // The summary follows the month showing in the calendar.
  const [month, setMonth] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  const now = new Date()
  const isThisMonth = month.y === now.getFullYear() && month.m === now.getMonth()
  const monthTitle = isThisMonth ? 'This month' : new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const stats = monthStats(data.workouts, data.exercises, month.y, month.m)

  const dayWorkouts = byDate.get(selected) ?? []
  const latestOfDay = [...dayWorkouts].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const selLabel = new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <>
      <Calendar marks={marks} selected={selected} onSelect={setSelected} onMonthChange={setMonth} loading={!data.ready} />

      <h2>{selLabel}</h2>
      {!data.ready ? (
        // Same height as a typical day card, so nothing jumps when the records arrive.
        <div className="skeleton" style={{ height: 150 }} aria-hidden="true" />
      ) : (
        <>
        {dayWorkouts.length === 0 && <p className="sub">No workouts on this day.</p>}
        {dayWorkouts.map((w) => (
          <article key={w.id} className="card">
            <div className="row spread">
              <h3>{w.title || 'Workout'}</h3>
              <span className="row">
                {signedIn && <span className={`badge${w.synced ? '' : ' plain'}`}>{w.synced ? 'Shared' : 'Share pending'}</span>}
                <button className="btn secondary small" onClick={() => go({ name: 'edit', id: w.id })}>Edit</button>
              </span>
            </div>
            {w.entries.map((e) => {
              const ex = data.exercises.get(e.exerciseId)
              return (
                <div key={e.id} className="day-entry">
                  <div className="row spread">
                    <b>{ex?.name ?? '(deleted exercise)'}</b>
                    {ex && <span className="badge plain">{ex.part}</span>}
                  </div>
                  <ol className="sets">
                    {e.sets.map((st) => (
                      <li key={st.id}>
                        {ex ? describeSet(st, ex.kind) : ''}
                        {ex?.kind === 'weight' && setRM(st) !== null && <span className="sub"> · 1RM {fmtKg(setRM(st)!)}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )
            })}
            {w.entries.length === 0 && <p className="sub">No exercises.</p>}
            {w.note && <p className="sub" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{w.note}</p>}
          </article>
        ))}
        {dayWorkouts.length > 0 ? (
          // A workout already exists on this day: open it so you can carry on where you left off.
          <button className="btn block" onClick={() => go({ name: 'edit', id: latestOfDay!.id })}>Continue this workout</button>
        ) : (
          <button className="btn block" onClick={() => go({ name: 'edit', date: selected })}>
            {selected === todayStr ? 'Log a workout' : `Log a workout on ${selected.slice(5).replace('-', '/')}`}
          </button>
        )}
        </>
      )}

      <section className="card" aria-labelledby="month" style={{ marginTop: 20 }}>
        <h2 id="month" style={{ marginTop: 0 }}>{monthTitle}</h2>
        <div className={data.ready ? 'stats' : 'stats stats-loading'}>
          <div className="stat"><span className="sub">Workouts</span><b>{stats.workouts}</b></div>
          <div className="stat"><span className="sub">Active weeks</span><b>{stats.activeWeeks}</b></div>
          <div className="stat"><span className="sub">Volume</span><b>{Math.round(stats.volume).toLocaleString()} kg</b></div>
          <div className="stat"><span className="sub">Sets</span><b>{stats.sets}</b></div>
        </div>
      </section>
    </>
  )
}
