import { fmtKg } from './format'
import type { RecordItem } from './celebrate'
import { TROPHY_URL } from './trophy'

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not draw the image.'))
    i.src = src
  })

const FONT = 'ui-sans-serif, -apple-system, "Segoe UI", "Noto Sans JP", Helvetica, Arial, sans-serif'

/** A 1080 x 1350 picture of one record, ready to post. */
export async function renderRecordImage(item: RecordItem): Promise<Blob> {
  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error('Could not draw the image.')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#e7f3fc'
  g.fillRect(0, 0, W, 14)

  const trophy = await loadImg(TROPHY_URL)
  g.drawImage(trophy, W / 2 - 280, 120, 560, 560)

  g.textAlign = 'center'
  g.fillStyle = '#0b6ec5'
  g.font = `700 44px ${FONT}`
  g.fillText('NEW 1RM RECORD', W / 2, 780)

  g.fillStyle = '#37352f'
  g.font = `700 76px ${FONT}`
  let name = item.name
  while (g.measureText(name).width > W - 120 && name.length > 4) name = name.slice(0, -2)
  g.fillText(name === item.name ? name : name + '…', W / 2, 890)

  g.font = `800 200px ${FONT}`
  g.fillText(`${fmtKg(item.next)} kg`, W / 2, 1090)

  g.fillStyle = '#787774'
  g.font = `500 42px ${FONT}`
  g.fillText(`+${fmtKg(item.next - item.prev)} kg  ·  was ${fmtKg(item.prev)} kg`, W / 2, 1165)
  g.font = `500 36px ${FONT}`
  g.fillText(item.date, W / 2, 1220)

  g.fillStyle = '#37352f'
  g.font = `800 44px ${FONT}`
  g.fillText('Gym Bro', W / 2, 1295)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'))
}

/** Share the picture with the phone's share sheet when possible, otherwise download it. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Gym Bro' })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared' // the person closed the sheet
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
