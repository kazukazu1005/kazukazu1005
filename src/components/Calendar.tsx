import { useState } from 'react'
import { monthGrid, toDateStr } from '../calc'

export interface DayMark { count: number }

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Monthly calendar. Owns the visible month; the parent owns the selected day. */
export default function Calendar({
  marks, selected, onSelect,
}: { marks: (date: string) => DayMark; selected: string; onSelect: (date: string) => void }) {
  const todayStr = toDateStr(new Date())
  const [ym, setYm] = useState(() => {
    const d = new Date(selected + 'T00:00:00')
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const move = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }
  const goToday = () => {
    const n = new Date()
    setYm({ y: n.getFullYear(), m: n.getMonth() })
    onSelect(todayStr)
  }

  const cells = monthGrid(ym.y, ym.m)
  const daysTrained = cells.filter((c) => c && marks(c).count > 0).length
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <section aria-label="Calendar" className="cal">
      <div className="row spread" style={{ marginBottom: 4 }}>
        <button className="btn secondary small" onClick={() => move(-1)} aria-label="Previous month">‹</button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0 }} aria-live="polite">{label}</h2>
          <span className="sub">{daysTrained} {daysTrained === 1 ? 'day' : 'days'} trained</span>
        </div>
        <button className="btn secondary small" onClick={() => move(1)} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid" role="grid" aria-label={label}>
        {DOW.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          const k = marks(c)
          return (
            <button
              key={c}
              className={k.count > 0 ? 'cal-day trained' : 'cal-day'}
              aria-pressed={c === selected}
              aria-current={c === todayStr ? 'date' : undefined}
              aria-label={`${c}, ${k.count} ${k.count === 1 ? 'workout' : 'workouts'}`}
              onClick={() => onSelect(c)}
            >
              <span className="cal-num">{Number(c.slice(8))}</span>
            </button>
          )
        })}
      </div>
      <div className="row spread" style={{ marginTop: 4 }}>
        <span className="sub row" style={{ gap: 6 }}><i className="legend-dot" aria-hidden="true" />Trained</span>
        <button className="btn secondary small" onClick={goToday}>Today</button>
      </div>
    </section>
  )
}
