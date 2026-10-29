// What the screen that makes an invoice from a signed quote (S14, #27) may offer and how it reads the input. Pure
// functions, no React. The mock (and later the backend) checks the same limits again on its side; here they only
// decide what is shown and what the person typed.

import { parsePriceInput } from '../../domain/article'
import type { MessageKey } from '../../i18n/t'
import type { BasisPoints, ConvertInput, Document, Tiyn } from '../../services'

export type Basis = 'full' | 'remaining' | 'percent' | 'amount'

/** The invoices made from the quote that still count: a cancelled one gives its money back. */
function liveInvoices(quote: Pick<Document, 'children'>) {
  return quote.children.filter((child) => child.type === 'invoice' && child.status !== 'cancelled')
}

export function invoicedTiyn(quote: Pick<Document, 'children'>): Tiyn {
  return liveInvoices(quote).reduce((sum, invoice) => sum + invoice.grossTiyn, 0)
}

/** What can still be invoiced: the quote total minus the invoices already made. */
export function availableTiyn(quote: Pick<Document, 'children' | 'grossTiyn'>): Tiyn {
  return Math.max(quote.grossTiyn - invoicedTiyn(quote), 0)
}

/**
 * The ways to invoice the quote that are on offer now: all of it (nothing is invoiced yet), or what is left (something
 * is), and a prepayment by percent or by sum. When everything is invoiced there is nothing to offer.
 */
export function offeredBases(quote: Pick<Document, 'children' | 'grossTiyn'>): Basis[] {
  if (availableTiyn(quote) <= 0) return []
  return liveInvoices(quote).length === 0 ? ['full', 'percent', 'amount'] : ['remaining', 'percent', 'amount']
}

export type PercentParse = { ok: true; bp: BasisPoints } | { ok: false; error: MessageKey }

/** "50", "12,5" or "12.5" → basis points (5000, 1250); up to two decimals, more than 0 and at most 100. */
export function parsePercent(text: string): PercentParse {
  const trimmed = text.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false, error: 'cv.error.percent' }
  const bp = Math.round(Number(trimmed) * 100)
  return bp > 0 && bp <= 10_000 ? { ok: true, bp } : { ok: false, error: 'cv.error.percent' }
}

/** A share of the total, half up, in whole tiyn (integers only: no floats in money). */
export function percentOf(totalTiyn: Tiyn, bp: BasisPoints): Tiyn {
  return Math.floor((totalTiyn * bp + 5_000) / 10_000)
}

export interface Typed {
  percent: string
  amount: string
}

/** What to send to `documents.convert` for an invoice, before it gets its idempotency key and `issue`. */
export type InvoiceRequest =
  | { target: 'invoice'; basis: 'full' | 'remaining' }
  | { target: 'invoice'; basis: 'percent'; basisValue: BasisPoints }
  | { target: 'invoice'; basis: 'amount'; basisValue: Tiyn }

// Checked against the contract: every request plus its key is a ConvertInput.
const _contract = (request: InvoiceRequest): ConvertInput => ({ ...request, clientRequestId: 'k' })
void _contract

export type Choice = { ok: true; input: InvoiceRequest; tiyn: Tiyn } | { ok: false; error: MessageKey }

/** The conversion the person asked for, with the amount it comes to, or what is wrong with what they typed. */
export function choose(quote: Pick<Document, 'children' | 'grossTiyn'>, basis: Basis, typed: Typed): Choice {
  if (basis === 'full') return { ok: true, input: { target: 'invoice', basis: 'full' }, tiyn: quote.grossTiyn }
  if (basis === 'remaining') return { ok: true, input: { target: 'invoice', basis: 'remaining' }, tiyn: availableTiyn(quote) }
  if (basis === 'percent') {
    const parsed = parsePercent(typed.percent)
    if (!parsed.ok) return parsed
    return { ok: true, input: { target: 'invoice', basis: 'percent', basisValue: parsed.bp }, tiyn: percentOf(quote.grossTiyn, parsed.bp) }
  }
  const price = parsePriceInput(typed.amount)
  if (!price.ok || price.tiyn <= 0) return { ok: false, error: 'cv.error.amount' }
  return { ok: true, input: { target: 'invoice', basis: 'amount', basisValue: price.tiyn }, tiyn: price.tiyn }
}
