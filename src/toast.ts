export const TOAST_EVENT = 'gymbro:toast'

/** Show a short confirmation at the bottom of the screen (errors stay inline, next to what failed). */
export function showToast(text: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: text }))
}
