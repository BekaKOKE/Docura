// The shared vectors from contracts/test-vectors/, typed. Imported by the domain tests only; the backend
// tests (#37) run the same files, so a change to a vector changes both sides (AGENTS.md rule 3).

import amountInWordsFile from '../../../contracts/test-vectors/amount-in-words.json'
import binIinFile from '../../../contracts/test-vectors/bin-iin.json'
import iikFile from '../../../contracts/test-vectors/iik.json'
import prepaymentFile from '../../../contracts/test-vectors/prepayment.json'
import totalsFile from '../../../contracts/test-vectors/totals.json'

export interface VectorFile<Case> {
  description: string
  cases: Case[]
}

export interface TotalsCase {
  id: string
  description: string
  vatEnabled: boolean
  vatRateBp: number
  lines: { qtyText: string; qtyMilli: number; unitPriceTiyn: number; discountBp: number }[]
  expected: {
    lines: { netTiyn: number; vatTiyn: number; grossTiyn: number }[]
    netTiyn: number
    vatTiyn: number
    grossTiyn: number
  }
}

export interface PrepaymentCase {
  id: string
  description: string
  quoteGrossTiyn: number
  vatEnabled: boolean
  vatRateBp: number
  alreadyInvoicedTiyn: number
  basis: 'percent' | 'amount' | 'remaining'
  basisValue?: number
  expected: { grossTiyn: number; vatTiyn: number; netTiyn: number } | { error: string }
}

export interface ValidityCase {
  id: string
  value: string
  valid: boolean
  reason: string
}

export interface AmountInWordsCase {
  id: string
  amountTiyn: number
  expected: string
}

export const totalsVectors = totalsFile as unknown as VectorFile<TotalsCase>
export const prepaymentVectors = prepaymentFile as unknown as VectorFile<PrepaymentCase>
export const binIinVectors = binIinFile as unknown as VectorFile<ValidityCase>
export const iikVectors = iikFile as unknown as VectorFile<ValidityCase>
export const amountInWordsVectors = amountInWordsFile as unknown as VectorFile<AmountInWordsCase>
