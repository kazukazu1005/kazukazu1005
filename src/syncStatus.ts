import { useEffect, useState } from 'react'

const EVENT = 'gymbro:sync-status'
let last: string | null = null

/** Called after each upload attempt: an error message, or null when it worked. */
export function reportSync(error: string | null) {
  last = error
  window.dispatchEvent(new CustomEvent<string | null>(EVENT, { detail: error }))
}

/** The reason the last upload failed, or null. Lets the screen say so instead of failing silently. */
export function useSyncError(): string | null {
  const [err, setErr] = useState<string | null>(last)
  useEffect(() => {
    const on = (e: Event) => setErr((e as CustomEvent<string | null>).detail)
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return err
}
