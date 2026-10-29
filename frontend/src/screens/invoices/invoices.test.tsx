import { readFileSync } from 'node:fs'
import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { daysBetween, todayInZone } from '../../domain/dates'
import { t } from '../../i18n/t'
import type { Document, DocumentSummary, Payment, PaymentState } from '../../services'
import { renderApp } from '../../test/renderApp'
import { quoteKey } from '../quotes/quoteQueries'
import { paymentsKey } from './InvoiceDetailScreen'
import { invoicesListKey } from './InvoicesListScreen'

// S15 and S21 the invoice list, S16 the invoice's card (#28). Rendered to a string like the other screens' tests; the
// invoices are built by hand because a screen's tests do not import the mock (src/services/boundary.test.ts).

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

const today = todayInZone('Asia/Almaty', new Date())
const daysAgo = (days: number) => {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! - days)).toISOString().slice(0, 10)
}

function summary(id: string, state: PaymentState, gross: number, paid = 0, patch: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id,
    companyId: 'c-1',
    type: 'invoice',
    status: 'issued',
    number: `СЧ-2026-${id.padStart(4, '0')}`,
    issueDate: '2026-10-01',
    validUntil: null,
    dueDate: daysAgo(-5),
    clientId: 'k-1',
    clientName: 'Қайрат Әбілқасымов',
    sourceDocumentId: 'q-1',
    currency: 'KZT',
    netTiyn: gross,
    vatTiyn: 0,
    grossTiyn: gross,
    version: 1,
    issuedAt: '2026-10-01T06:00:00Z',
    signedAt: null,
    isExpired: false,
    payment: { state, paidTiyn: paid, balanceTiyn: gross - paid },
    ...patch,
  }
}

const rows = [
  summary('4', 'unpaid', 16_196_500), // A: 161 965 ₸
  summary('3', 'partial', 10_000_000, 4_000_000), // B: 100 000 ₸, 40 000 paid
  summary('2', 'overdue', 5_000_000, 0, { dueDate: daysAgo(7), clientName: 'ТОО «Алатау Құрылыс Сервис»' }), // X: 50 000 ₸
  summary('1', 'paid', 9_000_000, 9_000_000),
]

const renderList = (url = '/documents/invoices', items?: DocumentSummary[]) =>
  renderApp(url, undefined, (client: QueryClient) => {
    if (items) client.setQueryData(invoicesListKey, { items, total: items.length })
  })

describe('S15 the invoice list', () => {
  const html = renderList('/documents/invoices', rows)
  const visible = text(html)

  it('shows the strip with what is owed and what is late (AC 1, TC-1)', () => {
    expect(html).toContain('data-screen="S15"')
    // 161 965 + (100 000 - 40 000) + 50 000 = 271 965 waiting; 50 000 of it overdue
    expect(visible).toContain(`${t('il.waiting')} 271 965`)
    expect(visible).toContain(`${t('il.overdue')} 50 000`)
  })

  it('lists the invoices in the order the service gave (newest first), each a link to its card (AC 4)', () => {
    const at = ['4', '3', '2', '1'].map((id) => html.indexOf(`href="/invoices/${id}"`))
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('shows client, total, number, due date and the badge of each row (AC 2)', () => {
    for (const word of ['Қайрат Әбілқасымов', 'ТОО «Алатау Құрылыс Сервис»', '161 965', 'СЧ-2026-0004', 'СЧ-2026-0001']) {
      expect(visible, word).toContain(word)
    }
    expect(visible).toContain(t('il.due', { date: daysAgo(-5).slice(8) + '.' + daysAgo(-5).slice(5, 7) }))
  })

  it('shows "Оплачен на 40%" with a bar at 40 % and the balance for a partly paid invoice (TC-2)', () => {
    expect(visible).toContain('Оплачен на 40%')
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="40"/)
    expect(html).toContain('style="width:40%"')
    expect(visible).toContain(t('il.balance', { amount: '60 000 ₸' }).replace(/\s/g, ' '))
  })

  it('shows "Просрочен 7 дн." for an overdue one and "Оплачен" for a paid one, with a bar for neither (TC-2)', () => {
    expect(visible).toContain('Просрочен 7 дн.')
    expect(visible).toContain('>Оплачен<'.slice(1, -1))
    expect(html.match(/role="progressbar"/g)).toHaveLength(1)
  })

  it('names each row for a screen reader: client, number, total, status', () => {
    expect(html).toMatch(/aria-label="Қайрат Әбілқасымов, СЧ-2026-0003, 100.000 тенге, Оплачен на 40%, /)
  })

  it('keeps amounts and numbers on one line, and lets the client name wrap (TC-5)', () => {
    expect(html).toContain('class="dc-money"')
    expect(html).toContain('class="dc-code"')
    expect(read('./invoices.css')).toMatch(/\.iv-line > \.ql-client\s*\{[^}]*min-width: 0/)
  })

  it('has no "show more" when everything is on the page', () => {
    expect(visible).not.toContain(t('il.more'))
  })
})

describe('S21 the unpaid invoices', () => {
  it('is the same list without the paid ones', () => {
    const html = renderList('/documents/invoices?filter=unpaid', rows)
    expect(html).toContain('data-screen="S21"')
    expect(html).toContain('href="/invoices/4"')
    expect(html).toContain('href="/invoices/2"')
    expect(html).not.toContain('href="/invoices/1"')
  })
})

describe('S21 and the strip agree (review of #28)', () => {
  const withDraft = [...rows, summary('9', 'unpaid', 7_000_000, 0, { status: 'draft', number: null })]

  it('does not list a draft as unpaid, and does not count it in the strip', () => {
    const html = renderList('/documents/invoices?filter=unpaid', withDraft)
    expect(html).not.toContain('href="/invoices/9"')
    expect(text(html)).toContain(`${t('il.waiting')} 271 965`)
  })

  it('says every invoice is paid when that is so, with no link to the quotes', () => {
    const html = renderList('/documents/invoices?filter=unpaid', [summary('1', 'paid', 9_000_000, 9_000_000)])
    expect(text(html)).toContain(t('il.empty.unpaid.title'))
    expect(text(html)).not.toContain('Счетов пока нет')
    expect(text(html)).not.toContain(t('il.empty.action'))
  })

  it('names a partly paid row with its due date and balance, which the label would otherwise hide', () => {
    expect(renderList('/documents/invoices', rows)).toMatch(/aria-label="Қайрат Әбілқасымов, СЧ-2026-0003, [^"]*Оплачен на 40%, до \d\d\.\d\d, остаток 60.000/)
  })
})

describe('S15 states (AC 4)', () => {
  it('loading: a skeleton before the list arrives', () => {
    const html = renderList()
    expect(html).toContain('cl-skeleton')
    expect(text(html)).toContain(t('il.loading'))
  })

  it('empty: "Счетов пока нет" with a link to the quotes', () => {
    const html = renderList('/documents/invoices', [])
    expect(text(html)).toContain('Счетов пока нет')
    expect(html).toMatch(/<a[^>]*href="\/documents\/quotes"[^>]*>[\s\S]*?К коммерческим предложениям/)
    expect(html).not.toContain('class="card iv-strip"')
  })
})

// ---------------------------------------------------------------- S16

function invoiceDoc(patch: Partial<Document> = {}): Document {
  return {
    ...summary('3', 'partial', 10_000_000, 4_000_000, { number: 'СЧ-2026-0003' }),
    periodFrom: null,
    periodTo: null,
    contractRef: 'КП № КП-2026-0004 от 20.10.2026',
    clientSnapshot: { kind: 'person', name: 'Қайрат Әбілқасымов', binIin: '880715301453', phone: '+7 701 123 45 67', email: null, address: null },
    companySnapshot: {
      legalForm: 'ip',
      legalName: 'ИП Сейткали Б.',
      binIin: '850312300121',
      address: 'г. Алматы',
      phone: null,
      directorName: 'Сейткали Бекзат',
      directorPosition: 'Индивидуальный предприниматель',
      vatPayer: false,
      bankName: null,
      iik: null,
      bik: null,
      kbe: null,
    },
    basis: 'full',
    basisValue: null,
    vatEnabled: false,
    vatRateBp: 1600,
    notes: null,
    terms: null,
    cancelledAt: null,
    lines: [
      { id: 'l-1', position: 0, articleId: null, kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 5_000, unitPriceTiyn: 2_000_000, discountBp: 0, netTiyn: 10_000_000, vatTiyn: 0, grossTiyn: 10_000_000 },
    ],
    shareUrl: 'http://localhost:5173/p/tokinv',
    signature: null,
    children: [],
    ...patch,
  }
}

const payment: Payment = { id: 'p-1', companyId: 'c-1', documentId: '3', amountTiyn: 4_000_000, currency: 'KZT', method: 'kaspi', paidOn: '2026-10-18', note: 'Предоплата по Kaspi' }

const renderCard = (doc: Document, payments?: Payment[]) =>
  renderApp('/invoices/3', undefined, (client: QueryClient) => {
    client.setQueryData(quoteKey('3'), doc)
    if (payments) client.setQueryData(paymentsKey('3'), payments)
  })

describe('S16 the invoice card', () => {
  const html = renderCard(invoiceDoc(), [payment])
  const visible = text(html)

  it('shows the number, the badge, the client, the total and the due date (AC 3)', () => {
    expect(html).toContain('data-screen="S16"')
    for (const word of ['СЧ-2026-0003', 'Оплачен на 40%', 'Қайрат Әбілқасымов', '100 000', 'КП № КП-2026-0004 от 20.10.2026']) {
      expect(visible, word).toContain(word)
    }
    expect(visible).toContain(t('id.dueDate', { date: invoiceDoc().dueDate!.split('-').reverse().join('.') }))
  })

  it('shows what is paid, what is left and the bar (AC 3, TC-4)', () => {
    expect(visible).toContain(`${t('id.paid')} 40 000`)
    expect(visible).toContain(`${t('id.balance')} 60 000`)
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="40"/)
  })

  it('lists the payment with its method, date and amount (TC-4)', () => {
    expect(visible).toContain('Kaspi')
    expect(visible).toContain('18.10.2026')
    expect(visible).toContain('40 000')
    expect(visible).toContain('Предоплата по Kaspi')
  })

  it('says there are no payments yet when there are none', () => {
    expect(text(renderCard(invoiceDoc({ payment: { state: 'unpaid', paidTiyn: 0, balanceTiyn: 10_000_000 } }), []))).toContain(t('id.payments.empty'))
  })

  it('has "Отправить" for the share sheet and a way back to the quote (AC 3)', () => {
    expect(visible).toContain(t('id.action.send'))
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>\s*<span class="dc-label">Отправить<\/span>/)
    expect(html).toContain('href="/quotes/q-1"')
  })

  it('shows the invoice document, which opens full size on a tap', () => {
    expect(html).toContain('href="/documents/3/preview"')
    expect(html).toContain('data-doc="invoice"')
  })

  it("does not show a quote as an invoice: a quote's id is not found here", () => {
    const html = renderCard(invoiceDoc({ type: 'quote', number: 'КП-2026-0004', payment: null }), [])
    expect(html).toContain('data-state="error"')
    expect(html).not.toContain('data-screen="S16"><div class="qd-head"')
    expect(text(html)).not.toContain('КП-2026-0004')
  })

  it('shows no payment bar when nothing is paid', () => {
    expect(renderCard(invoiceDoc({ payment: { state: 'unpaid', paidTiyn: 0, balanceTiyn: 10_000_000 } }), [])).not.toContain('role="progressbar"')
  })
})

describe('the invoice files follow the design rules (components.md §0)', () => {
  const css = read('./invoices.css')
  const sources = ['./InvoicesListScreen.tsx', './InvoiceDetailScreen.tsx', './invoiceStatus.ts'].map(read).join('\n')

  it('uses tokens only: no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl)\(/)
  })

  it('keeps the grids shrinkable and gives a payment row a target of 48 px or more', () => {
    expect(css).toContain('minmax(0, 1fr)')
    const block = css.slice(css.indexOf('.iv-payment {'))
    expect(block.slice(0, block.indexOf('}'))).toMatch(/min-height: 64px/)
  })

  it('sends every visible string through t()', () => {
    expect(sources).not.toMatch(/>\s*[А-Яа-яЁё][^<{]*</)
    expect(sources).not.toMatch(/(placeholder|aria-label|title|alt)="[А-Яа-яЁё]/)
  })

  it('counts the overdue days with the same calendar the screens use', () => {
    expect(daysBetween(daysAgo(7), today)).toBe(7)
  })
})
