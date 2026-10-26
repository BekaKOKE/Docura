export type Zoom = 'fit' | 'actual'

/** The scale that makes a sheet `pageWidth` wide fit a box `frameWidth` wide. Never enlarges; 1 when unknown. */
export function fitScale(frameWidth: number, pageWidth: number): number {
  if (!(frameWidth > 0) || !(pageWidth > 0)) return 1
  return Math.min(1, frameWidth / pageWidth)
}
