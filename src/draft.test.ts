import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, hasContent, loadDraft, saveDraft } from './draft'
import type { Workout } from './types'

const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}

const w = (over: Partial<Workout> = {}): Workout => ({ id: 'w1', date: '2026-11-02', title: '', note: '', entries: [], createdAt: 1, updatedAt: 1, ...over })

describe('draft', () => {
  beforeEach(() => store.clear())
  it('round-trips and clears', () => {
    saveDraft('new', w({ title: 'Chest' }), 0)
    expect(loadDraft('new')?.w.title).toBe('Chest')
    clearDraft('new')
    expect(loadDraft('new')).toBeNull()
  })
  it('ignores corrupt data', () => {
    store.set('gymbro:draft:new', '{not json')
    expect(loadDraft('new')).toBeNull()
    store.set('gymbro:draft:new', JSON.stringify({ w: { id: 1 }, base: 0 }))
    expect(loadDraft('new')).toBeNull()
  })
  it('hasContent: an untouched form is not worth keeping', () => {
    expect(hasContent(w())).toBe(false)
    expect(hasContent(w({ entries: [{ id: 'e', exerciseId: 'x', sets: [{ id: 's' }, { id: 't' }, { id: 'u' }] }] }))).toBe(false)
    expect(hasContent(w({ entries: [{ id: 'e', exerciseId: 'x', sets: [{ id: 's', reps: 5 }] }] }))).toBe(true)
    expect(hasContent(w({ note: 'felt strong' }))).toBe(true)
  })
})
