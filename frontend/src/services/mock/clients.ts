// The mock ClientsService (#16), on the company-scoped store. Same rules as the API: search on `searchName`
// (casefold + ё → е, Kazakh letters kept), a client that has documents is archived instead of deleted, and
// another company's id is `not_found`.

import { normalizeBinIin, validateClient, type ClientDraft } from '../../domain/client'
import { searchKey } from '../../domain/searchKey'
import { t } from '../../i18n/t'
import type { ClientsService } from '../contracts'
import { ApiError } from '../errors'
import type {
  Client,
  ClientDetail,
  ClientInput,
  DocumentSummary,
  IsoDate,
  Page,
  PaymentState,
  PaymentSummary,
} from '../types'
import { newId } from './ids'
import type { MockRuntime } from './runtime'
import type { ScopedDb } from './scopedDb'
import type { StoredClient, StoredDocument } from './storeTypes'

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/** The stored client as the wire shape: every optional field present, nothing but what the type names. */
export function toClient(row: StoredClient): Client {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind,
    name: row.name,
    binIin: row.binIin ?? null,
    contactName: row.contactName ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    searchName: row.searchName,
    archivedAt: row.archivedAt ?? null,
  }
}

function validationError(fields: Record<string, string>): ApiError {
  return new ApiError({ code: 'validation_error', message: t('apiError.validation_error'), fields })
}

/** Throws `validation_error` with a Russian message per bad field when the client can't be saved. */
function assertValid(draft: ClientDraft): void {
  const errors = validateClient(draft)
  const fields = Object.entries(errors)
  if (fields.length > 0) throw validationError(Object.fromEntries(fields.map(([field, key]) => [field, t(key)])))
}

/** The fields as they are stored: trimmed, blank → null, ИИН/БИН without spaces. */
function normalized(input: ClientInput): Omit<StoredClient, 'id' | 'companyId' | 'searchName' | 'archivedAt'> {
  return {
    kind: input.kind,
    name: input.name.trim(),
    binIin: blankToNull(normalizeBinIin(input.binIin)),
    contactName: blankToNull(input.contactName),
    phone: blankToNull(input.phone),
    email: blankToNull(input.email),
    address: blankToNull(input.address),
    notes: blankToNull(input.notes),
  }
}

/** Today's date in the company's zone (AGENTS.md: dates in the company's zone). */
function todayIn(timezone: string, now: Date): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function paymentSummary(db: ScopedDb, doc: StoredDocument, today: IsoDate): PaymentSummary | null {
  if (doc.type !== 'invoice') return null
  const paidTiyn = db
    .rows('payments')
    .filter((payment) => payment.documentId === doc.id)
    .reduce((sum, payment) => sum + payment.amountTiyn, 0)
  const balanceTiyn = doc.grossTiyn - paidTiyn
  let state: PaymentState = 'unpaid'
  if (balanceTiyn <= 0) state = 'paid'
  else if (doc.dueDate !== null && doc.dueDate < today) state = 'overdue'
  else if (paidTiyn > 0) state = 'partial'
  return { state, paidTiyn, balanceTiyn }
}

/** The row of a document list. Documents (#18) build the same shape for their own list. */
function toSummary(db: ScopedDb, doc: StoredDocument, today: IsoDate): DocumentSummary {
  return {
    id: doc.id,
    companyId: doc.companyId,
    type: doc.type,
    status: doc.status,
    number: doc.number,
    issueDate: doc.issueDate,
    validUntil: doc.validUntil,
    dueDate: doc.dueDate,
    clientId: doc.clientId,
    clientName: doc.clientSnapshot.name,
    sourceDocumentId: doc.sourceDocumentId,
    currency: doc.currency,
    netTiyn: doc.netTiyn,
    vatTiyn: doc.vatTiyn,
    grossTiyn: doc.grossTiyn,
    version: doc.version,
    issuedAt: doc.issuedAt,
    signedAt: doc.signedAt,
    isExpired: doc.type === 'quote' && doc.status === 'sent' && doc.validUntil !== null && doc.validUntil < today,
    payment: paymentSummary(db, doc, today),
  }
}

function clampPage(limit: number | undefined, offset: number | undefined): { limit: number; offset: number } {
  const size = Number.isFinite(limit) ? Math.trunc(limit as number) : DEFAULT_PAGE_SIZE
  const start = Number.isFinite(offset) ? Math.trunc(offset as number) : 0
  return { limit: Math.min(Math.max(size, 1), MAX_PAGE_SIZE), offset: Math.max(start, 0) }
}

export function createMockClients(getRuntime: () => MockRuntime): ClientsService {
  return {
    list(params = {}) {
      const runtime = getRuntime()
      return runtime.call((): Page<Client> =>
        runtime.store.read((db) => {
          const query = searchKey(params.q ?? '').trim()
          const archived = params.archived === true
          const matches = db
            .rows('clients')
            .filter((row) => (row.archivedAt !== null) === archived)
            .filter((row) => query === '' || row.searchName.includes(query))
            .sort((a, b) => a.searchName.localeCompare(b.searchName, 'ru'))
          const { limit, offset } = clampPage(params.limit, params.offset)
          return { items: matches.slice(offset, offset + limit).map(toClient), total: matches.length }
        }),
      )
    },

    get(id) {
      const runtime = getRuntime()
      return runtime.call((): ClientDetail =>
        runtime.store.read((db) => {
          const row = db.get('clients', id)
          const today = todayIn(db.company().timezone, runtime.now())
          const documents = db
            .rows('documents')
            .filter((doc) => doc.clientId === id)
            // Newest first; the number breaks ties, a draft (no number) comes before a numbered document of its day.
            .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || (b.number ?? '￿').localeCompare(a.number ?? '￿'))
            .map((doc) => toSummary(db, doc, today))
          return { ...toClient(row), documents }
        }),
      )
    },

    create(input) {
      const runtime = getRuntime()
      return runtime.call((): Client => {
        assertValid(input)
        return runtime.store.write((db) => {
          const fields = normalized(input)
          return toClient(
            db.insert('clients', { id: newId(), ...fields, searchName: searchKey(fields.name), archivedAt: null }),
          )
        })
      })
    },

    update(id, patch) {
      const runtime = getRuntime()
      return runtime.call((): Client =>
        runtime.store.write((db) => {
          const current = toClient(db.get('clients', id))
          const given = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
          const merged: ClientInput = { ...current, ...given }
          assertValid(merged)
          const fields = normalized(merged)
          return toClient(db.patch('clients', id, { ...fields, searchName: searchKey(fields.name) }))
        }),
      )
    },

    remove(id) {
      const runtime = getRuntime()
      return runtime.call((): void =>
        runtime.store.write((db) => {
          const row = db.get('clients', id)
          // Documents are accounting records: their client is archived, never deleted (architecture, "Personal data").
          const hasDocuments = db.rows('documents').some((doc) => doc.clientId === id)
          if (hasDocuments) {
            if (row.archivedAt === null) db.patch('clients', id, { archivedAt: runtime.now().toISOString() })
          } else {
            db.remove('clients', id)
          }
        }),
      )
    },
  }
}
