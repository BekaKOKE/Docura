// Company-scoped access to the store (AGENTS.md rule 6: every query is scoped by the company, and another
// company's id is a 404). A `ScopedDb` is bound to one company; it has no method that reaches another
// company's rows, so a mock service cannot forget the filter.

import { t } from '../../i18n/t'
import { ApiError } from '../errors'
import type { DocumentType, Id } from '../types'
import type {
  DocumentCounter,
  RowOf,
  ScopedCollection,
  StoreData,
  StoredCompany,
} from './storeTypes'

interface ScopedRow {
  id: Id
  companyId: Id
}

export function notFound(): ApiError {
  return new ApiError({ code: 'not_found', message: t('apiError.not_found') })
}

export interface ScopedDb {
  readonly companyId: Id
  /** The company itself. */
  company(): StoredCompany
  /** Every row of this company in the collection, in store order. */
  rows<K extends ScopedCollection>(collection: K): RowOf<K>[]
  /** The row, or undefined when it doesn't exist or belongs to another company. */
  find<K extends ScopedCollection>(collection: K, id: Id): RowOf<K> | undefined
  /** The row, or `not_found` (404) when it doesn't exist or belongs to another company. */
  get<K extends ScopedCollection>(collection: K, id: Id): RowOf<K>
  /** Adds a row to this company; `companyId` is set here, never taken from the caller. */
  insert<K extends ScopedCollection>(collection: K, row: Omit<RowOf<K>, 'companyId'>): RowOf<K>
  /** Merges a patch into one of this company's rows (`not_found` otherwise). `id` and `companyId` can't change. */
  patch<K extends ScopedCollection>(
    collection: K,
    id: Id,
    patch: Partial<Omit<RowOf<K>, 'id' | 'companyId'>>,
  ): RowOf<K>
  /** Removes one of this company's rows (`not_found` otherwise). */
  remove<K extends ScopedCollection>(collection: K, id: Id): void
  /** The document number counters of this company. */
  counters(): DocumentCounter[]
  /** Sets the last number used for a type in a year (creates the counter on first use). */
  setCounter(type: DocumentType, year: number, lastNumber: number): void
}

/** Binds `data` to a company. `data` is the state being read or the draft being written. */
export function createScopedDb(data: StoreData, companyId: Id): ScopedDb {
  const table = <K extends ScopedCollection>(collection: K) => data[collection] as unknown as ScopedRow[]
  const ownedIndex = (collection: ScopedCollection, id: Id) =>
    table(collection).findIndex((row) => row.id === id && row.companyId === companyId)

  return {
    companyId,

    company() {
      const company = data.companies.find((c) => c.id === companyId)
      if (!company) throw notFound()
      return company
    },

    rows(collection) {
      return table(collection).filter((row) => row.companyId === companyId) as never
    },

    find(collection, id) {
      return table(collection)[ownedIndex(collection, id)] as never
    },

    get(collection, id) {
      const index = ownedIndex(collection, id)
      if (index < 0) throw notFound()
      return table(collection)[index] as never
    },

    insert(collection, row) {
      const rows = table(collection)
      const id = (row as { id: Id }).id
      // A repeated id would make two rows answer to one id: that is a bug in the caller, not an API error.
      if (rows.some((existing) => existing.id === id)) throw new Error(`mock store: duplicate id ${id} in ${collection}`)
      const stored = { ...row, companyId } as ScopedRow
      rows.push(stored)
      return stored as never
    },

    patch(collection, id, patch) {
      const rows = table(collection)
      const index = ownedIndex(collection, id)
      if (index < 0) throw notFound()
      const { id: _id, companyId: _companyId, ...fields } = patch as Record<string, unknown>
      rows[index] = { ...rows[index], ...fields }
      return rows[index] as never
    },

    remove(collection, id) {
      const index = ownedIndex(collection, id)
      if (index < 0) throw notFound()
      table(collection).splice(index, 1)
    },

    counters() {
      return data.documentCounters.filter((counter) => counter.companyId === companyId)
    },

    setCounter(type, year, lastNumber) {
      const counter = data.documentCounters.find(
        (c) => c.companyId === companyId && c.type === type && c.year === year,
      )
      if (counter) counter.lastNumber = lastNumber
      else data.documentCounters.push({ companyId, type, year, lastNumber })
    },
  }
}
