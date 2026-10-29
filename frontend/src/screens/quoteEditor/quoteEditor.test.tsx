import { readFileSync } from 'node:fs'
import type { QueryClient } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import type { Company, Document, DocumentLine } from '../../services'
import { renderApp, seedCache, SIGNED_IN } from '../../test/renderApp'
import { companyKey } from '../company/queries'
import { blankLine, draftTotals, lineFromArticle, type DraftLine, type QuoteDraft } from './draft'
import { LineCard } from './LineCard'
import { clientSnapshotOf, companySnapshotOf, previewDocument } from './previewDocument'
import { Toast } from './Toast'
import { plainAmount, TotalsBar } from './TotalsBar'

// S07 (#19): the screen as it is first drawn, the pieces it is built from, and the files' rules (tokens, 48 px, two buttons).
// The tests render to a string, like the other screens' tests; what needs a finger (taps, focus) is run by hand in the dev server.

const COMPANY: Company = SIGNED_IN.companies[0]!
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

/** The editor at `url` for a signed-in user whose company is `company` (the screen reads it from the company query). */
function renderEditor(url: string, company: Company = COMPANY, state?: unknown): string {
  seedCache(SIGNED_IN, (client: QueryClient) => client.setQueryData(companyKey, company))
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: url, state }] })
  return renderToString(<RouterProvider router={router} />)
}

const line = (patch: Partial<DraftLine>): DraftLine => ({ ...blankLine(), ...patch })

const referenceDraft = (patch: Partial<QuoteDraft> = {}): QuoteDraft => ({
  clientId: 'k-1',
  lines: [
    line({ title: 'Укладка ламината', unit: 'м²', qty: '12,5', price: '18 500' }),
    line({ title: 'Плинтус, монтаж', unit: 'п.м.', qty: '32', price: '1500' }),
  ],
  vatEnabled: true,
  validity: 14,
  validUntil: '',
  notes: '',
  ...patch,
})

// A saved quote as the service returns it: the reference quote (279 250 / 44 680 / 323 930 ₸). Built by hand because a
// screen's tests do not import the mock (src/services/boundary.test.ts); the mock's own agreement with the editor is
// checked in src/services/mock/editorSave.test.ts.
function savedQuote(patch: Partial<Document> = {}): Document {
  const lines: DocumentLine[] = [
    { id: 'l-1', position: 0, articleId: null, kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12_500, unitPriceTiyn: 1_850_000, discountBp: 0, netTiyn: 23_125_000, vatTiyn: 3_700_000, grossTiyn: 26_825_000 },
    { id: 'l-2', position: 1, articleId: null, kind: 'service', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32_000, unitPriceTiyn: 150_000, discountBp: 0, netTiyn: 4_800_000, vatTiyn: 768_000, grossTiyn: 5_568_000 },
  ]
  return {
    id: 'q-1',
    companyId: COMPANY.id,
    type: 'quote',
    status: 'draft',
    number: null,
    issueDate: '2026-10-20',
    validUntil: '2026-11-03',
    dueDate: null,
    clientId: 'k-1',
    clientName: 'Қайрат Әбілқасымов',
    sourceDocumentId: null,
    currency: 'KZT',
    netTiyn: 27_925_000,
    vatTiyn: 4_468_000,
    grossTiyn: 32_393_000,
    version: 1,
    issuedAt: null,
    signedAt: null,
    isExpired: false,
    payment: null,
    periodFrom: null,
    periodTo: null,
    contractRef: null,
    clientSnapshot: { kind: 'person', name: 'Қайрат Әбілқасымов', binIin: '880715301453', phone: '+7 701 123 45 67', email: null, address: null },
    companySnapshot: companySnapshotOf(COMPANY),
    basis: null,
    basisValue: null,
    vatEnabled: true,
    vatRateBp: 1600,
    notes: 'Оплата — Kaspi.',
    terms: null,
    cancelledAt: null,
    lines,
    shareUrl: null,
    signature: null,
    children: [],
    ...patch,
  }
}

describe('S07 first paint', () => {
  it('shows the loading state until the company has been read', () => {
    const html = renderApp('/quotes/new')
    expect(html).toContain('data-screen="S07"')
    expect(html).toContain('data-state="loading"')
  })

  const html = renderEditor('/quotes/new')
  const visible = text(html)

  it('is the editor, with the client, lines, terms, totals and save in order (components.md S07)', () => {
    expect(html).toContain('data-screen="S07"')
    const order = [
      t('qe.client.choose'),
      t('qe.lines.empty.title'),
      t('qe.lines.fromCatalog'),
      t('qe.lines.manual'),
      t('qe.validity.label'),
      t('qe.notes.label'),
      t('qe.totals.label'),
      t('qe.save'),
    ].map((label) => visible.indexOf(label))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('starts empty: status "Ещё не сохранено", no line, a collapsed total, one save button', () => {
    expect(visible).toContain(t('qe.status.new'))
    expect(html).not.toContain('class="qe-line card')
    expect(html).toContain(`aria-label="${t('qe.totals.show')}"`)
    expect(html).toContain('aria-expanded="false"')
    expect(html.match(/<span class="dc-label">Сохранить<\/span>/g)).toHaveLength(1)
  })

  it('offers 3 / 7 / 14 / 30 days or a date, with the company default (14) chosen (AC 5)', () => {
    const radios = [...html.matchAll(/<input[^>]*name="qe-validity"[^>]*>/g)].map((m) => m[0])
    expect(radios).toHaveLength(5)
    expect(radios.map((r) => /value="([^"]+)"/.exec(r)![1])).toEqual(['3', '7', '14', '30', 'date'])
    const checked = radios.filter((r) => r.includes('checked'))
    expect(checked).toHaveLength(1)
    expect(checked[0]).toContain('value="14"')
  })

  it('preselects another default, and a date when the default has no button of its own', () => {
    const thirty = renderEditor('/quotes/new', { ...COMPANY, quoteValidityDays: 30 })
    expect([...thirty.matchAll(/<input[^>]*name="qe-validity"[^>]*>/g)].find((m) => m[0].includes('checked'))![0]).toContain('value="30"')
    const ten = renderEditor('/quotes/new', { ...COMPANY, quoteValidityDays: 10 })
    expect(ten).toContain('type="date"')
    expect(text(ten)).toContain(t('qe.validity.dateLabel'))
  })

  it('has the VAT switch for a VAT payer and the optional note', () => {
    expect(html).toContain('role="switch"')
    expect(visible).toContain(t('qe.vat.label', { rate: '16' }))
    expect(visible).toContain(t('form.optional'))
  })

  it('replaces the switch with "Без НДС" and a link to the company settings for a company that is not a VAT payer (AC 4)', () => {
    const plain = renderEditor('/quotes/new', { ...COMPANY, vatPayer: false })
    expect(plain).not.toContain('role="switch"')
    expect(text(plain)).toContain(t('qe.noVat.label'))
    expect(text(plain)).toContain(t('qe.noVat.text'))
    expect(plain).toMatch(/<a[^>]*href="\/settings\/company"[^>]*>\s*Изменить в настройках компании/)
  })
})

describe('S07 with a saved quote', () => {
  it('reopens a draft with its lines, VAT, status and totals as saved (AC 7)', () => {
    const saved = savedQuote()
    const html = renderEditor(`/quotes/${saved.id}/edit`, COMPANY, { saved, time: '14:32' })
    const visible = text(html)

    expect(visible).toContain(t('qe.status.saved', { time: '14:32' }))
    expect(visible).toContain('Қайрат Әбілқасымов')
    // formatMoney puts a no-break space inside the number, so the expected names are built the way the screen builds them.
    expect(html).toContain(`aria-label="${t('qe.line.aria', { n: 1, title: 'Укладка ламината', amount: plainAmount(23_125_000) })}"`)
    expect(html).toContain(`aria-label="${t('qe.line.aria', { n: 2, title: 'Плинтус, монтаж', amount: plainAmount(4_800_000) })}"`)
    expect(html).toContain(t('qe.line.vat', { amount: formatMoney(3_700_000) }))
    expect(visible).toContain('323 930')
    expect(visible).toContain('Оплата — Kaspi.')
    expect(html).toContain('value="14"')
    expect(visible).toContain(t('qe.save'))
  })

  it('opens a signed quote read-only: no save, no field, lines that are text, the signature banner (AC 7)', () => {
    const quote = savedQuote({
      status: 'signed',
      number: 'КП-2026-0001',
      signedAt: '2026-10-19T09:05:00Z',
      signature: { method: 'drawn', signerName: 'Қайрат Ә.', signedAt: '2026-10-19T09:05:00Z', documentVersion: 1 },
    })
    const html = renderEditor(`/quotes/${quote.id}/edit`, COMPANY, { saved: quote, time: '10:00' })
    const visible = text(html)

    expect(visible).toContain('Подписано на экране')
    expect(visible).not.toContain(t('qe.save'))
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('role="switch"')
    expect(html).toContain('role="group"')
    expect(html).not.toContain(`aria-label="${t('qe.line.moveUp')}"`)
    expect(visible).toContain(t('qe.totals.label'))
  })
})

describe('LineCard', () => {
  const base = {
    n: 1,
    line: line({ title: 'Укладка ламината', unit: 'м²', qty: '12,5', price: '18 500' }),
    totals: { netTiyn: 23_125_000, vatTiyn: 3_700_000, grossTiyn: 26_825_000 },
    vatEnabled: true,
    expanded: false,
    readOnly: false,
    problems: {},
    canMoveUp: true,
    canMoveDown: true,
    onToggle: () => {},
    onChange: () => {},
    onBlur: () => {},
    onMove: () => {},
    onRemove: () => {},
  }
  const render = (props: Partial<Parameters<typeof LineCard>[0]> = {}) =>
    renderToString(
      <ul>
        <LineCard {...base} {...props} />
      </ul>,
    )

  it('collapsed: one button named "Строка 1: …, 231 250 тенге" with the quantity, the price and the VAT (components.md S07)', () => {
    const html = render()
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain(`aria-label="Строка 1: Укладка ламината, ${plainAmount(23_125_000)} тенге"`)
    expect(plainAmount(23_125_000).replace(/\s/g, ' ')).toBe('231 250')
    const visible = text(html)
    expect(visible).toContain('12,5')
    expect(visible).toContain('м²')
    expect(visible).toContain('18 500')
    expect(visible).toContain('НДС')
    expect(html).not.toContain('<textarea')
  })

  it('collapsed without VAT shows no VAT line, and without a number shows no amount in its name', () => {
    expect(text(render({ vatEnabled: false }))).not.toContain('НДС')
    const html = render({ totals: null, line: { ...base.line, qty: 'abc' } })
    expect(html).toContain(`aria-label="Строка 1: Укладка ламината"`)
  })

  it('an unnamed line is called "Без названия"', () => {
    expect(text(render({ line: { ...base.line, title: '  ' } }))).toContain(t('qe.line.untitled'))
  })

  it('expanded: every field has a label tied to it, the unit chip, reorder, delete and the catalogue checkbox (AC 1, 2)', () => {
    const html = render({ expanded: true })
    const key = base.line.key
    for (const field of ['title', 'qty', 'price']) expect(html).toContain(`for="${key}-${field}"`)
    expect(html).toContain('<textarea')
    expect(html).toContain(`aria-label="${t('qe.line.unit.change', { unit: 'м²' })}"`)
    expect(html).toContain(`aria-label="${t('qe.line.moveUp')}"`)
    expect(html).toContain(`aria-label="${t('qe.line.moveDown')}"`)
    expect(html).toContain(`aria-label="${t('qe.line.qty.less')}"`)
    expect(html).toContain(`aria-label="${t('qe.line.qty.more')}"`)
    const visible = text(html)
    expect(visible).toContain(t('qe.line.remove'))
    expect(visible).toContain(t('qe.line.saveToCatalog'))
    expect(visible).toContain(t('catalog.kind.service'))
    expect(visible).toContain(t('catalog.kind.material'))
  })

  it('expanded: the edge lines cannot move past the ends', () => {
    const html = render({ expanded: true, canMoveUp: false })
    expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${t('qe.line.moveUp')}"[^>]*disabled`))
    expect(html).not.toMatch(new RegExp(`<button[^>]*aria-label="${t('qe.line.moveDown')}"[^>]*disabled`))
  })

  it('a catalogue line says so instead of offering to save it again', () => {
    const fromCatalog = lineFromArticle({
      id: 'a-1',
      companyId: 'c-1',
      kind: 'service',
      title: 'Укладка ламината',
      unit: 'м²',
      unitPriceTiyn: 1_850_000,
    } as never)
    const visible = text(render({ expanded: true, line: fromCatalog }))
    expect(visible).toContain(t('qe.line.inCatalog'))
    expect(visible).not.toContain(t('qe.line.saveToCatalog'))
  })

  it('shows the told mistakes in words, ties them to the fields and marks the line (AC 6)', () => {
    const html = render({
      expanded: true,
      problems: { title: 'qe.error.title', qty: 'qe.error.qty', price: 'article.error.priceNegative' as never },
    })
    expect(html).toContain(t('qe.error.title'))
    expect(html).toContain(t('qe.error.qty'))
    expect(html.match(/aria-invalid="true"/g)!.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain(`id="${base.line.key}-title-error"`)
    expect(html).toContain(t('qe.line.error'))
    expect(html).toContain('data-invalid="true"')
  })

  it('read-only: the line is text with no button and no field', () => {
    const html = render({ readOnly: true, expanded: true })
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<textarea')
    expect(html).toContain('role="group"')
  })
})

describe('TotalsBar', () => {
  const reference = draftTotals(referenceDraft().lines, true)
  const render = (props: Partial<Parameters<typeof TotalsBar>[0]> = {}) =>
    renderToString(<TotalsBar totals={reference} vatEnabled lineCount={2} expanded={false} onToggle={() => {}} {...props} />)

  it('collapsed: Итого 323 930 ₸ and "2 строки" on one line (AC 3)', () => {
    const visible = text(render())
    expect(visible).toContain('Итого')
    expect(visible).toContain('323 930')
    expect(visible).toContain('2 строки')
    expect(visible).not.toContain(t('qe.totals.net'))
  })

  it('expanded: Без НДС 279 250, НДС 16 % 44 680, Итого 323 930', () => {
    const html = render({ expanded: true })
    const visible = text(html)
    expect(html).toContain('aria-expanded="true"')
    expect(visible).toContain(`${t('qe.totals.net')} 279 250`)
    expect(visible).toContain(`${t('qe.totals.vat', { rate: '16' })} 44 680`)
  })

  it('with VAT off, only the sum without VAT, and no VAT line (AC 3)', () => {
    const off = draftTotals(referenceDraft().lines, false)
    const visible = text(render({ totals: off, vatEnabled: false, expanded: true }))
    expect(visible).toContain('279 250')
    expect(visible).not.toContain('НДС 16')
  })

  it('says a word, not a wrong number, when the sum does not fit', () => {
    const tooLarge = { lines: [], netTiyn: 0, vatTiyn: 0, grossTiyn: 0, tooLarge: true }
    const html = render({ totals: tooLarge })
    expect(text(html)).toContain(t('qe.totals.tooLarge'))
    expect(html).not.toContain('aria-expanded')
  })

  it('announces the sum in words for a screen reader', () => {
    expect(render()).toContain('aria-live="polite"')
    expect(plainAmount(32_393_000)).toBe(formatMoney(32_393_000).replace(/\s*₸$/, ''))
  })
})

describe('Toast', () => {
  it('is one sentence and one action, announced politely (AC 2)', () => {
    const html = renderToString(<Toast text={t('qe.line.removed')} actionLabel={t('qe.line.undo')} onAction={() => {}} onDismiss={() => {}} />)
    expect(html).toContain('role="status"')
    expect(text(html)).toBe('Строка удалена Вернуть')
    expect(html).toContain('<button')
  })
})

describe('the preview document', () => {
  const client = clientSnapshotOf({
    id: 'k-1',
    companyId: 'c-1',
    kind: 'person',
    name: 'Қайрат Әбілқасымов',
    binIin: '880715301453',
    phone: '+7 701 123 45 67',
    email: null,
    address: null,
    searchName: '',
    archivedAt: null,
  })
  const context = { client, company: COMPANY, issueDate: '2026-10-20', number: null }

  it('carries the lines, the VAT switch and the rate the editor shows', () => {
    const doc = previewDocument(referenceDraft({ notes: ' Оплата — Kaspi. ' }), context)
    expect(doc.lines.map((l) => [l.title, l.unit, l.qtyMilli, l.unitPriceTiyn])).toEqual([
      ['Укладка ламината', 'м²', 12_500, 1_850_000],
      ['Плинтус, монтаж', 'п.м.', 32_000, 150_000],
    ])
    expect([doc.vatEnabled, doc.vatRateBp, doc.number, doc.issueDate]).toEqual([true, 1600, null, '2026-10-20'])
    expect(doc.notes).toBe('Оплата — Kaspi.')
    expect(doc.clientSnapshot.name).toBe('Қайрат Әбілқасымов')
    expect(doc.companySnapshot.legalName).toBe(COMPANY.legalName)
  })

  it('counts a line that is not a number yet as nothing, and has a validity date only when there is one', () => {
    const doc = previewDocument(
      referenceDraft({ lines: [line({ title: 'Вывоз', qty: 'abc', price: '' })], validity: 'date', validUntil: '', notes: '' }),
      { ...context, client: null },
    )
    expect(doc.lines).toEqual([{ title: 'Вывоз', unit: 'шт', qtyMilli: 0, unitPriceTiyn: 0 }])
    expect(doc.validUntil).toBeNull()
    expect(doc.notes).toBeNull()
    expect(doc.clientSnapshot.name).toBe('')
    expect(previewDocument(referenceDraft(), context).validUntil).toBe('2026-11-03')
  })

  it('copies the company requisites that are printed on the quote', () => {
    const snapshot = companySnapshotOf({ ...COMPANY, vatPayer: false })
    expect(snapshot.vatPayer).toBe(false)
    expect(snapshot.binIin).toBe(COMPANY.binIin)
    expect(snapshot).not.toHaveProperty('timezone')
  })
})

describe('the editor files follow the design rules (components.md §0)', () => {
  const css = read('./quoteEditor.css')
  const sources = ['./QuoteEditorScreen.tsx', './LineCard.tsx', './TotalsBar.tsx', './Toast.tsx'].map(read).join('\n')

  it('uses tokens only: no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl)\(/)
  })

  it('keeps the grids shrinkable and the two add buttons side by side at most', () => {
    expect(css).toContain('minmax(0, 1fr)')
    expect(css).toMatch(/\.qe-add\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
  })

  it('gives targets 48 px or more: the toast action, the unit chip, the checkbox row and the bars', () => {
    for (const rule of ['.qe-toast-action', '.qe-unit', '.qe-check', '.qe-totals-main', '.qe-actions .btn']) {
      const block = css.slice(css.indexOf(`${rule} {`))
      expect(block.slice(0, block.indexOf('}')), rule).toMatch(/min-height: var\(--dc-size-(touch-min|control-lg)\)/)
    }
  })

  it('hides the bars while a text field has focus on a phone, not on a desktop', () => {
    expect(css).toMatch(/@media \(max-width: 1023px\)\s*\{\s*\.qe-root\[data-typing\] \.qe-bars \{ display: none; \}/)
  })

  it('sends every visible string through t()', () => {
    expect(sources).not.toMatch(/>\s*[А-Яа-яЁё][^<{]*</)
    expect(sources).not.toMatch(/(placeholder|aria-label|title)="[А-Яа-яЁё]/)
  })

  it('never calls the signature legally binding', () => {
    expect(sources).not.toMatch(/юридическ|ЭЦП|legally/i)
  })
})
