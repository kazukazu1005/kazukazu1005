import { useState } from 'react'

/** Round icon button that spins while loading and shows when the data was last updated. */
export default function RefreshButton({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [at, setAt] = useState<Date | null>(null)
  const run = async () => {
    setBusy(true)
    try {
      await onRefresh()
      setAt(new Date())
    } finally {
      setBusy(false)
    }
  }
  const time = at ? at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <span className="refresh">
      <span className="sub" aria-live="polite">{busy ? 'Updating…' : at ? `Updated ${time}` : ''}</span>
      <button className="icon-btn" aria-label="Refresh" aria-busy={busy} disabled={busy} onClick={run}>
        <svg className={busy ? 'spin' : undefined} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </span>
  )
}
