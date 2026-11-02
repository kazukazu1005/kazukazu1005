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
        <h2 id="week" style={{ marginTop: 0 }}>This week</h2>
        <div className="stats">
          <div className="stat"><span className="sub">Workouts</span><b>{thisWeek.length}</b></div>
          <div className="stat"><span className="sub">Week streak</span><b>{weekStreak(data.workouts)}</b></div>
          <div className="stat"><span className="sub">Volume</span><b>{Math.round(volume).toLocaleString()} kg</b></div>
          <div className="stat"><span className="sub">Cardio</span><b>{km.toFixed(1)} km / {Math.round(min)} min</b></div>
        </div>
      </section>

      <button className="btn block" onClick={() => go({ name: 'edit' })}>Log a workout</button>

      <h2>History</h2>
      {data.workouts.length === 0 && <p className="sub">No workouts yet. Tap “Log a workout” to start.</p>}
      {data.workouts.map((w) => (
        <button key={w.id} className="card list-btn" onClick={() => go({ name: 'edit', id: w.id })}>
          <div className="row spread">
            <h3>{w.date}{w.title ? `  ${w.title}` : ''}</h3>
            <span className="row">
              {w.visibility === 'friends' && <span className={`badge${w.synced ? '' : ' plain'}`}>{w.synced ? 'Shared' : 'Share pending'}</span>}
              <span className="sub">{w.entries.length} {w.entries.length === 1 ? "exercise" : "exercises"}</span>
            </span>
          </div>
          <div className="sub">
            {w.entries.map((e) => data.exercises.get(e.exerciseId)?.name ?? '(deleted exercise)').join(', ') || 'No exercises'}
          </div>
        </button>
      ))}
    </>
  )
}
