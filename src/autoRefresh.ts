import { useEffect, useRef } from 'react'

/**
 * Call `refresh` every `ms` while the page is visible, and again when the person comes back to the
 * app or the connection returns. The latest `refresh` is always used, so it can be a plain closure.
 */
export function useAutoRefresh(refresh: () => void, ms = 30000) {
  const latest = useRef(refresh)
  latest.current = refresh
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) latest.current()
    }
    const timer = setInterval(tick, ms)
    window.addEventListener('focus', tick)
    window.addEventListener('online', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
      window.removeEventListener('online', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ms])
}
