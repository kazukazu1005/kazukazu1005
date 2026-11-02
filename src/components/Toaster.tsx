import { useEffect, useRef, useState } from 'react'
import { TOAST_EVENT } from '../toast'

export default function Toaster() {
  const [item, setItem] = useState<{ id: number; text: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    const on = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      setItem({ id: Date.now(), text })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setItem(null), 3000)
    }
    window.addEventListener(TOAST_EVENT, on)
    return () => { window.removeEventListener(TOAST_EVENT, on); clearTimeout(timer.current) }
  }, [])
  // The live region stays mounted so screen readers announce each new message.
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {item && <div key={item.id} className="toast">{item.text}</div>}
    </div>
  )
}
