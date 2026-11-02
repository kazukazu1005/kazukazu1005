export const CELEBRATE_EVENT = 'gymbro:celebrate'

export interface RecordItem { name: string; next: number; prev: number; date: string }

/** Open the "new record" screen. */
export function celebrate(items: RecordItem[]) {
  if (items.length) window.dispatchEvent(new CustomEvent<RecordItem[]>(CELEBRATE_EVENT, { detail: items }))
}
