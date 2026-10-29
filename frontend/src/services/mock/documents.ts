// The mock DocumentsService for quotes (#18): create a draft, edit it (with the `version` check), issue it (number,
// snapshots, share link), delete a draft, list and read. It behaves like the backend (replica/architecture.md,
// "Domain rules"): totals are recomputed on every save from the lines with src/domain and whatever totals the client
// sent are ignored, a quote is editable while draft or sent and frozen after, "expired" is derived from `validUntil`
// in the company's time zone and never stored.
//
// `convert` makes an invoice from a signed quote (#27): the whole quote, a percent, an amount or the remainder,
// never more than the quote total in sum. The invoice is a draft or, with `issue: true`, issued at once (number,
// share link). The rest of the invoice lifecycle (update, issue, delete of an invoice draft) and the act come
// with #31.
//
// Not here, on purpose: cancel, duplicate and decline are post-MVP (docs/spec.md, D5); `convert` with
// `target: 'act'` is #31; signing the quote is `public.sign` (#24). `signatureBlob` only reads the image of a
// signature that already exists (the seed has some), so the quote's card (#22) can show it.

import { computePrepayment, computeTotals, formatMoney, searchKey, type VatSetting } from '../../domain'
import { t } from '../../i18n/t'
import type { DocumentsService } from '../contracts'
import { ApiError } from '../errors'
import { NotImplementedError } from '../notImplemented'
import type {
  ConvertInput,
  Document,
  DocumentInput,
  DocumentLine,
  DocumentLineInput,
  DocumentListParams,
  DocumentSummary,
  Id,
  InvoiceBasis,
  IsoDate,
  Page,
  PaymentSummary,
  SignatureSummary,
} from '../types'
import { newId, newToken } from './ids'
import { takeNextNumber } from './numbering'
import type { MockRuntime } from './runtime'
import { notFound, type ScopedDb } from './scopedDb'
import type { StoredClient, StoredCompany, StoredDocument, StoredDocumentLine } from './storeTypes'
import { addDays, isIsoDate, todayInZone, utcTimestamp } from './time'

/** The VAT rate copied onto every new document: 16 % (docs/spec.md, §6). */
export const VAT_RATE_BP = 1600
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

const TITLE_MAX = 500
const UNIT_MAX = 20
const SHARE_TOKEN_BYTES = 32 // 43 URL-safe characters, as secrets.token_urlsafe(32)

// ---------------------------------------------------------------- errors

function invalid(fields: Record<string, string>): ApiError {
  return new ApiError({ code: 'validation_error', message: t('apiError.validation_error'), fields })
}

function locked(): ApiError {
  return new ApiError({ code: 'document_locked', message: t('apiError.document_locked') })
}

function versionConflict(): ApiError {
  return new ApiError({ code: 'version_conflict', message: t('apiError.version_conflict') })
}

function notBuilt(method: string, issues: string): NotImplementedError {
  return new NotImplementedError('mock', `documents.${method}`, `built in ${issues}`)
}

// ---------------------------------------------------------------- snapshots

function snapshotOfClient(client: StoredClient): StoredDocument['clientSnapshot'] {
  return {
    kind: client.kind,
    name: client.name,
    binIin: client.binIin ?? null,
    contactName: client.contactName ?? null,
    phone: client.phone ?? null,
    email: client.email ?? null,
    address: client.address ?? null,
  }
}

function snapshotOfCompany(company: StoredCompany): StoredDocument['companySnapshot'] {
  return {
    legalForm: company.legalForm,
    legalName: company.legalName,
    binIin: company.binIin,
    address: company.address,
    phone: company.phone ?? null,
    email: company.email ?? null,
    directorName: company.directorName,
    directorPosition: company.directorPosition,
    vatPayer: company.vatPayer,
    vatCertificate: company.vatCertificate ?? null,
    bankName: company.bankName ?? null,
    iik: company.iik ?? null,
    bik: company.bik ?? null,
    kbe: company.kbe ?? null,
    defaultKnp: company.defaultKnp ?? null,
  }
}

// ---------------------------------------------------------------- input to stored rows

const trimmedOrNull = (value: string | null | undefined): string | null => {
  const text = (value ?? '').trim()
  return text === '' ? null : text
}

/** A line as the editor sent it, checked. Returns the message for the first thing wrong with it, per field. */
function lineProblems(line: DocumentLineInput, db: ScopedDb): Record<string, string> {
  const problems: Record<string, string> = {}
  if (line.kind !== 'service' && line.kind !== 'material') problems.kind = t('document.error.kindInvalid')
  const title = (line.title ?? '').trim()
  if (title === '') problems.title = t('document.error.titleRequired')
  else if (title.length > TITLE_MAX) problems.title = t('document.error.titleTooLong')
  const unit = (line.unit ?? '').trim()
  if (unit === '') problems.unit = t('document.error.unitRequired')
  else if (unit.length > UNIT_MAX) problems.unit = t('document.error.unitTooLong')
  if (!Number.isSafeInteger(line.qtyMilli) || line.qtyMilli <= 0) problems.qtyMilli = t('document.error.qtyInvalid')
  if (!Number.isSafeInteger(line.unitPriceTiyn) || line.unitPriceTiyn < 0) {
    problems.unitPriceTiyn = t('document.error.priceInvalid')
  }
  const discount = line.discountBp ?? 0
  if (!Number.isSafeInteger(discount) || discount < 0 || discount > 10000) {
    problems.discountBp = t('document.error.discountInvalid')
  }
  if (line.articleId && !db.find('articles', line.articleId)) problems.articleId = t('document.error.articleMissing')
  if (line.workDate != null && !isIsoDate(line.workDate)) problems.workDate = t('document.error.dateInvalid')
  return problems
}

/** What a save keeps of the editor's input, checked and normalised (`lines` still without totals). */
interface CheckedInput {
  issueDate: IsoDate
  validUntil: IsoDate | null
  contractRef: string | null
  notes: string | null
  terms: string | null
  vatEnabled: boolean
  lines: Omit<StoredDocumentLine, 'netTiyn' | 'vatTiyn' | 'grossTiyn'>[]
}

function checkInput(db: ScopedDb, input: DocumentInput, today: IsoDate, quoteValidityDays: number): CheckedInput {
  const fields: Record<string, string> = {}
  if (input.type !== 'quote') fields.type = t('document.error.typeNotQuote')

  const issueDate = input.issueDate ?? today
  if (!isIsoDate(issueDate)) fields.issueDate = t('document.error.dateInvalid')
  let validUntil: IsoDate | null = null
  if (input.validUntil === undefined) {
    // Not given: the company's default validity, counted from the issue date.
    if (isIsoDate(issueDate)) validUntil = addDays(issueDate, quoteValidityDays)
  } else if (input.validUntil !== null) {
    if (!isIsoDate(input.validUntil)) fields.validUntil = t('document.error.dateInvalid')
    else if (isIsoDate(issueDate) && input.validUntil < issueDate) {
      fields.validUntil = t('document.error.validUntilBeforeIssue')
    } else validUntil = input.validUntil
  }

  const rawLines = Array.isArray(input.lines) ? input.lines : []
  rawLines.forEach((line, index) => {
    for (const [field, message] of Object.entries(lineProblems(line, db))) fields[`lines.${index}.${field}`] = message
  })

  if (Object.keys(fields).length > 0) throw invalid(fields)

  return {
    issueDate,
    validUntil,
    contractRef: trimmedOrNull(input.contractRef),
    notes: trimmedOrNull(input.notes),
    terms: trimmedOrNull(input.terms),
    vatEnabled: input.vatEnabled === true,
    lines: rawLines.map((line, position) => ({
      id: newId(),
      position,
      articleId: line.articleId ?? null,
      kind: line.kind,
      title: line.title.trim(),
      description: trimmedOrNull(line.description),
      unit: line.unit.trim(),
      qtyMilli: line.qtyMilli,
      unitPriceTiyn: line.unitPriceTiyn,
      discountBp: line.discountBp ?? 0,
      workDate: null,
    })),
  }
}

interface Totals {
  lines: StoredDocumentLine[]
  netTiyn: number
  vatTiyn: number
  grossTiyn: number
}

/** The server side of the money: every line and the document total from quantity, price and the VAT setting. */
function withTotals(lines: CheckedInput['lines'], vat: VatSetting): Totals {
  try {
    const totals = computeTotals(lines, vat)
    return {
      lines: lines.map((line, index) => ({ ...line, ...totals.lines[index]! })),
      netTiyn: totals.netTiyn,
      vatTiyn: totals.vatTiyn,
      grossTiyn: totals.grossTiyn,
    }
  } catch (error) {
    if (error instanceof RangeError) throw invalid({ lines: t('document.error.amountTooLarge') })
    throw error
  }
}

/** The public link of a document that has just been issued. */
function addShareLink(db: ScopedDb, documentId: Id, createdAt: string): void {
  db.insert('shareLinks', {
    id: newId(),
    documentId,
    token: newToken(SHARE_TOKEN_BYTES),
    expiresAt: null,
    revokedAt: null,
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    createdAt,
  })
}

// ---------------------------------------------------------------- converting a quote into an invoice

/** `2026-10-20` as `20.10.2026`, the way a document refers to another one. */
function ruDate(date: IsoDate): string {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

/** Basis points as a percent in words: 5000 is "50", 1250 is "12,5", 3333 is "33,33". */
function percentText(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100)
  const fraction = String(basisPoints % 100).padStart(2, '0').replace(/0+$/, '')
  return fraction === '' ? String(whole) : `${whole},${fraction}`
}

/** What the invoice is for, after the checks: lines copied from the quote, or one prepayment line. */
interface InvoicePlan {
  basis: InvoiceBasis
  basisValue: number | null
  lines: StoredDocumentLine[]
  netTiyn: number
  vatTiyn: number
  grossTiyn: number
}

function exceedsQuoteTotal(availableTiyn: number): ApiError {
  return new ApiError({
    code: 'exceeds_quote_total',
    message: t('invoice.error.exceedsQuoteTotal', { amount: formatMoney(Math.max(availableTiyn, 0)) }),
  })
}

/** Checks `basis` and `basisValue` of an invoice conversion and works out the lines. Throws before anything is written. */
function planInvoice(
  input: Extract<ConvertInput, { target: 'invoice' }>,
  quote: StoredDocument,
  invoicedTiyn: number,
): InvoicePlan {
  const availableTiyn = quote.grossTiyn - invoicedTiyn
  const { basis } = input
  if (basis !== 'full' && basis !== 'percent' && basis !== 'amount' && basis !== 'remaining') {
    throw invalid({ basis: t('invoice.error.basisInvalid') })
  }

  if (basis === 'full') {
    // The whole quote is only possible while nothing else was invoiced from it.
    if (invoicedTiyn > 0 || availableTiyn <= 0) throw exceedsQuoteTotal(availableTiyn)
    return {
      basis,
      basisValue: null,
      lines: quote.lines.map(({ qtyText: _qtyText, ...line }, position) => ({ ...line, id: newId(), position })),
      netTiyn: quote.netTiyn,
      vatTiyn: quote.vatTiyn,
      grossTiyn: quote.grossTiyn,
    }
  }

  const value = (input as { basisValue?: unknown }).basisValue
  if (basis === 'percent') {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 10000) {
      throw invalid({ basisValue: t('invoice.error.percentInvalid') })
    }
  } else if (basis === 'amount') {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
      throw invalid({ basisValue: t('invoice.error.amountInvalid') })
    }
  }

  const vat: VatSetting = { vatEnabled: quote.vatEnabled && quote.companySnapshot.vatPayer, vatRateBp: quote.vatRateBp }
  const prepayment = computePrepayment({
    ...vat,
    ...(basis === 'remaining' ? { basis } : { basis, basisValue: value as number }),
    quoteGrossTiyn: quote.grossTiyn,
    alreadyInvoicedTiyn: invoicedTiyn,
  })
  if ('error' in prepayment) {
    if (prepayment.error === 'exceeds_quote_total') throw exceedsQuoteTotal(availableTiyn)
    // A percent so small that it rounds to nothing.
    throw invalid({ basisValue: t(basis === 'percent' ? 'invoice.error.percentInvalid' : 'invoice.error.amountInvalid') })
  }

  const quoteRef = { number: quote.number ?? '', date: ruDate(quote.issueDate) }
  const title =
    basis === 'percent'
      ? t('invoice.line.percent', { ...quoteRef, percent: percentText(value as number) })
      : t(basis === 'amount' ? 'invoice.line.amount' : 'invoice.line.remaining', quoteRef)
  // The line holds the net amount as its price, as the seed's prepayment invoices do; the VAT is inside the gross.
  const { netTiyn, vatTiyn, grossTiyn } = prepayment
  return {
    basis,
    basisValue: basis === 'remaining' ? null : (value as number),
    lines: [
      {
        id: newId(),
        position: 0,
        articleId: null,
        kind: 'service',
        title,
        description: null,
        unit: t('invoice.line.unit'),
        qtyMilli: 1000,
        unitPriceTiyn: netTiyn,
        discountBp: 0,
        netTiyn,
        vatTiyn,
        grossTiyn,
        workDate: null,
      },
    ],
    netTiyn,
    vatTiyn,
    grossTiyn,
  }
}

// ---------------------------------------------------------------- stored rows to the wire shapes

interface View {
  summary(row: StoredDocument): DocumentSummary
  document(row: StoredDocument): Document
}

function paymentSummary(db: ScopedDb, row: StoredDocument, today: IsoDate): PaymentSummary | null {
  if (row.type !== 'invoice') return null
  const paidTiyn = db.rows('payments').filter((p) => p.documentId === row.id).reduce((sum, p) => sum + p.amountTiyn, 0)
  const balanceTiyn = row.grossTiyn - paidTiyn
  const pastDue = row.dueDate !== null && row.dueDate < today
  const state = balanceTiyn <= 0 ? 'paid' : pastDue ? 'overdue' : paidTiyn > 0 ? 'partial' : 'unpaid'
  return { state, paidTiyn, balanceTiyn }
}

function createView(db: ScopedDb, now: Date): View {
  const today = todayInZone(db.company().timezone, now)

  const summary = (row: StoredDocument): DocumentSummary => ({
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
    // Derived on every read; the stored status stays `sent`.
    isExpired: row.type === 'quote' && row.status === 'sent' && row.validUntil !== null && row.validUntil < today,
    payment: paymentSummary(db, row, today),
  })

  const document = (row: StoredDocument): Document => {
    const link = db
      .rows('shareLinks')
      .filter((l) => l.documentId === row.id && l.revokedAt === null)
      .at(-1)
    const signature = db.rows('signatures').find((s) => s.documentId === row.id)
    const signatureSummary: SignatureSummary | null = signature
      ? {
          method: signature.method,
          signerName: signature.signerName,
          signedAt: signature.signedAt,
          documentVersion: signature.documentVersion,
        }
      : null
    const lines: DocumentLine[] = row.lines.map(({ qtyText: _qtyText, ...line }) => line)
    return {
      ...summary(row),
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      contractRef: row.contractRef,
      clientSnapshot: row.clientSnapshot,
      companySnapshot: row.companySnapshot,
      basis: row.basis,
      basisValue: row.basisValue,
      vatEnabled: row.vatEnabled,
      vatRateBp: row.vatRateBp,
      notes: row.notes,
      terms: row.terms,
      cancelledAt: row.cancelledAt,
      lines,
      shareUrl: link ? `${publicBaseUrl()}/p/${link.token}` : null,
      signature: signatureSummary,
      children: db
        .rows('documents')
        .filter((d) => d.sourceDocumentId === row.id)
        .map(summary),
    }
  }

  return { summary, document }
}

/** Where public links point: the page the app runs on (`PUBLIC_BASE_URL` on the real backend). */
function publicBaseUrl(): string {
  return globalThis.location?.origin ?? 'http://localhost:5173'
}

// ---------------------------------------------------------------- the service

export function createMockDocuments(getRuntime: () => MockRuntime): DocumentsService {
  /** Runs `fn` against the signed-in company's data, after the mock latency; `fn` may change data. */
  function write<T>(fn: (db: ScopedDb, view: View, now: Date) => T): Promise<T> {
    const runtime = getRuntime()
    return runtime.call(() =>
      runtime.store.write((db) => {
        const now = runtime.now()
        return fn(db, createView(db, now), now)
      }),
    )
  }

  function read<T>(fn: (db: ScopedDb, view: View, now: Date) => T): Promise<T> {
    const runtime = getRuntime()
    return runtime.call(() =>
      runtime.store.read((db) => {
        const now = runtime.now()
        return fn(db, createView(db, now), now)
      }),
    )
  }

  /**
   * The row to edit or delete. `document_locked` unless it is a quote still in draft or sent (invoices and acts are
   * editable only as drafts, and their lifecycle is built in #27 and #31).
   */
  function editable(db: ScopedDb, id: Id, method: string): StoredDocument {
    const row = db.get('documents', id)
    const open = row.type === 'quote' ? row.status === 'draft' || row.status === 'sent' : row.status === 'draft'
    if (!open) throw locked()
    if (row.type !== 'quote') throw notBuilt(method, 'the issues of invoices and acts (#27, #31)')
    return row
  }

  return {
    list(params: DocumentListParams = {}): Promise<Page<DocumentSummary>> {
      return read((db, view) => {
        const query = searchKey((params.q ?? '').trim())
        const rows = db.rows('documents').map((row, order) => ({ row, order, summary: view.summary(row) }))
        const matches = rows.filter(({ summary }) => {
          if (params.type && summary.type !== params.type) return false
          if (params.status && summary.status !== params.status) return false
          if (params.clientId && summary.clientId !== params.clientId) return false
          if (params.paymentState && summary.payment?.state !== params.paymentState) return false
          if (params.from && summary.issueDate < params.from) return false
          if (params.to && summary.issueDate > params.to) return false
          if (query !== '' && !searchKey(`${summary.number ?? ''} ${summary.clientName}`).includes(query)) return false
          return true
        })
        // Newest first: by issue date, and among the same day the one created last.
        matches.sort((a, b) => (a.summary.issueDate === b.summary.issueDate ? b.order - a.order : a.summary.issueDate < b.summary.issueDate ? 1 : -1))
        const limit = Math.min(Math.max(Math.trunc(params.limit ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE)
        const offset = Math.max(Math.trunc(params.offset ?? 0), 0)
        return { items: matches.slice(offset, offset + limit).map(({ summary }) => summary), total: matches.length }
      })
    },

    get(id) {
      return read((db, view) => view.document(db.get('documents', id)))
    },

    create(input) {
      return write((db, view, now) => {
        // A replay of the same request returns the document it made.
        if (input.clientRequestId) {
          const existing = db.rows('documents').find((d) => d.clientRequestId === input.clientRequestId)
          if (existing) return view.document(existing)
        }
        const company = db.company()
        const today = todayInZone(company.timezone, now)
        const checked = checkInput(db, input, today, company.quoteValidityDays)
        const client = db.get('clients', input.clientId)
        const vat: VatSetting = { vatEnabled: company.vatPayer && checked.vatEnabled, vatRateBp: VAT_RATE_BP }
        const totals = withTotals(checked.lines, vat)
        const row = db.insert('documents', {
          id: newId(),
          type: 'quote',
          status: 'draft',
          number: null,
          issueDate: checked.issueDate,
          validUntil: checked.validUntil,
          dueDate: null,
          periodFrom: null,
          periodTo: null,
          contractRef: checked.contractRef,
          clientId: client.id,
          clientSnapshot: snapshotOfClient(client),
          companySnapshot: snapshotOfCompany(company),
          sourceDocumentId: null,
          currency: 'KZT',
          netTiyn: totals.netTiyn,
          vatTiyn: totals.vatTiyn,
          grossTiyn: totals.grossTiyn,
          version: 1,
          issuedAt: null,
          signedAt: null,
          cancelledAt: null,
          basis: null,
          basisValue: null,
          vatEnabled: vat.vatEnabled,
          vatRateBp: vat.vatRateBp,
          notes: checked.notes,
          terms: checked.terms,
          lines: totals.lines,
          clientRequestId: input.clientRequestId ?? null,
        })
        return view.document(row)
      })
    },

    update(id, input) {
      return write((db, view, now) => {
        const row = editable(db, id, 'update')
        if (!Number.isSafeInteger(input.version)) throw invalid({ version: t('document.error.versionInvalid') })
        if (input.version !== row.version) throw versionConflict()

        const company = db.company()
        const today = todayInZone(company.timezone, now)
        const checked = checkInput(db, input, today, company.quoteValidityDays)

        // A draft takes the current requisites on every save. After issue they are frozen, the VAT payer status
        // included, and the client can't be swapped.
        const isDraft = row.status === 'draft'
        if (!isDraft && input.clientId !== row.clientId) throw invalid({ clientId: t('document.error.clientLocked') })
        if (!isDraft && checked.lines.length === 0) throw invalid({ lines: t('document.error.linesRequired') })
        const client = isDraft ? db.get('clients', input.clientId) : undefined
        const vatPayer = isDraft ? company.vatPayer : row.companySnapshot.vatPayer
        const vat: VatSetting = { vatEnabled: vatPayer && checked.vatEnabled, vatRateBp: row.vatRateBp }
        const totals = withTotals(checked.lines, vat)

        const saved = db.patch('documents', id, {
          ...(client ? { clientId: client.id, clientSnapshot: snapshotOfClient(client), companySnapshot: snapshotOfCompany(company) } : {}),
          issueDate: checked.issueDate,
          validUntil: checked.validUntil,
          contractRef: checked.contractRef,
          notes: checked.notes,
          terms: checked.terms,
          vatEnabled: vat.vatEnabled,
          netTiyn: totals.netTiyn,
          vatTiyn: totals.vatTiyn,
          grossTiyn: totals.grossTiyn,
          lines: totals.lines,
          version: row.version + 1,
        })
        return view.document(saved)
      })
    },

    remove(id) {
      return write((db) => {
        const row = db.get('documents', id)
        if (row.status !== 'draft') throw locked()
        if (row.type !== 'quote') throw notBuilt('remove', 'the issues of invoices and acts (#27, #31)')
        db.remove('documents', id)
      })
    },

    issue(id) {
      return write((db, view, now) => {
        const row = db.get('documents', id)
        if (row.status !== 'draft') throw locked()
        if (row.type !== 'quote') throw notBuilt('issue', 'the issues of invoices and acts (#27, #31)')
        if (row.lines.length === 0) throw invalid({ lines: t('document.error.linesRequired') })
        const client = db.find('clients', row.clientId)
        if (!client) throw invalid({ clientId: t('document.error.clientMissing') })

        // The requisites as they are now, frozen from here on (they change nothing for this quote afterwards).
        const company = db.company()
        const vat: VatSetting = { vatEnabled: company.vatPayer && row.vatEnabled, vatRateBp: row.vatRateBp }
        const totals = withTotals(row.lines, vat)
        const number = takeNextNumber(db, 'quote', row.issueDate)
        const issuedAt = utcTimestamp(now)

        addShareLink(db, row.id, issuedAt)
        const saved = db.patch('documents', id, {
          status: 'sent',
          number,
          issuedAt,
          clientSnapshot: snapshotOfClient(client),
          companySnapshot: snapshotOfCompany(company),
          vatEnabled: vat.vatEnabled,
          netTiyn: totals.netTiyn,
          vatTiyn: totals.vatTiyn,
          grossTiyn: totals.grossTiyn,
          lines: totals.lines,
          version: row.version + 1,
        })
        return view.document(saved)
      })
    },

    convert(id, input) {
      // The act is #31.
      if (input.target !== 'invoice') return Promise.reject(notBuilt('convert', 'the act (#31)'))
      return write((db, view, now) => {
        // A replay of the same request returns the document it made.
        if (input.clientRequestId) {
          const existing = db.rows('documents').find((d) => d.clientRequestId === input.clientRequestId)
          if (existing) return view.document(existing)
        }
        const quote = db.get('documents', id)
        if (quote.type !== 'quote' || quote.status !== 'signed') throw locked()

        const invoiced = db
          .rows('documents')
          .filter((d) => d.sourceDocumentId === quote.id && d.type === 'invoice' && d.status !== 'cancelled')
          .reduce((sum, d) => sum + d.grossTiyn, 0)
        // Every check happens before a number is taken, so a refused conversion leaves no gap.
        const plan = planInvoice(input, quote, invoiced)

        const company = db.company()
        const issueDate = todayInZone(company.timezone, now)
        const issueNow = input.issue === true
        const issuedAt = issueNow ? utcTimestamp(now) : null
        const row = db.insert('documents', {
          id: newId(),
          type: 'invoice',
          status: issueNow ? 'issued' : 'draft',
          number: issueNow ? takeNextNumber(db, 'invoice', issueDate) : null,
          issueDate,
          validUntil: null,
          dueDate: addDays(issueDate, company.invoiceDueDays),
          periodFrom: null,
          periodTo: null,
          contractRef: t('invoice.contractRef', { number: quote.number ?? '', date: ruDate(quote.issueDate) }),
          clientId: quote.clientId,
          // The client as the quote was issued; the company as it is now.
          clientSnapshot: structuredClone(quote.clientSnapshot),
          companySnapshot: snapshotOfCompany(company),
          sourceDocumentId: quote.id,
          currency: quote.currency,
          netTiyn: plan.netTiyn,
          vatTiyn: plan.vatTiyn,
          grossTiyn: plan.grossTiyn,
          version: 1,
          issuedAt,
          signedAt: null,
          cancelledAt: null,
          basis: plan.basis,
          basisValue: plan.basisValue,
          vatEnabled: quote.vatEnabled,
          vatRateBp: quote.vatRateBp,
          notes: null,
          terms: null,
          lines: plan.lines,
          clientRequestId: input.clientRequestId ?? null,
        })
        if (issuedAt) addShareLink(db, row.id, issuedAt)
        return view.document(row)
      })
    },

    signatureBlob(id) {
      return read((db) => {
        // The document is looked up first: another company's id is a 404 like any other (company scope in the data layer).
        const row = db.get('documents', id)
        const signature = db.rows('signatures').find((s) => s.documentId === row.id)
        if (!signature?.imagePngBase64) throw notFound()
        const bytes = Uint8Array.from(atob(signature.imagePngBase64), (char) => char.charCodeAt(0))
        return new Blob([bytes], { type: 'image/png' })
      })
    },
  }
}
