// The mock DashboardService (#32): the numbers of the Главная screen, worked out from the store for the signed-in
// company. Money is integer tiyn and every date is a calendar day in the company's time zone.
//
// The period is `from`..`to` inclusive; it defaults to the current month. What counts in it:
//   cashedTiyn      payments by `paidOn`.
//   invoicedTiyn    invoices issued (not draft, not cancelled) by `issueDate`.
//   signed          quotes signed in the period, by the day of `signedAt`.
//   awaitingSignature  quotes still `sent`, issued in the period. With `signed` it gives the "N of M" tile: M is every
//                   quote that was sent in the period or signed in it, and N <= M always holds.
//   acceptanceRate  signed / (signed + declined in the period); null when nothing was decided.
//   outstanding     issued, not cancelled invoices with money still owed, as of today (not period-bound), with the
//                   overdue part: due date before today.
//   toInvoice       signed quotes with money left to invoice, as of today (not period-bound), newest first, top 5.
// `recentEvents` is post-MVP (the issue leaves it out), so it is always empty here.

import { addDays, todayInZone } from '../../domain/dates'
import { t } from '../../i18n/t'
import type { DashboardService } from '../contracts'
import { ApiError } from '../errors'
import type { Dashboard, DashboardParams, DocumentSummary, IsoDate } from '../types'
import type { MockRuntime } from './runtime'
import type { ScopedDb } from './scopedDb'
import type { StoredDocument } from './storeTypes'

export const TO_INVOICE_LIMIT = 5

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function invalid(fields: Record<string, string>): ApiError {
  return new ApiError({ code: 'validation_error', message: t('apiError.validation_error'), fields })
}

function isDay(value: unknown): value is IsoDate {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const firstOfMonth = (day: IsoDate): IsoDate => `${day.slice(0, 7)}-01`

const lastOfMonth = (day: IsoDate): IsoDate => {
  const [year, month] = day.split('-').map(Number) as [number, number]
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return addDays(next, -1)
}

/** The period asked for; each end that is missing is the edge of the month of the other end, or of today. */
function periodOf(params: DashboardParams, today: IsoDate): { from: IsoDate; to: IsoDate } {
  const fields: Record<string, string> = {}
  if (params.from !== undefined && !isDay(params.from)) fields.from = t('document.error.dateInvalid')
  if (params.to !== undefined && !isDay(params.to)) fields.to = t('document.error.dateInvalid')
  if (Object.keys(fields).length > 0) throw invalid(fields)

  const from = params.from ?? firstOfMonth(params.to ?? today)
  const to = params.to ?? lastOfMonth(params.from ?? today)
  if (from > to) throw invalid({ to: t('db.error.periodReversed') })
  return { from, to }
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)

/** A signed quote as the list rows show it (a quote has no payment state and is never "expired" once signed). */
function summaryOfQuote(row: StoredDocument): DocumentSummary {
  return {
    id: row.id,
    companyId: row.companyId,
    type: row.type,
    status: row.status,
    number: row.number,
    issueDate: row.issueDate,
    validUntil: row.validUntil,
    dueDate: row.dueDate,
    clientId: row.clientId,
    clientName: row.clientSnapshot.name,
    sourceDocumentId: row.sourceDocumentId,
    currency: row.currency,
    netTiyn: row.netTiyn,
    vatTiyn: row.vatTiyn,
    grossTiyn: row.grossTiyn,
    version: row.version,
    issuedAt: row.issuedAt,
    signedAt: row.signedAt,
    isExpired: false,
    payment: null,
  }
}

function compute(db: ScopedDb, now: Date, params: DashboardParams): Dashboard {
  const zone = db.company().timezone
  const today = todayInZone(zone, now)
  const { from, to } = periodOf(params, today)
  const within = (day: IsoDate | null | undefined) => day != null && day >= from && day <= to

  const documents = db.rows('documents')
  const payments = db.rows('payments')
  const quotes = documents.filter((d) => d.type === 'quote')
  const invoices = documents.filter((d) => d.type === 'invoice')
  // A draft has no number and no meaning for the owner's money yet; a cancelled invoice is not owed.
  const live = invoices.filter((d) => d.status !== 'draft' && d.status !== 'cancelled')

  const cashedTiyn = sum(payments.filter((p) => within(p.paidOn)).map((p) => p.amountTiyn))
  const invoicedTiyn = sum(live.filter((d) => within(d.issueDate)).map((d) => d.grossTiyn))

  const signedQuotes = quotes.filter(
    (d) => d.status === 'signed' && d.signedAt !== null && within(todayInZone(zone, new Date(d.signedAt))),
  )
  const awaiting = quotes.filter((d) => d.status === 'sent' && within(d.issueDate))
  const declined = quotes.filter((d) => d.status === 'declined' && within(d.issueDate))
  const decided = signedQuotes.length + declined.length

  const owed = live
    .map((invoice) => {
      const paid = sum(payments.filter((p) => p.documentId === invoice.id).map((p) => p.amountTiyn))
      return { invoice, balanceTiyn: invoice.grossTiyn - paid }
    })
    .filter(({ balanceTiyn }) => balanceTiyn > 0)
  const overdue = owed.filter(({ invoice }) => invoice.dueDate !== null && invoice.dueDate < today)

  const toInvoice = quotes
    .map((quote, order) => ({ quote, order }))
    .filter(({ quote }) => {
      if (quote.status !== 'signed') return false
      // Every invoice made from the quote that is not cancelled (a draft too) already claims its share of the total.
      const invoiced = sum(
        invoices.filter((d) => d.sourceDocumentId === quote.id && d.status !== 'cancelled').map((d) => d.grossTiyn),
      )
      return invoiced < quote.grossTiyn
    })
    .sort((a, b) =>
      a.quote.issueDate === b.quote.issueDate ? b.order - a.order : a.quote.issueDate < b.quote.issueDate ? 1 : -1,
    )
    .slice(0, TO_INVOICE_LIMIT)
    .map(({ quote }) => summaryOfQuote(quote))

  return {
    from,
    to,
    awaitingSignature: { count: awaiting.length, grossTiyn: sum(awaiting.map((d) => d.grossTiyn)) },
    signed: { count: signedQuotes.length, grossTiyn: sum(signedQuotes.map((d) => d.grossTiyn)) },
    acceptanceRate: decided === 0 ? null : signedQuotes.length / decided,
    invoicedTiyn,
    cashedTiyn,
    outstanding: {
      count: owed.length,
      balanceTiyn: sum(owed.map((o) => o.balanceTiyn)),
      overdue: { count: overdue.length, balanceTiyn: sum(overdue.map((o) => o.balanceTiyn)) },
    },
    toInvoice,
    recentEvents: [],
  }
}

export function createMockDashboard(getRuntime: () => MockRuntime): DashboardService {
  return {
    get(params: DashboardParams = {}) {
      const runtime = getRuntime()
      return runtime.call(() => runtime.store.read((db) => compute(db, runtime.now(), params)))
    },
  }
}
