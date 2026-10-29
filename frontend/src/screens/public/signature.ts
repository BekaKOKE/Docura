// The rules for a drawn signature (components.md §3, "SignaturePad"), kept apart from the canvas so they can be
// tested without one: how big a drawing must be to count, and how big the PNG that is sent may be.

/** One stroke as `signature_pad` reports it: the points the finger passed, in CSS pixels. */
export interface Stroke {
  points: readonly { x: number; y: number }[]
}

export interface SignatureStats {
  strokes: number
  points: number
  /** The box around everything drawn, in CSS pixels. */
  box: { left: number; top: number; width: number; height: number }
}

/** At least 2 strokes or 40 points, and a box of at least 60 × 20 px. */
export const MIN_STROKES = 2
export const MIN_POINTS = 40
export const MIN_WIDTH = 60
export const MIN_HEIGHT = 20

/** The sent PNG: at most 1200 × 400 px and 200 KB (the API limit). */
export const MAX_WIDTH = 1200
export const MAX_HEIGHT = 400
export const MAX_PNG_BYTES = 200 * 1024

/** Null while nothing is drawn. */
export function signatureStats(strokes: readonly Stroke[]): SignatureStats | null {
  let count = 0
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      count += 1
      left = Math.min(left, point.x)
      top = Math.min(top, point.y)
      right = Math.max(right, point.x)
      bottom = Math.max(bottom, point.y)
    }
  }
  if (count === 0) return null
  return { strokes: strokes.length, points: count, box: { left, top, width: right - left, height: bottom - top } }
}

/** A dot, or a scribble that is too small, is not a signature. */
export function isLongEnough(stats: SignatureStats | null): boolean {
  if (!stats) return false
  const enough = stats.strokes >= MIN_STROKES || stats.points >= MIN_POINTS
  return enough && stats.box.width >= MIN_WIDTH && stats.box.height >= MIN_HEIGHT
}

/** The size that fits `width × height` into the limits, keeping the proportions; never larger than it is. */
export function fitWithin(width: number, height: number, maxWidth = MAX_WIDTH, maxHeight = MAX_HEIGHT) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** The size of the bytes a base64 string stands for. */
export function base64Bytes(base64: string): number {
  const clean = base64.replace(/\s/g, '')
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.floor((clean.length * 3) / 4) - padding
}

/** The base64 part of a `data:` URL. */
export function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma < 0 ? dataUrl : dataUrl.slice(comma + 1)
}
