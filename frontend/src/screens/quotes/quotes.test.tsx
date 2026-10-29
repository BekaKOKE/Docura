import { readFileSync } from 'node:fs'
import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import type { Document, DocumentSummary, Page } from '../../services'
import { renderApp } from '../../test/renderApp'
import { quoteKey, quotesListKey } from './quoteQueries'

// S06 the list, S13 the card and S09 the share sheet (#22). Rendered to a string like the other screens' tests; the
// quotes are built by hand because a screen's tests do not import the mock (src/services/boundary.test.ts).

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

function summary(patch: Partial<DocumentSummary>): DocumentSummary {
  return {
    id: 'q-1',
    companyId: 'c-1',
    type: 'quote',
    status: 'sent',
    number: 'КП-2026-0004',
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
    issuedAt: '2026-10-20T06:00:00Z',
    signedAt: null,
    isExpired: false,
    payment: null,
    ...patch,
  }
}

function quote(patch: Partial<Document> = {}): Document {
  return {
    ...summary({}),
    periodFrom: null,
    periodTo: null,
    contractRef: null,
    clientSnapshot: { kind: 'person', name: 'Қайрат Әбілқасымов', binIin: '880715301453', phone: '+7 701 123 45 67', email: null, address: null },
    companySnapshot: {
      legalForm: 'ip',
      legalName: 'ИП Сейткали Б.',
      binIin: '850312300121',
      address: 'г. Алматы, ул. Сәтбаев, 22',
      phone: '+7 701 555 12 34',
      directorName: 'Сейткали Бекзат',
      directorPosition: 'Индивидуальный предприниматель',
      vatPayer: true,
      bankName: null,
      iik: null,
      bik: null,
      kbe: null,
    },
    basis: null,
    basisValue: null,
    vatEnabled: true,
    vatRateBp: 1600,
    notes: null,
    terms: null,
    cancelledAt: null,
    lines: [
      { id: 'l-1', position: 0, articleId: null, kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12_500, unitPriceTiyn: 1_850_000, discountBp: 0, netTiyn: 23_125_000, vatTiyn: 3_700_000, grossTiyn: 26_825_000 },
      { id: 'l-2', position: 1, articleId: null, kind: 'service', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32_000, unitPriceTiyn: 150_000, discountBp: 0, netTiyn: 4_800_000, vatTiyn: 768_000, grossTiyn: 5_568_000 },
    ],
    shareUrl: 'http://localhost:5173/p/tok123',
    signature: null,
    children: [],
    ...patch,
  }
}

const page = (items: DocumentSummary[], total = items.length): Page<DocumentSummary> => ({ items, total })

const renderList = (data?: Page<DocumentSummary>) =>
  renderApp('/documents/quotes', undefined, (client: QueryClient) => {
    if (data) client.setQueryData(quotesListKey(50), data)
  })

const renderCard = (url: string, doc: Document, extra?: (client: QueryClient) => void) =>
  renderApp(url, undefined, (client: QueryClient) => {
    client.setQueryData(quoteKey(doc.id), doc)
    extra?.(client)
  })

describe('S06 the list', () => {
  const rows = [
    summary({ id: 'q-5', status: 'draft', number: null, clientName: 'Ирина Ёлкина', grossTiyn: 1_200_000 }),
    summary({ id: 'q-4', status: 'sent', number: 'КП-2026-0004' }),
    summary({ id: 'q-3', status: 'signed', number: 'КП-2026-0003', clientName: 'ТОО «Алатау Құрылыс Сервис»', grossTiyn: 134_212_000 }),
    summary({ id: 'q-2', status: 'sent', number: 'КП-2026-0002', isExpired: true }),
  ]
  const html = renderList(page(rows))
  const visible = text(html)

  it('lists the quotes in the order the service gave (newest first), each a link to its card (AC 1)', () => {
    const at = ['q-5', 'q-4', 'q-3', 'q-2'].map((id) => html.indexOf(`href="/quotes/${id}"`))
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(html).toContain('data-screen="S06"')
  })

  it('shows number, client, amount and the status badge of each (AC 1)', () => {
    for (const word of ['КП-2026-0004', 'Ирина Ёлкина', 'Қайрат Әбілқасымов', 'ТОО «Алатау Құрылыс Сервис»', '12 000', '323 930', '1 342 120']) {
      expect(visible, word).toContain(word)
    }
    for (const badge of ['docStatus.draft', 'docStatus.quote.sent', 'docStatus.quote.signed', 'docStatus.quote.expired'] as const) {
      expect(visible, badge).toContain(t(badge))
    }
    expect(visible).toContain(t('docNumber.draft'))
  })

  it('keeps amounts and numbers on one line, and lets the client name wrap (TC-8)', () => {
    expect(html).toContain('class="dc-money"')
    expect(html).toContain('class="dc-code"')
    const css = read('./quotes.css')
    expect(css).toMatch(/\.ql-client\s*\{[^}]*-webkit-line-clamp: 2/)
    expect(css).toMatch(/\.ql-client\s*\{[^}]*overflow-wrap: anywhere/)
  })

  it('has no "show more" when everything is on the page, and one when it is not', () => {
    expect(visible).not.toContain(t('ql.more'))
    expect(text(renderList(page(rows, 120)))).toContain(t('ql.more'))
  })

  it('shows the loading skeleton before the list arrives (AC 6)', () => {
    const loading = renderList()
    expect(loading).toContain('cl-skeleton')
    expect(text(loading)).toContain(t('ql.loading'))
  })

  it('shows an empty state with one action when there are no quotes (AC 6)', () => {
    const empty = renderList(page([]))
    expect(text(empty)).toContain(t('ql.empty.title'))
    expect(empty).toMatch(/<a[^>]*href="\/quotes\/new"[^>]*>[\s\S]*?Создать КП/)
    expect(empty).not.toContain('<ul class="card cl-list"')
  })
})

describe('S13 the card', () => {
  it('a draft offers "Редактировать" and "Отправить", and shows no number (AC 3)', () => {
    const html = renderCard('/quotes/q-1', quote({ status: 'draft', number: null, shareUrl: null }))
    const visible = text(html)
    expect(html).toContain('data-screen="S13"')
    expect(html).toContain('href="/quotes/q-1/edit"')
    expect(visible).toContain(t('qd.action.send'))
    expect(visible).toContain(t('docStatus.draft'))
    expect(visible).not.toContain(t('qd.action.invoice'))
    expect(visible).not.toContain(t('qd.action.link'))
  })

  it('a sent quote has the link and neither the invoice nor the act (TC-2)', () => {
    const html = renderCard('/quotes/q-1', quote())
    const visible = text(html)
    expect(html).toContain('href="/quotes/q-1/send"')
    expect(visible).toContain(t('qd.action.link'))
    expect(visible).toContain('КП-2026-0004')
    expect(visible).toContain(t('docStatus.quote.sent'))
    expect(visible).not.toContain(t('qd.action.invoice'))
    expect(visible).not.toContain(t('qd.action.act'))
    expect(visible).not.toContain(t('qd.sign.title'))
  })

  const signed = quote({
    status: 'signed',
    signedAt: '2026-10-19T09:05:00Z',
    signature: { method: 'drawn', signerName: 'Қайрат Әбілқасымов', signedAt: '2026-10-19T09:05:00Z', documentVersion: 1 },
  })

  it('a signed quote shows "Подписано на экране 19.10.2026 в 14:05 · …" and exactly the invoice and the act (AC 2, TC-2)', () => {
    const html = renderCard('/quotes/q-1', signed)
    const visible = text(html)
    expect(visible).toContain('Подписано на экране 19.10.2026 в 14:05 · Қайрат Әбілқасымов')
    expect(visible).toContain(t('docStatus.quote.signed'))
    const actions = /<div class="qd-actions"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1]!
    expect(actions.match(/class="btn /g)).toHaveLength(2)
    expect(text(actions)).toBe(`${t('qd.action.act')} ${t('qd.action.invoice')}`)
    expect(html).toContain('href="/quotes/q-1/invoice"')
  })

  it('shows the signature image when the service has it, with a description (AC 2)', () => {
    const image = 'data:image/png;base64,iVBORw0KGgo='
    const html = renderCard('/quotes/q-1', signed, (client) => client.setQueryData(['documents', 'signature', 'q-1'], image))
    expect(html).toContain(`src="${image}"`)
    expect(html).toContain(`alt="${t('qd.sign.image')}"`)
  })

  it('shows the document the client sees, which opens full size on a tap', () => {
    const html = renderCard('/quotes/q-1', quote())
    expect(html).toContain('href="/documents/q-1/preview"')
    expect(html).toContain('data-doc="quote"')
    expect(text(html)).toContain('Укладка ламината')
  })

  it('never calls the signature legally binding (spec §7)', () => {
    const html = renderCard('/quotes/q-1', signed)
    expect(text(html)).not.toMatch(/юридическ|ЭЦП|legally/i)
  })
})

describe('S09 the share sheet', () => {
  const html = renderCard('/quotes/q-1/send', quote())
  const visible = text(html)

  it('is titled "Отправить КП-2026-NNNN" and is a dialog over the card (AC 3)', () => {
    expect(html).toContain('role="dialog"')
    expect(visible).toContain('Отправить КП-2026-0004')
    expect(html).toContain('data-screen="S09"')
  })

  it('has the message to the client, editable, with the amount, the date and the link (AC 4)', () => {
    const message = /<textarea[^>]*id="qs-message"[^>]*>([^<]*)<\/textarea>/.exec(html)![1]!
    expect(message.replace(/&#x27;|&quot;/g, '').replace(/\s/g, ' ')).toBe(
      'Здравствуйте, Қайрат! Отправляю коммерческое предложение на 323 930 ₸, действует до 03.11.2026: http://localhost:5173/p/tok123',
    )
  })

  it('opens WhatsApp for the clients number in a new tab, safely (AC 4)', () => {
    const link = /<a[^>]*href="(https:\/\/wa\.me\/[^"]+)"[^>]*>/.exec(html)
    expect(link).not.toBeNull()
    expect(link![1]).toMatch(/^https:\/\/wa\.me\/77011234567\?text=/)
    expect(html).toMatch(/<a[^>]*wa\.me[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
  })

  it('offers "Копировать ссылку" as a button', () => {
    expect(visible).toContain(t('qs.copy'))
    expect(html).toMatch(/<button[^>]*class="qs-row"/)
  })

  it('for a client with no phone: WhatsApp is off with a reason, and the copy stays (AC 4, TC-5)', () => {
    const none = renderCard('/quotes/q-1/send', quote({ clientSnapshot: { ...quote().clientSnapshot, phone: null } }))
    expect(none).not.toContain('wa.me')
    expect(none).toContain('aria-disabled="true"')
    expect(text(none)).toContain(t('qs.whatsapp.noPhone'))
    expect(text(none)).toContain(t('qs.copy'))
  })
})

describe('the quotes files follow the design rules (components.md §0)', () => {
  const css = read('./quotes.css')
  const sources = ['./QuotesListScreen.tsx', './QuoteDetailScreen.tsx', './SendScreen.tsx', './ShareSheet.tsx'].map(read).join('\n')

  it('uses tokens only: no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl)\(/)
  })

  it('puts at most two buttons side by side, and gives every target 48 px or more', () => {
    expect(css).toMatch(/\.qd-actions\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
    for (const rule of ['.qd-actions .btn', '.qs-row']) {
      const block = css.slice(css.indexOf(`${rule} {`))
      expect(block.slice(0, block.indexOf('}')), rule).toMatch(/min-height: (var\(--dc-size-control-lg\)|72px)/)
    }
  })

  it('sends every visible string through t()', () => {
    expect(sources).not.toMatch(/>\s*[А-Яа-яЁё][^<{]*</)
    expect(sources).not.toMatch(/(placeholder|aria-label|title|alt)="[А-Яа-яЁё]/)
  })
})
