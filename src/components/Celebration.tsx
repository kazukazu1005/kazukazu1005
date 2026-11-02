import { useEffect, useRef, useState } from 'react'
import { CELEBRATE_EVENT, type RecordItem } from '../celebrate'
import { fmtKg } from '../format'
import { renderRecordImage, shareOrDownload } from '../recordImage'
import { showToast } from '../toast'
import { TROPHY_URL } from '../trophy'

// Fixed pseudo-random layout so the confetti looks scattered but is the same every time.
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 13) % 14) / 10,
  dur: 2.6 + ((i * 7) % 12) / 10,
  size: 7 + ((i * 5) % 7),
  color: ['#2383e2', '#37352f', '#a5a29b', '#2383e2'][i % 4],
  round: i % 3 === 0,
}))

/** "New 1RM record" screen. Opens from anywhere via celebrate(); closes with Done or Esc. */
export default function Celebration() {
  const [items, setItems] = useState<RecordItem[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const doneRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const on = (e: Event) => setItems((e as CustomEvent<RecordItem[]>).detail.slice().sort((a, b) => b.next - b.prev - (a.next - a.prev)))
    window.addEventListener(CELEBRATE_EVENT, on)
    return () => window.removeEventListener(CELEBRATE_EVENT, on)
  }, [])

  useEffect(() => {
    if (!items) return
    doneRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setItems(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [items])

  if (!items) return null

  const save = async (item: RecordItem, i: number) => {
    setBusy(i)
    try {
      const blob = await renderRecordImage(item)
      const how = await shareOrDownload(blob, `gym-bro-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${item.date}.png`)
      showToast(how === 'shared' ? 'Image ready to share' : 'Image saved')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not create the image')
    }
    setBusy(null)
  }

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="cel-title">
      <div className="confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <i key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, width: c.size, height: c.round ? c.size : c.size * 1.6, background: c.color, borderRadius: c.round ? '50%' : 2 }} />
        ))}
      </div>
      <div className="celebrate-body">
        <img className="trophy" src={TROPHY_URL} alt="" width={220} height={220} />
        <p className="eyebrow">New 1RM record</p>
        <h2 id="cel-title" className="celebrate-title">Congratulations!</h2>
        {items.slice(0, 3).map((it, i) => (
          <div key={it.name} className="record">
            <div className="record-name">{it.name}</div>
            <div className="record-num">{fmtKg(it.next)}<span> kg</span></div>
            <div className="record-diff">+{fmtKg(it.next - it.prev)} kg <span className="sub">from {fmtKg(it.prev)} kg</span></div>
            <button className="btn secondary small" disabled={busy !== null} onClick={() => save(it, i)}>
              {busy === i ? 'Creating image…' : 'Save image'}
            </button>
          </div>
        ))}
        {items.length > 3 && <p className="sub">and {items.length - 3} more {items.length - 3 === 1 ? 'record' : 'records'}</p>}
        <button ref={doneRef} className="btn block" style={{ marginTop: 16 }} onClick={() => setItems(null)}>Done</button>
      </div>
    </div>
  )
}
