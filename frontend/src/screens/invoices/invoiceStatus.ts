// What the invoice screens say about an invoice's payment state (#28): the badge, how late, how much is waiting.
// Pure functions: the dates are compared as calendar days in Asia/Almaty, not in UTC, so an invoice that fell due
// yesterday evening is "Просрочен 1 дн." at half past midnight there, whatever the browser's own clock says.

import { daysBetween, todayInZone } from '../../domain/dates'
import { DEFAULT_TIME_ZONE } from '../../documents/format'
import { t } from '../../i18n/t'
import type { DocumentSummary, Tiyn } from '../../services'
import { documentBadge, type DocumentBadge } from '../clients/documentStatus'

/** Whole days an invoice is past its due date, counted in the company's calendar; 0 when it is not late. */
export function daysOverdue(dueDate: string | null, now: Date, timeZone = DEFAULT_TIME_ZONE): number {
  if (!dueDate) return 0
  return Math.max(daysBetween(dueDate, todayInZone(timeZone, now)), 0)
}

/** An invoice that has been issued and is not cancelled: only those have money to wait for. */
const isLive = (invoice: Pick<DocumentSummary, 'status'>): boolean => invoice.status !== 'draft' && invoice.status !== 'cancelled'

/** Money is still owed on it: issued, not cancelled, not paid in full. The strip adds these up and "unpaid" lists them. */
export function owesMoney(invoice: Pick<DocumentSummary, 'status' | 'payment'>): boolean {
  return isLive(invoice) && invoice.payment !== null && invoice.payment.state !== 'paid'
}

/**
 * How much of the invoice is paid, 0 to 100, for the bar and the badge. While a balance remains it is never shown as
 * 0 % or 100 %: 99,6 % paid is "99 %", and a first few tiyn are "1 %", so the words never contradict the money.
 */
export function percentPaid(invoice: Pick<DocumentSummary, 'grossTiyn' | 'payment'>): number {
  const payment = invoice.payment
  if (!payment || invoice.grossTiyn <= 0) return 0
  const exact = Math.round((payment.paidTiyn / invoice.grossTiyn) * 100)
  if (payment.paidTiyn <= 0) return 0
  return payment.balanceTiyn > 0 ? Math.min(Math.max(exact, 1), 99) : 100
}

/** A bar is shown while something is paid and something is still owed. */
export const isPartlyPaid = (invoice: Pick<DocumentSummary, 'status' | 'payment'>): boolean =>
  isLive(invoice) && (invoice.payment?.paidTiyn ?? 0) > 0 && (invoice.payment?.balanceTiyn ?? 0) > 0

/**
 * The badge of an invoice row: "Просрочен N дн." for a late one, "Оплачен на N%" for a partly paid one, and the shared
 * words for the rest. A draft or a cancelled invoice is never "late", whatever its due date says.
 */
export function invoiceBadge(invoice: DocumentSummary, now: Date, timeZone = DEFAULT_TIME_ZONE): DocumentBadge {
  if (!isLive(invoice)) return documentBadge(invoice)
  const state = invoice.payment?.state
  if (state === 'overdue') {
    // The state came with the data, the clock is the screen's: after midnight they can differ by a day, so never "0 дн.".
    return { label: t('il.badge.overdue', { days: Math.max(daysOverdue(invoice.dueDate, now, timeZone), 1) }), tone: 'danger' }
  }
  if (state === 'partial') return { label: t('docStatus.invoice.partial', { percent: percentPaid(invoice) }), tone: 'warning' }
  return documentBadge(invoice)
}

export interface Waiting {
  /** What clients still owe on unpaid, partly paid and overdue invoices. */
  waitingTiyn: Tiyn
  /** Of that, what is past its due date. */
  overdueTiyn: Tiyn
}

/** The summary strip: money that is owed, and the part of it that is late. Drafts and cancelled invoices owe nothing. */
export function waitingOf(invoices: readonly DocumentSummary[]): Waiting {
  let waitingTiyn = 0
  let overdueTiyn = 0
  for (const invoice of invoices) {
    const payment = invoice.payment
    if (!payment || !owesMoney(invoice)) continue
    waitingTiyn += payment.balanceTiyn
    if (payment.state === 'overdue') overdueTiyn += payment.balanceTiyn
  }
  return { waitingTiyn, overdueTiyn }
}

/** "до 24.10": the due date of a row, day and month. */
export function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}.${month}`
}
