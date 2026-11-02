import { useCallback, useEffect, useState } from 'react'
import { fetchLatestFriendPostTime } from './social'

const EPOCH = '1970-01-01T00:00:00.000Z'
const POLL_MS = 30000
const key = (uid: string) => `gymbro:feedSeen:${uid}`

function read(uid: string): string | null {
  try { return localStorage.getItem(key(uid)) } catch { return null }
}
function write(uid: string, v: string) {
  try { localStorage.setItem(key(uid), v) } catch { /* private mode etc.: the dot just resets next visit */ }
}
const after = (a: string, b: string) => Date.parse(a) > Date.parse(b)

/**
 * "A friend recorded something new" indicator.
 * `seen` is the newest friend post time you have looked at (kept on this device).
 * The first time on a device the baseline is set to the newest existing post, so old history does not light the dot.
 */
export function useFriendActivity(userId: string | undefined, enabled: boolean) {
  // null until we know this device's baseline, so nothing is flagged by mistake
  const [seen, setSeen] = useState<string | null>(null)
  const [latest, setLatest] = useState<string | null>(null)

  const check = useCallback(async () => {
    if (!userId || !enabled) return
    try {
      const t = await fetchLatestFriendPostTime(userId)
      setLatest(t)
      let stored = read(userId)
      if (stored === null) {
        stored = t ?? EPOCH
        write(userId, stored)
      }
      setSeen(stored)
    } catch { /* offline: try again on the next poll */ }
  }, [userId, enabled])

  useEffect(() => {
    if (!userId || !enabled) return
    void check()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void check() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, enabled, check])

  const markSeen = useCallback((iso: string) => {
    if (!userId) return
    const cur = read(userId) ?? EPOCH
    if (after(iso, cur)) {
      write(userId, iso)
      setSeen(iso)
    }
  }, [userId])

  return { unread: !!latest && seen !== null && after(latest, seen), seen, markSeen }
}
