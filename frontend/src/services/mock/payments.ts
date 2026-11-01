// The mock PaymentsService (#28 lists, #30 records and removes). A payment is recorded by hand against an issued invoice:
// the amount is whole tiyn above zero and never takes the paid total above the invoice total; the same
// `clientRequestId` twice is one payment (a double tap, a lost answer); a removed payment is gone from the sum, so the
// invoice's state (unpaid, partial, paid, overdue) is derived again on the next read. Every row is reached through the
// company-scoped db, so another company's invoice or payment is a 404.

import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import type { PaymentsService } from '../contracts'
import { ApiError } from '../errors'
import type { Payment, PaymentMethod, PaymentResult, PaymentState } from '../types'
import { newId } from './ids'
import type { MockRuntime } from './runtime'
import type { ScopedDb } from './scopedDb'
import type { StoredDocument } from './storeTypes'
import { isIsoDate, todayInZone } from './time'

const METHODS: readonly PaymentMethod[] = ['cash', 'kaspi', 'transfer', 'card', 'other']
const NOTE_MAX = 500

/** A stored payment also remembers the key it was recorded with. The wire shape (`Payment`) does not have it. */
type KeyedPayment = Payment & { clientRequestId?: string | null }

function toWire(row: KeyedPayment): Payment {
  const { clientRequestId: _key, ...payment } = row
  return payment
}

function invalid(fields: Record<string, string>): ApiError {
  return new ApiError({ code: 'validation_error', message: t('apiError.validation_error'), fields })
}

function locked(): ApiError {
  return new ApiError({ code: 'document_locked', message: t('pm.error.invoiceOnly') })
}

function overpayment(overTiyn: number): ApiError {
  return new ApiError({ code: 'overpayment', message: t('pm.error.overpayment', { amount: formatMoney(overTiyn) }) })
}

/** What the invoice is paid and owed, and the state they make; the same rule as `documents` uses for its `payment` summary. */
function stateOf(db: ScopedDb, invoice: StoredDocument, now: Date): { state: PaymentState; balanceTiyn: number } {
  const paidTiyn = db.rows('payments').filter((p) => p.documentId === invoice.id).reduce((sum, p) => sum + p.amountTiyn, 0)
  const balanceTiyn = invoice.grossTiyn - paidTiyn
  const pastDue = invoice.dueDate !== null && invoice.dueDate < todayInZone(db.company().timezone, now)
  const state = balanceTiyn <= 0 ? 'paid' : pastDue ? 'overdue' : paidTiyn > 0 ? 'partial' : 'unpaid'
  return { state, balanceTiyn }
}

export function createMockPayments(getRuntime: () => MockRuntime): PaymentsService {
  return {
    list(documentId) {
      const runtime = getRuntime()
      return runtime.call(() =>
        runtime.store.read((db): Payment[] => {
          // The invoice is looked up first: another company's id is a 404 like any other (company scope in the data layer).
          const document = db.get('documents', documentId)
          return db
            .rows('payments')
            .filter((payment) => payment.documentId === document.id)
            .map((payment, order) => ({ payment, order }))
            .sort((a, b) => (a.payment.paidOn === b.payment.paidOn ? a.order - b.order : a.payment.paidOn < b.payment.paidOn ? -1 : 1))
            .map(({ payment }) => toWire(payment))
        }),
      )
    },

    create(documentId, input) {
      const runtime = getRuntime()
      return runtime.call(() =>
        runtime.store.write((db): PaymentResult => {
          const invoice = db.get('documents', documentId)
          const now = runtime.now()

          // A repeated key is the same request: the payment that already exists, with the invoice as it is now.
          const key = input.clientRequestId
          if (key) {
            const existing = (db.rows('payments') as KeyedPayment[]).find((p) => p.documentId === invoice.id && p.clientRequestId === key)
            if (existing) {
              const { state, balanceTiyn } = stateOf(db, invoice, now)
              return { payment: toWire(existing), paymentState: state, balanceTiyn }
            }
          }

          // Only an issued invoice has money to wait for: not a draft, a cancelled one, or a quote.
          if (invoice.type !== 'invoice' || invoice.status !== 'issued') throw locked()

          const fields: Record<string, string> = {}
          const amount = input.amountTiyn
          // Whole tiyn above zero (money is never a float, domain/money.ts).
          if (!Number.isSafeInteger(amount) || amount <= 0) fields.amountTiyn = t('pm.error.amountRequired')
          if (!METHODS.includes(input.method)) fields.method = t('pm.error.method')
          if (!isIsoDate(input.paidOn)) fields.paidOn = t('pm.error.date')
          const note = (input.note ?? '').trim()
          if (note.length > NOTE_MAX) fields.note = t('pm.error.noteTooLong')
          if (Object.keys(fields).length > 0) throw invalid(fields)

          const before = stateOf(db, invoice, now)
          if (amount > before.balanceTiyn) throw overpayment(amount - before.balanceTiyn)

          const row: KeyedPayment = {
            id: newId(),
            companyId: db.companyId,
            documentId: invoice.id,
            amountTiyn: amount,
            currency: invoice.currency,
            method: input.method,
            paidOn: input.paidOn,
            note: note === '' ? null : note,
            clientRequestId: key || null,
          }
          const { companyId: _companyId, ...fresh } = row
          const saved = db.insert('payments', fresh)

          const after = stateOf(db, invoice, now)
          return { payment: toWire(saved), paymentState: after.state, balanceTiyn: after.balanceTiyn }
        }),
      )
    },

    remove(paymentId) {
      const runtime = getRuntime()
      return runtime.call(() =>
        runtime.store.write((db) => {
          // Another company's payment is not found, and so is one that is already gone.
          db.get('payments', paymentId)
          db.remove('payments', paymentId)
        }),
      )
    },
  }
}
