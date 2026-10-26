// Line and document totals, and the prepayment VAT split. Integer tiyn only, rounding half up
// (spec §6; replica/architecture.md, Domain rules). Products run on BigInt, so nothing is rounded twice.

import { divRoundHalfUp, toSafeTiyn, type QtyMilli, type Tiyn } from './money'

const BASIS_POINTS = 10000n
const MILLI_PER_UNIT = 1000n

export interface LineInput {
  qtyMilli: QtyMilli
  unitPriceTiyn: Tiyn
  // Line discounts are post-MVP (#70); the MVP always passes 0.
  discountBp?: number
}

export interface VatSetting {
  vatEnabled: boolean
  vatRateBp: number
}

export interface LineTotals {
  netTiyn: Tiyn
  vatTiyn: Tiyn
  grossTiyn: Tiyn
}

export interface DocumentTotals extends LineTotals {
  lines: LineTotals[]
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`)
  }
}

// net = round(qtyMilli × unitPriceTiyn × (10000 − discountBp) / (1000 × 10000))
// vat = vatEnabled ? round(net × vatRateBp / 10000) : 0
// gross = net + vat
export function computeLine(line: LineInput, vat: VatSetting): LineTotals {
  const discountBp = line.discountBp ?? 0
  assertNonNegativeInteger(line.qtyMilli, 'qtyMilli')
  assertNonNegativeInteger(line.unitPriceTiyn, 'unitPriceTiyn')
  assertNonNegativeInteger(vat.vatRateBp, 'vatRateBp')
  if (!Number.isSafeInteger(discountBp) || discountBp < 0 || discountBp > 10000) {
    throw new RangeError('discountBp must be an integer from 0 to 10000')
  }

  const gross = BigInt(line.qtyMilli) * BigInt(line.unitPriceTiyn) * (BASIS_POINTS - BigInt(discountBp))
  const net = divRoundHalfUp(gross, MILLI_PER_UNIT * BASIS_POINTS)
  const vatAmount = vat.vatEnabled ? divRoundHalfUp(net * BigInt(vat.vatRateBp), BASIS_POINTS) : 0n

  return {
    netTiyn: toSafeTiyn(net),
    vatTiyn: toSafeTiyn(vatAmount),
    grossTiyn: toSafeTiyn(net + vatAmount),
  }
}

// VAT is per line; the document totals are the sums of the lines.
export function computeTotals(lines: readonly LineInput[], vat: VatSetting): DocumentTotals {
  const computed = lines.map((line) => computeLine(line, vat))
  let net = 0n
  let vatSum = 0n
  for (const line of computed) {
    net += BigInt(line.netTiyn)
    vatSum += BigInt(line.vatTiyn)
  }
  return {
    lines: computed,
    netTiyn: toSafeTiyn(net),
    vatTiyn: toSafeTiyn(vatSum),
    grossTiyn: toSafeTiyn(net + vatSum),
  }
}

// A one-line invoice has an exact gross; VAT is split back out of it:
// vat = round(gross × rate / (10000 + rate)), net = gross − vat.
export function splitGross(grossTiyn: Tiyn, vat: VatSetting): LineTotals {
  assertNonNegativeInteger(grossTiyn, 'grossTiyn')
  assertNonNegativeInteger(vat.vatRateBp, 'vatRateBp')
  const rate = BigInt(vat.vatRateBp)
  const vatAmount = vat.vatEnabled ? divRoundHalfUp(BigInt(grossTiyn) * rate, BASIS_POINTS + rate) : 0n
  return {
    netTiyn: toSafeTiyn(BigInt(grossTiyn) - vatAmount),
    vatTiyn: toSafeTiyn(vatAmount),
    grossTiyn,
  }
}

export type PrepaymentBasis =
  | { basis: 'percent'; basisValue: number } // basis points: 5000 = 50 %
  | { basis: 'amount'; basisValue: number } // tiyn
  | { basis: 'remaining' }

export type PrepaymentInput = VatSetting &
  PrepaymentBasis & {
    quoteGrossTiyn: Tiyn
    // Sum of the non-cancelled invoices already made from the quote.
    alreadyInvoicedTiyn: Tiyn
  }

export type PrepaymentError = 'exceeds_quote_total' | 'invalid_amount'
export type PrepaymentResult = LineTotals | { error: PrepaymentError }

// The invoices made from one quote never add up to more than its total.
export function computePrepayment(input: PrepaymentInput): PrepaymentResult {
  assertNonNegativeInteger(input.quoteGrossTiyn, 'quoteGrossTiyn')
  assertNonNegativeInteger(input.alreadyInvoicedTiyn, 'alreadyInvoicedTiyn')

  const left = BigInt(input.quoteGrossTiyn) - BigInt(input.alreadyInvoicedTiyn)
  let gross: bigint
  if (input.basis === 'percent') {
    assertNonNegativeInteger(input.basisValue, 'basisValue')
    gross = divRoundHalfUp(BigInt(input.quoteGrossTiyn) * BigInt(input.basisValue), BASIS_POINTS)
  } else if (input.basis === 'amount') {
    assertNonNegativeInteger(input.basisValue, 'basisValue')
    gross = BigInt(input.basisValue)
  } else {
    gross = left
  }

  if (gross > left || left <= 0n) return { error: 'exceeds_quote_total' }
  if (gross <= 0n) return { error: 'invalid_amount' }
  return splitGross(toSafeTiyn(gross), input)
}
