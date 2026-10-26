import { describe, expect, it } from 'vitest'
import { formatMoney, parseQuantityMilli } from './money'
import { computeLine, computePrepayment, computeTotals, splitGross } from './totals'
import { prepaymentVectors, totalsVectors } from './testVectors'

function allIntegers(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value)
  if (Array.isArray(value)) return value.every(allIntegers)
  if (value && typeof value === 'object') return Object.values(value).every(allIntegers)
  return true
}

describe('contracts/test-vectors/totals.json', () => {
  it('has cases with unique ids', () => {
    expect(totalsVectors.cases.length).toBeGreaterThan(0)
    expect(new Set(totalsVectors.cases.map((c) => c.id)).size).toBe(totalsVectors.cases.length)
  })

  it.each(totalsVectors.cases.map((c) => [c.id, c] as const))('%s', (_id, vector) => {
    // The typed text must parse to the vector's quantity …
    for (const line of vector.lines) expect(parseQuantityMilli(line.qtyText)).toBe(line.qtyMilli)

    // … and the totals must match exactly, in whole tiyn.
    const result = computeTotals(
      vector.lines.map((line) => ({
        qtyMilli: line.qtyMilli,
        unitPriceTiyn: line.unitPriceTiyn,
        discountBp: line.discountBp,
      })),
      { vatEnabled: vector.vatEnabled, vatRateBp: vector.vatRateBp },
    )
    expect(result).toEqual(vector.expected)
    expect(allIntegers(result)).toBe(true)
  })
})

describe('contracts/test-vectors/prepayment.json', () => {
  it('has cases with unique ids', () => {
    expect(prepaymentVectors.cases.length).toBeGreaterThan(0)
    expect(new Set(prepaymentVectors.cases.map((c) => c.id)).size).toBe(prepaymentVectors.cases.length)
  })

  it.each(prepaymentVectors.cases.map((c) => [c.id, c] as const))('%s', (_id, vector) => {
    const common = {
      quoteGrossTiyn: vector.quoteGrossTiyn,
      alreadyInvoicedTiyn: vector.alreadyInvoicedTiyn,
      vatEnabled: vector.vatEnabled,
      vatRateBp: vector.vatRateBp,
    }
    const result =
      vector.basis === 'remaining'
        ? computePrepayment({ ...common, basis: 'remaining' })
        : computePrepayment({ ...common, basis: vector.basis, basisValue: vector.basisValue ?? 0 })
    expect(result).toEqual(vector.expected)
    expect(allIntegers(result)).toBe(true)
  })
})

describe('computeLine', () => {
  it('rounds the net half up, not down and not to even', () => {
    // 1,5 × 1 001,01 ₸ = 150 151,5 tiyn → 150 152
    expect(computeLine({ qtyMilli: 1500, unitPriceTiyn: 100101 }, { vatEnabled: false, vatRateBp: 1600 }).netTiyn).toBe(
      150152,
    )
    // 0,001 × 5 tiyn = 0,005 tiyn → 0; 0,001 × 500 tiyn = 0,5 tiyn → 1
    expect(computeLine({ qtyMilli: 1, unitPriceTiyn: 5 }, { vatEnabled: false, vatRateBp: 0 }).netTiyn).toBe(0)
    expect(computeLine({ qtyMilli: 1, unitPriceTiyn: 500 }, { vatEnabled: false, vatRateBp: 0 }).netTiyn).toBe(1)
  })

  it('gives zero VAT and gross = net when VAT is off, whatever the rate says', () => {
    expect(computeLine({ qtyMilli: 1000, unitPriceTiyn: 10000 }, { vatEnabled: false, vatRateBp: 1600 })).toEqual({
      netTiyn: 10000,
      vatTiyn: 0,
      grossTiyn: 10000,
    })
  })

  it('applies a discount in basis points (post-MVP input, same formula)', () => {
    expect(
      computeLine({ qtyMilli: 1000, unitPriceTiyn: 10000, discountBp: 1000 }, { vatEnabled: false, vatRateBp: 1600 })
        .netTiyn,
    ).toBe(9000)
  })

  it('refuses negative, fractional and unsafe inputs', () => {
    const vat = { vatEnabled: true, vatRateBp: 1600 }
    expect(() => computeLine({ qtyMilli: -1, unitPriceTiyn: 1 }, vat)).toThrow(RangeError)
    expect(() => computeLine({ qtyMilli: 1.5, unitPriceTiyn: 1 }, vat)).toThrow(RangeError)
    expect(() => computeLine({ qtyMilli: 1, unitPriceTiyn: 1, discountBp: 10001 }, vat)).toThrow(RangeError)
    expect(() => computeLine({ qtyMilli: 1e12, unitPriceTiyn: 1e14 }, vat)).toThrow(RangeError)
  })

  it('1000 × 9 999 999 ₸ stays exact, integer and formats as 9 999 999 000 ₸', () => {
    const qtyMilli = parseQuantityMilli('1000')
    expect(qtyMilli).toBe(1000000)
    const line = computeLine({ qtyMilli: 1000000, unitPriceTiyn: 999999900 }, { vatEnabled: true, vatRateBp: 1600 })
    expect(line).toEqual({ netTiyn: 999999900000, vatTiyn: 159999984000, grossTiyn: 1159999884000 })
    expect(Object.values(line).every(Number.isInteger)).toBe(true)
    expect(formatMoney(line.netTiyn)).toBe('9 999 999 000 ₸')
  })
})

describe('computeTotals', () => {
  it('sums per-line VAT, which can differ from VAT on the sum', () => {
    // Two lines of 0,03 ₸: VAT per line rounds 0,48 tiyn to 0 each, VAT on the sum would round 0,96 to 1.
    const result = computeTotals(
      [
        { qtyMilli: 1000, unitPriceTiyn: 3 },
        { qtyMilli: 1000, unitPriceTiyn: 3 },
      ],
      { vatEnabled: true, vatRateBp: 1600 },
    )
    expect(result.vatTiyn).toBe(0)
    expect(result.grossTiyn).toBe(6)
  })

  it('is zero for no lines', () => {
    expect(computeTotals([], { vatEnabled: true, vatRateBp: 1600 })).toEqual({
      lines: [],
      netTiyn: 0,
      vatTiyn: 0,
      grossTiyn: 0,
    })
  })
})

describe('splitGross', () => {
  it('splits VAT back out: vat = round(gross × rate / (10000 + rate))', () => {
    expect(splitGross(11600, { vatEnabled: true, vatRateBp: 1600 })).toEqual({
      grossTiyn: 11600,
      vatTiyn: 1600,
      netTiyn: 10000,
    })
  })

  it('keeps the whole gross as net without VAT', () => {
    expect(splitGross(11600, { vatEnabled: false, vatRateBp: 1600 })).toEqual({
      grossTiyn: 11600,
      vatTiyn: 0,
      netTiyn: 11600,
    })
  })
})

describe('computePrepayment edge cases', () => {
  const base = { quoteGrossTiyn: 1000, alreadyInvoicedTiyn: 0, vatEnabled: false, vatRateBp: 1600 }

  it('rejects a zero amount', () => {
    expect(computePrepayment({ ...base, basis: 'amount', basisValue: 0 })).toEqual({ error: 'invalid_amount' })
    expect(computePrepayment({ ...base, basis: 'percent', basisValue: 0 })).toEqual({ error: 'invalid_amount' })
  })

  it('allows exactly what is left', () => {
    expect(computePrepayment({ ...base, alreadyInvoicedTiyn: 400, basis: 'amount', basisValue: 600 })).toEqual({
      grossTiyn: 600,
      vatTiyn: 0,
      netTiyn: 600,
    })
  })
})
