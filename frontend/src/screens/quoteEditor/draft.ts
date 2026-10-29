// The quote editor's form state (S07, #19): what the person typed, kept as text, and the pure functions on it.
// No React here. Quantity and price stay as typed ("12,5", "18 500") until they are turned into integer thousandths
// and tiyn for the totals and for the save; whatever totals the editor shows are computed by src/domain, the same
// code the mock service (and later the backend) runs on save, so the figures on screen are the figures saved.

import { parsePriceInput, ARTICLE_UNITS } from '../../domain/article'
import { addDays, daysBetween } from '../../domain/dates'
import { computeLine, computeTotals, parseQuantityMilli, type LineTotals } from '../../domain'
import type { MessageKey } from '../../i18n/t'
import { moneyInputTextFromTiyn } from '../../components/moneyInputText'
import { formatQty } from '../../documents/format'
import type {
  Article,
  ArticleKind,
  Document,
  DocumentInput,
  DocumentLineInput,
  Id,
  IsoDate,
} from '../../services'

/** The VAT rate copied onto every new document: 16 % (docs/spec.md §6). */
export const VAT_RATE_BP = 1600

/** The validity buttons of components.md §2, plus "Дата". */
export const VALIDITY_PRESETS = [3, 7, 14, 30] as const
export type ValidityChoice = (typeof VALIDITY_PRESETS)[number] | 'date'

export const TITLE_MAX = 500

export interface DraftLine {
  /** Identifies the line on this screen only (React keys, focus, undo); never sent to the service. */
  key: string
  /** The catalogue item the line was copied from; the line keeps its own copy of title, unit and price. */
  articleId: Id | null
  kind: ArticleKind
  title: string
  unit: string
  /** As typed: "12,5". */
  qty: string
  /** As typed: "18 500". */
  price: string
  /** A manual line only: also add it to the catalogue when the quote is saved. */
  saveToCatalog: boolean
}

export interface QuoteDraft {
  clientId: Id | null
  lines: DraftLine[]
  vatEnabled: boolean
  validity: ValidityChoice
  /** `YYYY-MM-DD` when `validity` is "date", otherwise unused. */
  validUntil: string
  notes: string
}

// ---------------------------------------------------------------- lines

let lineCounter = 0
/** A key for a new line. A counter, not a UUID: `crypto.randomUUID` is missing on a phone that opens the dev server over http. */
export function nextLineKey(): string {
  lineCounter += 1
  return `line-${lineCounter}`
}

/** A line the person fills in by hand: a work, one piece, no price yet. */
export function blankLine(): DraftLine {
  return { key: nextLineKey(), articleId: null, kind: 'service', title: '', unit: ARTICLE_UNITS[0], qty: '1', price: '', saveToCatalog: false }
}

/** A catalogue item as a line: quantity 1, the item's own unit and price. */
export function lineFromArticle(article: Article): DraftLine {
  return {
    key: nextLineKey(),
    articleId: article.id,
    kind: article.kind,
    title: article.title,
    unit: article.unit,
    qty: '1',
    price: moneyInputTextFromTiyn(article.unitPriceTiyn),
    saveToCatalog: false,
  }
}

/** The line with `patch` applied; any other line is returned as it was. */
export function patchLine(lines: readonly DraftLine[], key: string, patch: Partial<DraftLine>): DraftLine[] {
  return lines.map((line) => (line.key === key ? { ...line, ...patch } : line))
}

/** One place up (`-1`) or down (`+1`); a line at the edge stays where it is. */
export function moveLine(lines: readonly DraftLine[], key: string, step: -1 | 1): DraftLine[] {
  const from = lines.findIndex((line) => line.key === key)
  const to = from + step
  if (from < 0 || to < 0 || to >= lines.length) return [...lines]
  const moved = [...lines]
  const [line] = moved.splice(from, 1)
  moved.splice(to, 0, line!)
  return moved
}

export interface RemovedLine {
  line: DraftLine
  index: number
}

/** The lines without `key`, and what was removed and where, so "Вернуть" can put it back. */
export function removeLine(lines: readonly DraftLine[], key: string): { lines: DraftLine[]; removed: RemovedLine | null } {
  const index = lines.findIndex((line) => line.key === key)
  if (index < 0) return { lines: [...lines], removed: null }
  return { lines: lines.filter((line) => line.key !== key), removed: { line: lines[index]!, index } }
}

/** Puts a removed line back in its place (at the end if the list got shorter in the meantime). */
export function restoreLine(lines: readonly DraftLine[], removed: RemovedLine): DraftLine[] {
  const restored = [...lines]
  restored.splice(Math.min(removed.index, restored.length), 0, removed.line)
  return restored
}

// ---------------------------------------------------------------- numbers

export type QtyParse = { ok: true; milli: number } | { ok: false; error: MessageKey }

// A minus sign the way people type it: hyphen-minus, the real minus U+2212, en and em dashes.
const MINUS = /^[-−–—]/

/** "12,5" and "12.5" → 12500. Zero, a minus, nothing: «Количество больше нуля». A typo gets its own hint. */
export function parseQty(text: string): QtyParse {
  const trimmed = text.trim()
  if (trimmed === '' || MINUS.test(trimmed)) return { ok: false, error: 'qe.error.qty' }
  const milli = parseQuantityMilli(trimmed)
  if (milli === null) return { ok: false, error: 'qe.error.qtyFormat' }
  return milli > 0 ? { ok: true, milli } : { ok: false, error: 'qe.error.qty' }
}

/** The quantity as the field shows it: 12500 → "12,5". */
export function qtyText(qtyMilli: number): string {
  // formatQty groups thousands with a no-break space, which \s matches; the field shows the number without groups.
  return formatQty(qtyMilli).replace(/\s+/g, '')
}

/** Quantity plus one (or minus one) whole unit, for the − and + buttons; never below the smallest step. */
export function stepQty(text: string, step: -1 | 1): string {
  const parsed = parseQty(text)
  const current = parsed.ok ? parsed.milli : 0
  const next = Math.max(current + step * 1000, 1000)
  return qtyText(next)
}

export type FieldKey = 'title' | 'qty' | 'price'
export type LineProblems = Partial<Record<FieldKey, MessageKey>>

/** What is wrong with a line, per field, as dictionary keys. Empty: the line can be saved. */
export function lineProblems(line: DraftLine): LineProblems {
  const problems: LineProblems = {}
  const title = line.title.trim()
  if (title === '') problems.title = 'qe.error.title'
  else if (title.length > TITLE_MAX) problems.title = 'qe.error.titleLong'

  const qty = parseQty(line.qty)
  if (!qty.ok) problems.qty = qty.error

  const price = parsePriceInput(line.price)
  if (!price.ok) problems.price = price.error

  if (qty.ok && price.ok) {
    try {
      computeLine({ qtyMilli: qty.milli, unitPriceTiyn: price.tiyn }, { vatEnabled: true, vatRateBp: VAT_RATE_BP })
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      problems.qty = 'qe.error.amountTooLarge'
    }
  }
  return problems
}

// ---------------------------------------------------------------- totals

export interface DraftTotals {
  /** Per line, in order; null for a line whose quantity or price is not a valid number yet. */
  lines: (LineTotals | null)[]
  netTiyn: number
  vatTiyn: number
  grossTiyn: number
  /** The sum does not fit into a safe integer: show a word instead of a wrong number. */
  tooLarge: boolean
}

/** The totals of what is typed so far. A line that is not a number yet counts as nothing (it shows its own error). */
export function draftTotals(lines: readonly DraftLine[], vatEnabled: boolean): DraftTotals {
  const vat = { vatEnabled, vatRateBp: VAT_RATE_BP }
  const parsed = lines.map((line) => {
    const qty = parseQty(line.qty)
    const price = parsePriceInput(line.price)
    return qty.ok && price.ok ? { qtyMilli: qty.milli, unitPriceTiyn: price.tiyn } : null
  })
  try {
    const valid = parsed.filter((line): line is NonNullable<typeof line> => line !== null)
    const totals = computeTotals(valid, vat)
    let next = 0
    return {
      lines: parsed.map((line) => (line === null ? null : totals.lines[next++]!)),
      netTiyn: totals.netTiyn,
      vatTiyn: totals.vatTiyn,
      grossTiyn: totals.grossTiyn,
      tooLarge: false,
    }
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return { lines: parsed.map(() => null), netTiyn: 0, vatTiyn: 0, grossTiyn: 0, tooLarge: true }
  }
}

// ---------------------------------------------------------------- validity

/** Which validity button a company default or a saved quote matches; a number of days with no button of its own is a date. */
export function validityFor(days: number): ValidityChoice {
  return (VALIDITY_PRESETS as readonly number[]).includes(days) ? (days as ValidityChoice) : 'date'
}

/** The last day the quote is valid: the chosen number of days after `issueDate`, or the chosen date ('' while not chosen). */
export function validUntilOf(draft: Pick<QuoteDraft, 'validity' | 'validUntil'>, issueDate: IsoDate): IsoDate | '' {
  return draft.validity === 'date' ? draft.validUntil : addDays(issueDate, draft.validity)
}

// ---------------------------------------------------------------- validation

/** Where an error sits: the client, the date, or one field of one line (`<line key>.<field>`). */
export type ErrorKey = 'client' | 'validUntil' | `${string}.${FieldKey}`

export const lineErrorKey = (key: string, field: FieldKey): ErrorKey => `${key}.${field}`

/** Every mistake that stops a save, in the order the screen shows them (client, lines, then the date). */
export function validateDraft(draft: QuoteDraft, issueDate: IsoDate): [ErrorKey, MessageKey][] {
  const found: [ErrorKey, MessageKey][] = []
  if (draft.clientId === null) found.push(['client', 'qe.error.client'])
  for (const line of draft.lines) {
    const problems = lineProblems(line)
    for (const field of ['title', 'qty', 'price'] as const) {
      const message = problems[field]
      if (message) found.push([lineErrorKey(line.key, field), message])
    }
  }
  const date = dateProblem(draft, issueDate)
  if (date) found.push(['validUntil', date])
  return found
}

/** The date mode needs a date that is not before the quote's own date. */
export function dateProblem(draft: Pick<QuoteDraft, 'validity' | 'validUntil'>, issueDate: IsoDate): MessageKey | null {
  if (draft.validity !== 'date') return null
  if (draft.validUntil === '') return 'qe.error.validUntilEmpty'
  return draft.validUntil < issueDate ? 'qe.error.validUntilBefore' : null
}

// ---------------------------------------------------------------- to and from the service

/** A checked draft as the service takes it. `articleIds` maps a line key to the catalogue item just made from it. */
export function toDocumentInput(
  draft: QuoteDraft,
  issueDate: IsoDate,
  articleIds: ReadonlyMap<string, Id> = new Map(),
): DocumentInput {
  if (draft.clientId === null) throw new RangeError('a quote needs a client')
  const lines = draft.lines.map((line): DocumentLineInput => {
    const qty = parseQty(line.qty)
    const price = parsePriceInput(line.price)
    if (!qty.ok || !price.ok) throw new RangeError('a line with a wrong quantity or price cannot be saved')
    return {
      articleId: articleIds.get(line.key) ?? line.articleId,
      kind: line.kind,
      title: line.title.trim(),
      unit: line.unit,
      qtyMilli: qty.milli,
      unitPriceTiyn: price.tiyn,
    }
  })
  const validUntil = validUntilOf(draft, issueDate)
  return {
    type: 'quote',
    clientId: draft.clientId,
    issueDate,
    validUntil: validUntil === '' ? null : validUntil,
    vatEnabled: draft.vatEnabled,
    lines,
    notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
  }
}

/** A new quote: nothing in it yet, VAT on for a VAT payer, the validity from the company's setting. */
export function emptyDraft(company: { vatPayer: boolean; quoteValidityDays: number }, today: IsoDate): QuoteDraft {
  const validity = validityFor(company.quoteValidityDays)
  return {
    clientId: null,
    lines: [],
    vatEnabled: company.vatPayer,
    validity,
    validUntil: validity === 'date' ? addDays(today, company.quoteValidityDays) : '',
    notes: '',
  }
}

/** A saved quote opened for editing. */
export function draftFromDocument(document: Document): QuoteDraft {
  const days = document.validUntil === null ? null : daysBetween(document.issueDate, document.validUntil)
  const validity = days === null ? 'date' : validityFor(days)
  return {
    clientId: document.clientId,
    lines: document.lines.map((line) => ({
      key: nextLineKey(),
      articleId: line.articleId,
      kind: line.kind,
      title: line.title,
      unit: line.unit,
      qty: qtyText(line.qtyMilli),
      price: moneyInputTextFromTiyn(line.unitPriceTiyn),
      saveToCatalog: false,
    })),
    vatEnabled: document.vatEnabled,
    validity,
    validUntil: document.validUntil ?? '',
    notes: document.notes ?? '',
  }
}
