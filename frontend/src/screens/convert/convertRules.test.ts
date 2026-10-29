import { describe, expect, it } from 'vitest'
import type { Document, DocumentSummary } from '../../services'
import { availableTiyn, choose, invoicedTiyn, offeredBases, parsePercent, percentOf } from './convertRules'

// What the invoice screen offers and how it reads the input (#27 AC 1, 3, 4). The mock checks the same limits again.

const QUOTE_TIYN = 32_393_000 // 323 930 ₸

function child(grossTiyn: number, patch: Partial<DocumentSummary> = {}): DocumentSummary {
  return { type: 'invoice', status: 'issued', grossTiyn, ...patch } as DocumentSummary
}

const quote = (children: DocumentSummary[] = []): Pick<Document, 'children' | 'grossTiyn'> => ({ grossTiyn: QUOTE_TIYN, children })

describe('what is left to invoice', () => {
  it('is the whole quote when nothing is invoiced', () => {
    expect(invoicedTiyn(quote())).toBe(0)
    expect(availableTiyn(quote())).toBe(QUOTE_TIYN)
  })

  it('takes the invoices made from the quote off', () => {
    const half = quote([child(16_196_500)])
    expect(invoicedTiyn(half)).toBe(16_196_500)
    expect(availableTiyn(half)).toBe(16_196_500)
  })

  it('does not count a cancelled invoice, and never goes below zero', () => {
    expect(availableTiyn(quote([child(16_196_500, { status: 'cancelled' })]))).toBe(QUOTE_TIYN)
    expect(availableTiyn(quote([child(QUOTE_TIYN), child(100)]))).toBe(0)
  })

  it('ignores anything that is not an invoice', () => {
    expect(availableTiyn(quote([child(QUOTE_TIYN, { type: 'act' })]))).toBe(QUOTE_TIYN)
  })
})

describe('offeredBases (AC 1, 3)', () => {
  it('offers the full sum and the two prepayments on a quote with no invoice', () => {
    expect(offeredBases(quote())).toEqual(['full', 'percent', 'amount'])
  })

  it('offers the remainder, not the full sum, once an invoice exists', () => {
    expect(offeredBases(quote([child(16_196_500)]))).toEqual(['remaining', 'percent', 'amount'])
  })

  it('offers nothing when the quote is fully invoiced', () => {
    expect(offeredBases(quote([child(16_196_500), child(16_196_500)]))).toEqual([])
  })
})

describe('parsePercent', () => {
  it.each([
    ['50', 5000],
    ['12,5', 1250],
    ['12.5', 1250],
    ['0,01', 1],
    ['100', 10_000],
    [' 30 ', 3000],
  ])('reads %j as %i basis points', (text, bp) => {
    expect(parsePercent(text)).toEqual({ ok: true, bp })
  })

  it.each(['', '0', '0,00', '101', '100,01', '-5', 'abc', '5 0', '12,345', '1e2'])('refuses %j', (text) => {
    expect(parsePercent(text)).toEqual({ ok: false, error: 'cv.error.percent' })
  })
})

describe('percentOf (half up, whole tiyn)', () => {
  it('is 50 % of the reference quote: 161 965 ₸', () => {
    expect(percentOf(QUOTE_TIYN, 5000)).toBe(16_196_500)
  })

  it('is 30 %: 97 179 ₸', () => {
    expect(percentOf(QUOTE_TIYN, 3000)).toBe(9_717_900)
  })

  it('rounds half up', () => {
    expect(percentOf(1, 5000)).toBe(1) // 0.5 -> 1
    expect(percentOf(3, 5000)).toBe(2) // 1.5 -> 2
    expect(percentOf(1, 4999)).toBe(0) // 0.4999 -> 0
  })
})

describe('choose', () => {
  const typed = { percent: '50', amount: '100 000' }

  it('full: the whole quote, no value', () => {
    expect(choose(quote(), 'full', typed)).toEqual({ ok: true, input: { target: 'invoice', basis: 'full' }, tiyn: QUOTE_TIYN })
  })

  it('remaining: what is left', () => {
    expect(choose(quote([child(16_196_500)]), 'remaining', typed)).toEqual({
      ok: true,
      input: { target: 'invoice', basis: 'remaining' },
      tiyn: 16_196_500,
    })
  })

  it('percent: basis points and the amount they come to', () => {
    expect(choose(quote(), 'percent', typed)).toEqual({ ok: true, input: { target: 'invoice', basis: 'percent', basisValue: 5000 }, tiyn: 16_196_500 })
  })

  it('amount: tiyn, from what was typed with the thousands grouped', () => {
    expect(choose(quote(), 'amount', typed)).toEqual({ ok: true, input: { target: 'invoice', basis: 'amount', basisValue: 10_000_000 }, tiyn: 10_000_000 })
    expect(choose(quote(), 'amount', { ...typed, amount: '1000,50' })).toMatchObject({ ok: true, tiyn: 100_050 })
  })

  it('names what is wrong with a percent and an amount (TC-5)', () => {
    expect(choose(quote(), 'percent', { ...typed, percent: '0' })).toEqual({ ok: false, error: 'cv.error.percent' })
    expect(choose(quote(), 'percent', { ...typed, percent: '101' })).toEqual({ ok: false, error: 'cv.error.percent' })
    expect(choose(quote(), 'amount', { ...typed, amount: '' })).toEqual({ ok: false, error: 'cv.error.amount' })
    expect(choose(quote(), 'amount', { ...typed, amount: '0' })).toEqual({ ok: false, error: 'cv.error.amount' })
    expect(choose(quote(), 'amount', { ...typed, amount: 'abc' })).toEqual({ ok: false, error: 'cv.error.amount' })
    expect(choose(quote(), 'amount', { ...typed, amount: '-100' })).toEqual({ ok: false, error: 'cv.error.amount' })
  })

  it('does not stop an amount over what is left: the service refuses it with the amount that is available', () => {
    expect(choose(quote([child(16_196_500)]), 'amount', { ...typed, amount: '200 000' })).toMatchObject({ ok: true, tiyn: 20_000_000 })
  })
})
