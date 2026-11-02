import { isFilledSet } from './calc'
import type { Workout } from './types'

/** An unsaved workout kept on this device so leaving the screen (or the app) does not lose it. */
export interface Draft { w: Workout; base: number; at: number }

const k = (key: string) => `gymbro:draft:${key}`

export function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(k(key))
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    if (!d || typeof d.base !== 'number' || !d.w || typeof d.w.id !== 'string' || !Array.isArray(d.w.entries)) return null
    return d
  } catch {
    return null
  }
}

export function saveDraft(key: string, w: Workout, base: number) {
  try {
    localStorage.setItem(k(key), JSON.stringify({ w, base, at: Date.now() } satisfies Draft))
  } catch { /* storage full or blocked: drafts are a convenience only */ }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(k(key)) } catch { /* ignore */ }
}

/** Worth keeping a draft of a brand-new workout? */
export function hasContent(w: Workout): boolean {
  return w.title.trim() !== '' || w.note.trim() !== '' || w.entries.some((e) => e.sets.some(isFilledSet))
}
