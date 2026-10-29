import { describe, expect, it } from 'vitest'
import type { Document } from '../../services'
import {
  blankLine,
  dateProblem,
  draftFromDocument,
  draftTotals,
  emptyDraft,
  lineErrorKey,
  lineFromArticle,
  lineProblems,
  moveLine,
  parseQty,
  patchLine,
  qtyText,
  removeLine,
  restoreLine,
  stepQty,
  toDocumentInput,
  validateDraft,
  validityFor,
  validUntilOf,
  type DraftLine,
  type QuoteDraft,
} from './draft'

const line = (patch: Partial<DraftLine> = {}): DraftLine => ({ ...blankLine(), title: 'Укладка ламината', ...patch })

// The reference quote of docs/spec.md: 12,5 м² × 18 500 ₸ and 32 п.м. × 1 500 ₸.
const referenceLines = (): DraftLine[] => [
  line({ title: 'Укладка ламината', unit: 'м²', qty: '12,5', price: '18 500' }),
  line({ title: 'Плинтус, монтаж', unit: 'п.м.', qty: '32', price: '1500' }),
]

const draft = (patch: Partial<QuoteDraft> = {}): QuoteDraft => ({
  clientId: 'client-1',
  lines: referenceLines(),
  vatEnabled: true,
  validity: 14,
  validUntil: '',
  notes: '',
  ...patch,
})

describe('quantity', () => {
  it.each([
    ['12,5', 12500],
    ['12.5', 12500],
    ['1', 1000],
    ['0,125', 125],
    ['1 000', 1000000],
  ])('reads %s as %i thousandths', (text, milli) => {
    expect(parseQty(text)).toEqual({ ok: true, milli })
  })

  it.each(['', '  ', '0', '0,000', '-1', '−2,5'])('"%s" is «Количество больше нуля»', (text) => {
    expect(parseQty(text)).toEqual({ ok: false, error: 'qe.error.qty' })
  })

  it.each(['abc', '1,2345', '12,5 м'])('"%s" is a typo and gets the hint with an example', (text) => {
    expect(parseQty(text)).toEqual({ ok: false, error: 'qe.error.qtyFormat' })
  })

  it('shows a stored quantity with a comma and no groups', () => {
    expect(qtyText(12500)).toBe('12,5')
    expect(qtyText(1000)).toBe('1')
    expect(qtyText(1234567)).toBe('1234,567')
  })

  it('steps by one whole unit and never goes below one', () => {
    expect(stepQty('1', 1)).toBe('2')
    expect(stepQty('12,5', 1)).toBe('13,5')
    expect(stepQty('12,5', -1)).toBe('11,5')
    expect(stepQty('1', -1)).toBe('1')
    expect(stepQty('0,5', -1)).toBe('1')
    expect(stepQty('', 1)).toBe('1')
  })
})

describe('what is wrong with a line', () => {
  it('nothing, for a filled line', () => {
    expect(lineProblems(referenceLines()[0]!)).toEqual({})
  })

  it('names the title, the quantity and a negative price in the words of components.md §2', () => {
    expect(lineProblems(line({ title: ' ', qty: '0', price: '-1' }))).toEqual({
      title: 'qe.error.title',
      qty: 'qe.error.qty',
      price: 'article.error.priceNegative',
    })
  })

  it('wants a price, but a price of zero is fine', () => {
    expect(lineProblems(line({ price: '' })).price).toBe('article.error.priceRequired')
    expect(lineProblems(line({ price: '0' }))).toEqual({})
  })

  it('refuses a title over 500 characters', () => {
    expect(lineProblems(line({ title: 'а'.repeat(501), price: '1' })).title).toBe('qe.error.titleLong')
    expect(lineProblems(line({ title: 'а'.repeat(500), price: '1' }))).toEqual({})
  })

  it('refuses an amount that does not fit', () => {
    expect(lineProblems(line({ qty: '999999999', price: '999999999999' })).qty).toBe('qe.error.amountTooLarge')
  })
})

describe('totals (TC-3, TC-4, TC-5)', () => {
  it('279 250 / 44 680 / 323 930 ₸ for the reference quote with VAT', () => {
    const totals = draftTotals(referenceLines(), true)
    expect(totals.netTiyn).toBe(27_925_000)
    expect(totals.vatTiyn).toBe(4_468_000)
    expect(totals.grossTiyn).toBe(32_393_000)
    // Line 1: 231 250 ₸, НДС 37 000 ₸.
    expect(totals.lines[0]).toEqual({ netTiyn: 23_125_000, vatTiyn: 3_700_000, grossTiyn: 26_825_000 })
  })

  it('279 250 ₸ and no VAT with the switch off', () => {
    const totals = draftTotals(referenceLines(), false)
    expect(totals.vatTiyn).toBe(0)
    expect(totals.grossTiyn).toBe(27_925_000)
  })

  it('rounds half up per line: 1,5 ч × 1 001,01 ₸ is 1 501,52 + НДС 240,24 = 1 741,76 ₸', () => {
    const totals = draftTotals([line({ unit: 'ч', qty: '1,5', price: '1001,01' })], true)
    expect(totals.netTiyn).toBe(150_152)
    expect(totals.vatTiyn).toBe(24_024)
    expect(totals.grossTiyn).toBe(174_176)
  })

  it('1000 шт × 9 999 999 ₸ is 11 599 998 840 ₸', () => {
    const totals = draftTotals([line({ qty: '1000', price: '9 999 999' })], true)
    expect(totals.netTiyn).toBe(999_999_900_000)
    expect(totals.grossTiyn).toBe(1_159_999_884_000)
    expect(totals.tooLarge).toBe(false)
  })

  it('counts a line that is not a number yet as nothing, and keeps its place', () => {
    const totals = draftTotals([line({ qty: '1', price: '' }), ...referenceLines()], true)
    expect(totals.lines[0]).toBeNull()
    expect(totals.lines[1]?.grossTiyn).toBe(26_825_000)
    expect(totals.grossTiyn).toBe(32_393_000)
  })

  it('says "too large" instead of a wrong sum', () => {
    const totals = draftTotals([line({ qty: '999999999', price: '999999999999' })], true)
    expect(totals.tooLarge).toBe(true)
    expect(totals.grossTiyn).toBe(0)
  })

  it('is zero for no lines', () => {
    expect(draftTotals([], true)).toMatchObject({ netTiyn: 0, vatTiyn: 0, grossTiyn: 0, tooLarge: false })
  })
})

describe('reorder, remove and undo (TC-2)', () => {
  const keys = (lines: readonly DraftLine[]) => lines.map((l) => l.title)
  const three = () => ['А', 'Б', 'В'].map((title) => line({ title }))

  it('moves a line up and down', () => {
    const lines = three()
    expect(keys(moveLine(lines, lines[1]!.key, -1))).toEqual(['Б', 'А', 'В'])
    expect(keys(moveLine(lines, lines[1]!.key, 1))).toEqual(['А', 'В', 'Б'])
  })

  it('leaves a line at the edge where it is', () => {
    const lines = three()
    expect(keys(moveLine(lines, lines[0]!.key, -1))).toEqual(['А', 'Б', 'В'])
    expect(keys(moveLine(lines, lines[2]!.key, 1))).toEqual(['А', 'Б', 'В'])
  })

  it('removes a line and puts it back in its place', () => {
    const lines = three()
    const { lines: rest, removed } = removeLine(lines, lines[0]!.key)
    expect(keys(rest)).toEqual(['Б', 'В'])
    expect(removed?.index).toBe(0)
    expect(keys(restoreLine(rest, removed!))).toEqual(['А', 'Б', 'В'])
  })

  it('puts a line back at the end when the list got shorter meanwhile', () => {
    const lines = three()
    const { lines: rest, removed } = removeLine(lines, lines[2]!.key)
    const shorter = rest.slice(0, 1)
    expect(keys(restoreLine(shorter, removed!))).toEqual(['А', 'В'])
  })

  it('does nothing for a key that is not there', () => {
    const lines = three()
    expect(removeLine(lines, 'nope')).toEqual({ lines, removed: null })
  })

  it('changes one line and leaves the rest', () => {
    const lines = three()
    const next = patchLine(lines, lines[1]!.key, { qty: '5' })
    expect(next.map((l) => l.qty)).toEqual(['1', '5', '1'])
  })
})

describe('a catalogue item as a line (TC-1)', () => {
  it('takes the title, unit and price, with quantity 1', () => {
    const article = {
      id: 'a-1',
      companyId: 'c-1',
      kind: 'service' as const,
      title: 'Укладка ламината',
      searchTitle: 'укладка ламината',
      unit: 'м²',
      unitPriceTiyn: 1_850_000,
      archivedAt: null,
    }
    expect(lineFromArticle(article)).toMatchObject({
      articleId: 'a-1',
      kind: 'service',
      title: 'Укладка ламината',
      unit: 'м²',
      qty: '1',
      saveToCatalog: false,
    })
    expect(lineFromArticle(article).price.replace(/\s/g, '')).toBe('18500')
  })

  it('gives every line its own key', () => {
    expect(new Set([blankLine().key, blankLine().key, blankLine().key]).size).toBe(3)
  })
})

describe('validity (TC-7)', () => {
  it('matches the company default to a button, and a number with no button to a date', () => {
    expect([3, 7, 14, 30].map(validityFor)).toEqual([3, 7, 14, 30])
    expect(validityFor(10)).toBe('date')
  })

  it('counts a button from the quote date, and takes a chosen date as it is', () => {
    expect(validUntilOf({ validity: 14, validUntil: '' }, '2026-10-20')).toBe('2026-11-03')
    expect(validUntilOf({ validity: 'date', validUntil: '2026-11-02' }, '2026-10-20')).toBe('2026-11-02')
  })

  it('wants a date that is not before the quote date', () => {
    expect(dateProblem({ validity: 'date', validUntil: '' }, '2026-10-20')).toBe('qe.error.validUntilEmpty')
    expect(dateProblem({ validity: 'date', validUntil: '2026-10-19' }, '2026-10-20')).toBe('qe.error.validUntilBefore')
    expect(dateProblem({ validity: 'date', validUntil: '2026-10-20' }, '2026-10-20')).toBeNull()
    expect(dateProblem({ validity: 7, validUntil: '' }, '2026-10-20')).toBeNull()
  })

  it('starts a new quote from the company setting and the VAT status', () => {
    expect(emptyDraft({ vatPayer: true, quoteValidityDays: 14 }, '2026-10-20')).toMatchObject({
      clientId: null,
      lines: [],
      vatEnabled: true,
      validity: 14,
    })
    expect(emptyDraft({ vatPayer: false, quoteValidityDays: 14 }, '2026-10-20').vatEnabled).toBe(false)
    expect(emptyDraft({ vatPayer: true, quoteValidityDays: 10 }, '2026-10-20')).toMatchObject({
      validity: 'date',
      validUntil: '2026-10-30',
    })
  })
})

describe('what stops a save (TC-8)', () => {
  it('lists the client, then each line field in order, with the words of the spec', () => {
    const bad = line({ title: '', qty: '0', price: '-1' })
    const found = validateDraft(draft({ clientId: null, lines: [bad] }), '2026-10-20')
    expect(found).toEqual([
      ['client', 'qe.error.client'],
      [lineErrorKey(bad.key, 'title'), 'qe.error.title'],
      [lineErrorKey(bad.key, 'qty'), 'qe.error.qty'],
      [lineErrorKey(bad.key, 'price'), 'article.error.priceNegative'],
    ])
  })

  it('finds nothing in the reference quote', () => {
    expect(validateDraft(draft(), '2026-10-20')).toEqual([])
  })

  it('lets a draft with a client and no lines be saved', () => {
    expect(validateDraft(draft({ lines: [] }), '2026-10-20')).toEqual([])
  })

  it('puts a wrong date last', () => {
    const found = validateDraft(draft({ clientId: null, validity: 'date', validUntil: '' }), '2026-10-20')
    expect(found.map(([key]) => key)).toEqual(['client', 'validUntil'])
  })
})

describe('the input the service gets', () => {
  it('turns text into thousandths and tiyn, and a button into a date', () => {
    const input = toDocumentInput(draft({ notes: ' Оплата — Kaspi. ' }), '2026-10-20')
    expect(input).toMatchObject({
      type: 'quote',
      clientId: 'client-1',
      issueDate: '2026-10-20',
      validUntil: '2026-11-03',
      vatEnabled: true,
      notes: 'Оплата — Kaspi.',
    })
    expect(input.lines.map((l) => [l.qtyMilli, l.unitPriceTiyn, l.unit])).toEqual([
      [12500, 1_850_000, 'м²'],
      [32000, 150_000, 'п.м.'],
    ])
    // The service computes the totals itself; the editor sends none.
    expect(JSON.stringify(input)).not.toMatch(/grossTiyn|netTiyn|vatTiyn/)
  })

  it('sends no notes when there are none, and no date when the date mode is empty', () => {
    const input = toDocumentInput(draft({ validity: 'date', validUntil: '' }), '2026-10-20')
    expect(input.notes).toBeNull()
    expect(input.validUntil).toBeNull()
  })

  it('links a line to the catalogue item just made from it', () => {
    const lines = referenceLines()
    const input = toDocumentInput(draft({ lines }), '2026-10-20', new Map([[lines[1]!.key, 'new-article']]))
    expect(input.lines.map((l) => l.articleId)).toEqual([null, 'new-article'])
  })

  it('refuses to build from a draft that was not checked', () => {
    expect(() => toDocumentInput(draft({ clientId: null }), '2026-10-20')).toThrow(RangeError)
    expect(() => toDocumentInput(draft({ lines: [line({ qty: '0', price: '1' })] }), '2026-10-20')).toThrow(RangeError)
  })
})

describe('a saved quote opened for editing (TC-9)', () => {
  const saved = {
    id: 'doc-1',
    clientId: 'client-1',
    issueDate: '2026-10-20',
    validUntil: '2026-11-03',
    vatEnabled: true,
    notes: 'Работы начнём в понедельник.',
    lines: [
      { articleId: 'a-1', kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12500, unitPriceTiyn: 1_850_000 },
      { articleId: null, kind: 'material', title: 'Подложка', unit: 'м²', qtyMilli: 1000, unitPriceTiyn: 50_050 },
    ],
  } as unknown as Document

  it('gives back the same lines, in order, with the validity button the dates match', () => {
    const opened = draftFromDocument(saved)
    expect(opened).toMatchObject({ clientId: 'client-1', vatEnabled: true, validity: 14, notes: 'Работы начнём в понедельник.' })
    expect(opened.lines.map((l) => [l.title, l.qty, l.unit, l.kind, l.articleId])).toEqual([
      ['Укладка ламината', '12,5', 'м²', 'service', 'a-1'],
      ['Подложка', '1', 'м²', 'material', null],
    ])
    expect(opened.lines[1]!.price.replace(/\s/g, '')).toBe('500,50')
  })

  it('saves back what it opened', () => {
    const input = toDocumentInput(draftFromDocument(saved), '2026-10-20')
    expect(input.lines.map((l) => [l.qtyMilli, l.unitPriceTiyn])).toEqual([
      [12500, 1_850_000],
      [1000, 50_050],
    ])
    expect(input.validUntil).toBe('2026-11-03')
  })

  it('shows a date that matches no button as a date', () => {
    expect(draftFromDocument({ ...saved, validUntil: '2026-11-02' } as Document)).toMatchObject({
      validity: 'date',
      validUntil: '2026-11-02',
    })
    expect(draftFromDocument({ ...saved, validUntil: null } as Document)).toMatchObject({ validity: 'date', validUntil: '' })
  })
})
