// Document numbers: `КП-2026-0001`, `СЧ-2026-0001`, `АВР-2026-0001`, per company, type and year of the issue date
// (replica/architecture.md, "Numbering"). A number is taken only when a document leaves draft, from the counter
// row in the same write, so a draft that is deleted or never issued never uses one up and there are no gaps.

import type { DocumentType, IsoDate } from '../types'
import type { ScopedDb } from './scopedDb'

export const NUMBER_PREFIX: Record<DocumentType, string> = {
  quote: 'КП',
  invoice: 'СЧ',
  act: 'АВР',
}

export function formatDocumentNumber(type: DocumentType, year: number, sequence: number): string {
  return `${NUMBER_PREFIX[type]}-${year}-${String(sequence).padStart(4, '0')}`
}

/** The year of a `YYYY-MM-DD` day. */
export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4))
}

/**
 * Takes the next number for the type in the year of `issueDate` and moves the counter on. Call it inside the
 * `store.write` that issues the document: if that write fails, the counter move is dropped with it.
 */
export function takeNextNumber(db: ScopedDb, type: DocumentType, issueDate: IsoDate): string {
  const year = yearOf(issueDate)
  const last = db.counters().find((counter) => counter.type === type && counter.year === year)?.lastNumber ?? 0
  db.setCounter(type, year, last + 1)
  return formatDocumentNumber(type, year, last + 1)
}
