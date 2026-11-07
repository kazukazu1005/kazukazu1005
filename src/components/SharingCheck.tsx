import { useState } from 'react'
import type { AppData } from '../data'
import { buildPayload, diagnoseSharing, pushWorkout, syncPending, type Profile, type SharingReport } from '../social'
import { useSyncError } from '../syncStatus'

const isErr = (v: number | string) => typeof v === 'string'

/** One tap to see where sharing stops, in plain numbers. Shows no secrets. */
export default function SharingCheck({ me, data, userId }: { me: Profile; data: AppData; userId: string }) {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<SharingReport | null>(null)
  const [sendNote, setSendNote] = useState<string | null>(null)
  const lastError = useSyncError()

  const unsent = data.workouts.filter((w) => !w.synced)

  const run = async () => {
    setBusy(true)
    setSendNote(null)
    // Try the first unsent workout directly so the real reason is shown, then send the rest the normal way.
    if (unsent[0]) {
      try {
        await pushWorkout(userId, unsent[0], buildPayload(unsent[0], data.exercises, data.workouts))
        setSendNote('Sent. ')
      } catch (e) {
        setSendNote(`Could not send: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
    try {
      await syncPending(userId, data.workouts, data.exercises)
    } catch { /* the reason is already shown above */ }
    try {
      setReport(await diagnoseSharing(userId))
    } catch (e) {
      setReport({ friends: 'error', mineOnServer: 'error', friendsOnServer: `error: ${e instanceof Error ? e.message : ''}` })
    }
    setBusy(false)
  }

  const verdict = (() => {
    if (!report) return null
    if (sendNote?.startsWith('Could not send')) return 'Your workouts cannot reach the server. See the reason above.'
    if (isErr(report.friends) || isErr(report.mineOnServer) || isErr(report.friendsOnServer)) return 'The server returned an error. Send the lines above.'
    if (report.friends === 0) return 'You have no friends yet. Add one with their invite code.'
    if (data.workouts.length > 0 && report.mineOnServer === 0) return 'Your workouts are not on the server yet.'
    if (report.friendsOnServer === 0) return 'You are friends, but no friend workout is visible. Ask your friend to open the app, sign in, and press this check too: their workouts may not have reached the server.'
    return 'Looks fine: friends’ workouts are visible. Open the Feed and press refresh.'
  })()

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Check sharing</h2>
      <p className="sub">If you cannot see a friend’s workouts, press this and send me what it shows.</p>
      <button className="btn secondary" disabled={busy} onClick={run}>{busy ? 'Checking…' : 'Check now'}</button>
      {(report || sendNote) && (
        <ul className="hint-list" style={{ marginTop: 12 }}>
          <li>Signed in as <b>@{me.username}</b></li>
          <li>Workouts on this device: <b>{data.workouts.length}</b> (waiting to send: <b>{unsent.length}</b>)</li>
          {sendNote && <li>Send test: <b>{sendNote}</b></li>}
          {lastError && <li>Last upload error: <b>{lastError}</b></li>}
          {report && <li>Friends you can see: <b>{String(report.friends)}</b></li>}
          {report && <li>Your workouts on the server: <b>{String(report.mineOnServer)}</b></li>}
          {report && <li>Friends’ workouts you can see: <b>{String(report.friendsOnServer)}</b></li>}
        </ul>
      )}
      {verdict && <div className="msg ok" role="status">{verdict}</div>}
    </section>
  )
}
