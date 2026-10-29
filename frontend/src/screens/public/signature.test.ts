import { describe, expect, it } from 'vitest'
import {
  base64Bytes,
  fitWithin,
  isLongEnough,
  MAX_HEIGHT,
  MAX_WIDTH,
  signatureStats,
  stripDataUrl,
  type Stroke,
} from './signature'

// The rules for a drawn signature (#24 AC 4 and 5): what counts as a signature, and the size of the PNG that is sent.

const line = (x0: number, y0: number, x1: number, y1: number, points = 10): Stroke => ({
  points: Array.from({ length: points }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (points - 1), y: y0 + ((y1 - y0) * i) / (points - 1) })),
})

describe('signatureStats', () => {
  it('is null while nothing is drawn', () => {
    expect(signatureStats([])).toBeNull()
    expect(signatureStats([{ points: [] }])).toBeNull()
  })

  it('counts strokes and points and boxes everything drawn', () => {
    const stats = signatureStats([line(10, 20, 110, 20), line(30, 5, 30, 85, 5)])!
    expect(stats.strokes).toBe(2)
    expect(stats.points).toBe(15)
    expect(stats.box).toEqual({ left: 10, top: 5, width: 100, height: 80 })
  })
})

describe('isLongEnough (components.md §3: 2 strokes or 40 points, and 60 × 20 px)', () => {
  it('refuses nothing drawn and a single dot', () => {
    expect(isLongEnough(null)).toBe(false)
    expect(isLongEnough(signatureStats([{ points: [{ x: 50, y: 50 }] }]))).toBe(false)
  })

  it('refuses a scribble smaller than 60 × 20 px, however many points it has', () => {
    expect(isLongEnough(signatureStats([line(10, 10, 50, 25, 80)]))).toBe(false) // 40 × 15
    expect(isLongEnough(signatureStats([line(10, 10, 80, 25, 80)]))).toBe(false) // 70 × 15: too flat
    expect(isLongEnough(signatureStats([line(10, 10, 50, 40, 80)]))).toBe(false) // 40 × 30: too narrow
  })

  it('refuses a big box with too few points in one stroke', () => {
    expect(isLongEnough(signatureStats([line(10, 10, 200, 90, 5)]))).toBe(false)
  })

  it('accepts a real signature: a long stroke, or two strokes', () => {
    expect(isLongEnough(signatureStats([line(10, 10, 200, 90, 40)]))).toBe(true)
    expect(isLongEnough(signatureStats([line(10, 10, 200, 40, 5), line(10, 60, 100, 60, 5)]))).toBe(true)
  })

  it('takes exactly 60 × 20 px', () => {
    expect(isLongEnough(signatureStats([line(0, 0, 60, 20, 40)]))).toBe(true)
    expect(isLongEnough(signatureStats([line(0, 0, 59, 20, 40)]))).toBe(false)
  })
})

describe('fitWithin (the PNG is at most 1200 × 400)', () => {
  it('leaves a small drawing as it is', () => {
    expect(fitWithin(300, 100)).toEqual({ width: 300, height: 100 })
  })

  it('shrinks a wide one to the width limit, keeping the proportions', () => {
    expect(fitWithin(2400, 400)).toEqual({ width: MAX_WIDTH, height: 200 })
  })

  it('shrinks a tall one to the height limit', () => {
    expect(fitWithin(600, 800)).toEqual({ width: 300, height: MAX_HEIGHT })
  })

  it('never makes a side zero', () => {
    expect(fitWithin(5000, 1)).toEqual({ width: MAX_WIDTH, height: 1 })
  })
})

describe('base64 helpers', () => {
  it('measures the bytes a base64 string stands for', () => {
    expect(base64Bytes('AAAA')).toBe(3)
    expect(base64Bytes('AAA=')).toBe(2)
    expect(base64Bytes('AA==')).toBe(1)
    expect(base64Bytes('')).toBe(0)
  })

  it('cuts the data: prefix off', () => {
    expect(stripDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('iVBORw0KGgo=')
    expect(stripDataUrl('iVBORw0KGgo=')).toBe('iVBORw0KGgo=')
  })
})
