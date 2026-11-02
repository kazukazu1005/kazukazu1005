import { useMemo, useState } from 'react'
import type { Route } from '../App'
import type { AppData } from '../data'
import Calendar from '../components/Calendar'
import { describeSet } from '../format'
import { toDateStr, weekStart, weekStreak, workoutVolume } from '../calc'

export default function Home({ data, go, signedIn }: { data: AppData; go: (r: Route) => void; signedIn: boolean }) {
  const todayStr = toDateStr(new Date())
  const [selected, setSelected] = useState(todayStr)

  const byDate = useMemo(() => {
    const m = new Map<string, typeof data.workouts>()
    for (const w of data.workouts) m.set(w.date, [...(m.get(w.date) ?? []), w])
    return m
  }, [data.workouts])

  const marks = (date: string) => ({ count: byDate.get(date)?.length ?? 0 })

  const ws = toDateStr(weekStart(new Date()))
  const thisWeek = data.workouts.filter((w) => w.date >= ws)
  const volume = thisWeek.reduce((a, w) => a + workoutVolume(w, data.exercises), 0)
  const setsThisWeek = thisWeek.reduce((a, w) => a + w.entries.reduce((n, e) => n + e.sets.length, 0), 0)

  const dayWorkouts = byDate.get(selected) ?? []
  const selLabel = new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <>
      <Calendar marks={marks} selected={selected} onSelect={setSelected} />

      <h2>{selLabel}</h2>
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
      <button className="btn block" onClick={() => go({ name: 'edit', date: selected })}>
        {selected === todayStr ? 'Log a workout' : `Log a workout on ${selected.slice(5).replace('-', '/')}`}
      </button>

      <section className="card" aria-labelledby="week" style={{ marginTop: 20 }}>
        <h2 id="week" style={{ marginTop: 0 }}>This week</h2>
        <div className="stats">
          <div className="stat"><span className="sub">Workouts</span><b>{thisWeek.length}</b></div>
          <div className="stat"><span className="sub">Week streak</span><b>{weekStreak(data.workouts)}</b></div>
          <div className="stat"><span className="sub">Volume</span><b>{Math.round(volume).toLocaleString()} kg</b></div>
          <div className="stat"><span className="sub">Sets</span><b>{setsThisWeek}</b></div>
        </div>
      </section>
    </>
  )
}
