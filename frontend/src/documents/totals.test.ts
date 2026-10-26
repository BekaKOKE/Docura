import { describe, expect, it } from 'vitest'
import { totalsVectors } from '../domain/testVectors'
import { referenceQuote, seedDocument } from './fixtures'
import type { RenderableDocument } from './model'
import { resolveTotals } from './totals'

// The editor shows totals computed from the lines; the renderer must print the same figures to the tiyn
// (#21 AC 1). The shared vectors are the ground truth for both.
describe('resolveTotals on a draft without saved totals', () => {
  it.each(totalsVectors.cases.map((c) => [c.id, c] as const))('%s matches the vectors', (_id, vector) => {
    const draft = (base: RenderableDocument): RenderableDocument => ({
      ...base,
      vatEnabled: vector.vatEnabled,
      vatRateBp: vector.vatRateBp,
      lines: vector.lines.map((line) => ({
        title: 'Работа',
        unit: 'шт',
        qtyMilli: line.qtyMilli,
        unitPriceTiyn: line.unitPriceTiyn,
        discountBp: line.discountBp,
      })),
      netTiyn: undefined,
      vatTiyn: undefined,
      grossTiyn: undefined,
    })
    const totals = resolveTotals(draft(referenceQuote()))
    expect(totals.lines).toEqual(vector.expected.lines)
    expect(totals.netTiyn).toBe(vector.expected.netTiyn)
    expect(totals.vatTiyn).toBe(vector.expected.vatTiyn)
    expect(totals.grossTiyn).toBe(vector.expected.grossTiyn)
  })
})

describe('resolveTotals on a saved document', () => {
  it('gives the reference quote 279 250 / 44 680 / 323 930 ₸', () => {
    const totals = resolveTotals(referenceQuote())
    expect([totals.netTiyn, totals.vatTiyn, totals.grossTiyn]).toEqual([27925000, 4468000, 32393000])
  })

  it('uses the saved split of a prepayment invoice as it is', () => {
    // СЧ-2026-0003: 30 % of 309 720 ₸. VAT is split out of the exact gross when the invoice is made, and
    // the renderer prints that split instead of working it out again from the line.
    const invoice = seedDocument('СЧ-2026-0003')
    const totals = resolveTotals(invoice)
    expect(totals.grossTiyn).toBe(9291600)
    expect(totals.lines[0]).toEqual({
      netTiyn: invoice.lines[0].netTiyn,
      vatTiyn: invoice.lines[0].vatTiyn,
      grossTiyn: invoice.lines[0].grossTiyn,
    })
  })
})
