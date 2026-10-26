import { describe, expect, it } from 'vitest'
import { divRoundHalfUp, formatMoney, parsePriceTiyn, parseQuantityMilli, toSafeTiyn } from './money'

const NBSP = ' '

describe('parseQuantityMilli', () => {
  it.each([
    ['12,5', 12500],
    ['12.5', 12500],
    ['0,125', 125],
    ['32', 32000],
    ['1 000', 1000000],
    ['007,5', 7500],
    ['  3,25  ', 3250],
  ])('parses %j as %i thousandths', (text, expected) => {
    expect(parseQuantityMilli(text)).toBe(expected)
  })

  it.each(['1,2345', '-5', '-0,5', 'abc', '12a', '1,2,3', '', '   ', ',5', '12,', '1e3', '+5'])(
    'rejects %j',
    (text) => {
      expect(parseQuantityMilli(text)).toBeNull()
    },
  )

  it('rejects a quantity too large to stay exact', () => {
    expect(parseQuantityMilli('1234567890')).toBeNull()
    expect(parseQuantityMilli('999999999,999')).toBe(999999999999)
  })
})

describe('parsePriceTiyn', () => {
  it.each([
    ['18 500', 1850000],
    [`18${NBSP}500`, 1850000],
    ['18 500', 1850000],
    ['18500,50', 1850050],
    ['18500.5', 1850050],
    ['0,01', 1],
    ['0', 0],
    ['9 999 999', 999999900],
  ])('parses %j as %i tiyn', (text, expected) => {
    expect(parsePriceTiyn(text)).toBe(expected)
  })

  it.each(['1,234', '-5', 'abc', '', '18 500 ₸', '1,5,0'])('rejects %j', (text) => {
    expect(parsePriceTiyn(text)).toBeNull()
  })
})

describe('divRoundHalfUp', () => {
  it.each([
    [5n, 2n, 3n],
    [4n, 2n, 2n],
    [1n, 3n, 0n],
    [2n, 3n, 1n],
    [3n, 2n, 2n],
    [0n, 7n, 0n],
  ])('%s / %s rounds to %s', (n, d, expected) => {
    expect(divRoundHalfUp(n, d)).toBe(expected)
  })

  it('refuses a negative numerator or a non-positive denominator', () => {
    expect(() => divRoundHalfUp(-1n, 2n)).toThrow(RangeError)
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(RangeError)
  })
})

describe('toSafeTiyn', () => {
  it('throws instead of losing precision', () => {
    expect(toSafeTiyn(123n)).toBe(123)
    expect(() => toSafeTiyn(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError)
  })
})

describe('formatMoney', () => {
  it('UI mode: no tiyn when they are zero', () => {
    expect(formatMoney(125000000)).toBe(`1${NBSP}250${NBSP}000${NBSP}₸`)
  })

  it('UI mode: two tiyn digits when non-zero', () => {
    expect(formatMoney(12345)).toBe(`123,45${NBSP}₸`)
    expect(formatMoney(12340)).toBe(`123,40${NBSP}₸`)
    expect(formatMoney(1)).toBe(`0,01${NBSP}₸`)
  })

  it('document mode: always two tiyn digits', () => {
    expect(formatMoney(125000000, 'document')).toBe(`1${NBSP}250${NBSP}000,00${NBSP}₸`)
    expect(formatMoney(0, 'document')).toBe(`0,00${NBSP}₸`)
  })

  it('groups four-digit amounts too', () => {
    expect(formatMoney(999900)).toBe(`9${NBSP}999${NBSP}₸`)
  })

  it('uses U+00A0 for every group separator and before ₸, and no plain space', () => {
    for (const text of [formatMoney(125000000), formatMoney(12345), formatMoney(125000000, 'document')]) {
      expect(text).not.toContain(' ')
      expect([...text].filter((char) => char === NBSP).length).toBeGreaterThanOrEqual(1)
      expect(text.endsWith(`${NBSP}₸`)).toBe(true)
    }
    expect(formatMoney(125000000).charCodeAt(1)).toBe(0xa0)
    expect(formatMoney(125000000, 'document').at(-2)?.charCodeAt(0)).toBe(0xa0)
  })

  it('formats a large amount exactly: 1000 × 9 999 999 ₸', () => {
    expect(formatMoney(999999900000)).toBe(`9${NBSP}999${NBSP}999${NBSP}000${NBSP}₸`)
  })

  it('rejects a non-integer amount', () => {
    expect(() => formatMoney(1.5)).toThrow(RangeError)
    expect(() => formatMoney(Number.NaN)).toThrow(RangeError)
  })
})

describe('integer-only code', () => {
  // The source of every non-test module in src/domain, read as text by Vite.
  const sources = import.meta.glob(['./*.ts', '!./*.test.ts', '!./testVectors.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  it('reads the domain modules', () => {
    expect(Object.keys(sources)).toEqual(expect.arrayContaining(['./money.ts', './totals.ts']))
  })

  // The banned names are assembled from pieces, so a text search of this folder finds only real uses.
  const banned = (...parts: string[]) => new RegExp(parts.join(''))

  it.each([
    ['float parsing', banned('parse', 'Float')],
    ['fixed-digit rounding', banned('to', 'Fixed')],
    ['float rounding', banned('Math', '\\.', 'round')],
    ['decimal literal factor', /[*/]\s*0\.\d/],
    ['division by 100', /\/\s*100\b(?!0)/],
  ])('has no %s', (_name, pattern) => {
    for (const [file, text] of Object.entries(sources)) {
      expect({ file, hit: pattern.test(text) }).toEqual({ file, hit: false })
    }
  })
})
