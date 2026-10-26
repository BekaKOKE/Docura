// The totals a document prints. Saved totals are used as they are (a prepayment invoice splits VAT out of a gross
// amount, so recomputing it from the line could differ by a tiyn); a draft from the editor has none, so they are
// computed with src/domain, exactly as the editor does. Money never goes through floating point here.

import { computeTotals, type LineTotals } from '../domain'
import type { RenderableDocument, RenderableLine } from './model'

export interface ResolvedTotals {
  lines: LineTotals[]
  netTiyn: number
  vatTiyn: number
  grossTiyn: number
}

const hasTotals = (line: RenderableLine): line is RenderableLine & LineTotals =>
  line.netTiyn !== undefined && line.vatTiyn !== undefined && line.grossTiyn !== undefined

export function resolveTotals(doc: RenderableDocument): ResolvedTotals {
  const computed = computeTotals(doc.lines, { vatEnabled: doc.vatEnabled, vatRateBp: doc.vatRateBp })
  if (!doc.lines.every(hasTotals)) return computed

  const lines = doc.lines.map(({ netTiyn, vatTiyn, grossTiyn }) => ({ netTiyn, vatTiyn, grossTiyn }))
  const sum = (pick: (line: LineTotals) => number) => lines.reduce((total, line) => total + pick(line), 0)
  return {
    lines,
    netTiyn: doc.netTiyn ?? sum((line) => line.netTiyn),
    vatTiyn: doc.vatTiyn ?? sum((line) => line.vatTiyn),
    grossTiyn: doc.grossTiyn ?? sum((line) => line.grossTiyn),
  }
}
