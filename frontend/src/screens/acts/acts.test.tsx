import { readFileSync } from 'node:fs'
import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { plainText } from '../../documents/fixtures'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import type { Document, DocumentSummary } from '../../services'
import { renderApp } from '../../test/renderApp'
import { quoteKey } from '../quotes/quoteQueries'
import { shareMessage } from '../quotes/share'
import { actsListKey } from './actQueries'

// The acts list, the act's card (S18) and the step that makes an act from a quote (#31). Rendered to a string like the
// other screens' tests; the documents are built by hand because a screen's tests do not import the mock
// (src/services/boundary.test.ts).

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

function summary(patch: Partial<DocumentSummary>): DocumentSummary {
  return {
    id: 'a-1',
    companyId: 'c-1',
    type: 'act',
    status: 'issued',
    number: 'АВР-2026-0002',
    issueDate: '2026-10-20',
    validUntil: null,
    dueDate: null,
    clientId: 'k-1',
    clientName: 'Қайрат Әбілқасымов',
    sourceDocumentId: 'q-1',
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

function document(patch: Partial<Document> = {}): Document {
  return {
    ...summary({}),
    periodFrom: '2026-10-15',
    periodTo: '2026-10-18',
    contractRef: 'Договор № 15 от 01.10.2026',
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
      { id: 'l-1', position: 0, articleId: null, kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12_500, unitPriceTiyn: 1_850_000, discountBp: 0, netTiyn: 23_125_000, vatTiyn: 3_700_000, grossTiyn: 26_825_000, workDate: '2026-10-15' },
      { id: 'l-2', position: 1, articleId: null, kind: 'material', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32_000, unitPriceTiyn: 150_000, discountBp: 0, netTiyn: 4_800_000, vatTiyn: 768_000, grossTiyn: 5_568_000, workDate: '2026-10-18' },
    ],
    shareUrl: 'http://localhost:5173/p/token-123',
    signature: null,
    children: [],
    ...patch,
  }
}

const draft = (patch: Partial<Document> = {}) => document({ status: 'draft', number: null, issuedAt: null, shareUrl: null, ...patch })
const quote = (patch: Partial<Document> = {}) =>
  document({ id: 'q-1', type: 'quote', status: 'signed', number: 'КП-2026-0004', sourceDocumentId: null, periodFrom: null, periodTo: null, contractRef: null, validUntil: '2026-11-03', ...patch })

const withCards = (...docs: Document[]) => (client: QueryClient) => {
  for (const doc of docs) client.setQueryData(quoteKey(doc.id), doc)
}

describe('the acts list (Документы › Акты, AC 4, TC-4)', () => {
  const items = [
    summary({ id: 'a-3', status: 'draft', number: null, clientName: 'ТОО «Алатау Құрылыс Сервис»', grossTiyn: 10_000_000 }),
    summary({ id: 'a-2', number: 'АВР-2026-0002' }),
    summary({ id: 'a-1', number: 'АВР-2026-0001', issueDate: '2026-10-08', grossTiyn: 4_524_000, status: 'signed' }),
  ]
  const html = renderApp('/documents/acts', undefined, (client) => client.setQueryData(actsListKey(50), { items, total: 3 }))
  const visible = text(html)

  it('is the ACTS screen, not a placeholder', () => {
    expect(html).toContain('data-screen="ACTS"')
    expect(html).not.toContain('#31')
  })

  it('lists the acts in the order the service gave (newest first), each a link to its card', () => {
    const at = ['a-3', 'a-2', 'a-1'].map((id) => html.indexOf(`href="/acts/${id}"`))
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('shows number, client, amount and status of each row', () => {
    for (const word of ['АВР-2026-0002', 'АВР-2026-0001', 'Қайрат Әбілқасымов', 'ТОО «Алатау Құрылыс Сервис»', '323 930', '45 240', '100 000']) {
      expect(visible, word).toContain(word)
    }
    expect(visible).toContain(t('docNumber.draft'))
    expect(visible).toContain(t('docStatus.draft'))
    expect(visible).toContain(t('docStatus.act.issued'))
    expect(visible).toContain(t('docStatus.act.signed'))
  })

  it('keeps amounts and numbers on one line and lets the client name wrap', () => {
    expect(html).toContain('class="dc-money"')
    expect(html).toContain('class="dc-code"')
  })

  it('has no "show more" when everything is on the page', () => {
    expect(visible).not.toContain(t('act.list.more'))
  })

  it('says there are no acts yet and points to the quotes', () => {
    const empty = renderApp('/documents/acts', undefined, (client) => client.setQueryData(actsListKey(50), { items: [], total: 0 }))
    expect(text(empty)).toContain(t('act.list.empty.title'))
    expect(empty).toContain('href="/documents/quotes"')
  })

  it('shows a skeleton while loading', () => {
    const loading = renderApp('/documents/acts')
    expect(loading).toContain('aria-busy="true"')
    expect(text(loading)).toContain(t('act.list.loading'))
  })

  it('offers "Показать ещё" when the service has more than the page', () => {
    const more = renderApp('/documents/acts', undefined, (client) => client.setQueryData(actsListKey(50), { items, total: 80 }))
    expect(text(more)).toContain(t('act.list.more'))
  })
})

describe('S18 the card of a draft act (AC 1, AC 2, TC-1)', () => {
  const html = renderApp('/acts/a-1', undefined, withCards(draft()))
  const visible = text(html)

  it('is the S18 screen in its draft state, with no number yet', () => {
    expect(html).toContain('data-screen="S18"')
    expect(html).toContain('data-state="draft"')
    expect(visible).toContain(t('docNumber.draft'))
    expect(visible).toContain(t('docStatus.draft'))
    expect(visible).toContain('323 930')
  })

  it('holds the contract reference, the period and a work date per line in editable fields', () => {
    const input = (id: string) => html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? ''
    expect(input('act-contract-ref')).toContain('value="Договор № 15 от 01.10.2026"')
    for (const [id, date] of [['act-period-from', '2026-10-15'], ['act-period-to', '2026-10-18'], ['act-work-date-0', '2026-10-15'], ['act-work-date-1', '2026-10-18']] as const) {
      expect(input(id), id).toContain('type="date"')
      expect(input(id), id).toContain(`value="${date}"`)
    }
    expect(visible).toContain('Укладка ламината')
    expect(visible).toContain('Плинтус, монтаж')
  })

  it('has two buttons side by side, "Сохранить" and "Выставить", and neither submits the form', () => {
    const actions = html.slice(html.indexOf('class="qd-actions"'))
    expect(actions).toContain('data-count="2"')
    expect(visible).toContain(t('act.card.action.save'))
    expect(visible).toContain(t('act.card.action.issue'))
    // A submit button would issue the act when Enter is pressed in a field, and an issued act can't be taken back.
    expect(html).not.toContain('type="submit"')
  })

  it('draws the act as it will print, under the form, and links to the full-size preview', () => {
    expect(html).toContain('href="/documents/a-1/preview"')
    expect(html).toContain('data-doc="act"')
    expect(plainText(html)).toContain('Акт выполненных работ (оказанных услуг)* (черновик)')
    expect(plainText(html)).toContain('Отчётный период: с 15.10.2026 по 18.10.2026')
  })

  it('has no send button before the act is issued, and a way back to the quote', () => {
    expect(visible).not.toContain(t('act.card.action.send'))
    expect(html).toContain('href="/quotes/q-1"')
  })
})

describe('S18 the card of an issued act (AC 2, TC-2)', () => {
  const html = renderApp('/acts/a-1', undefined, withCards(document()))
  const visible = text(html)

  it('is read-only: the number, the status and the period, and no fields', () => {
    expect(html).toContain('data-state="issued"')
    expect(visible).toContain('АВР-2026-0002')
    expect(visible).toContain(t('docStatus.act.issued'))
    expect(visible).toContain(t('act.card.period', { from: '15.10.2026', to: '18.10.2026' }))
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<form')
  })

  it('offers "Отправить" and a way back to the quote, and says the act is signed on paper', () => {
    expect(visible).toContain(t('act.card.action.send'))
    expect(visible).toContain(t('act.card.action.quote'))
    expect(visible).toContain(t('act.card.printHint'))
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*><span class="dc-label">Отправить/)
  })

  it('draws the act with its number', () => {
    expect(html).toContain('data-doc="act"')
    expect(plainText(html)).toContain('Акт выполненных работ (оказанных услуг)* № АВР-2026-0002')
  })

  it('has no claim about a signature on screen: the act is signed on paper in the MVP (spec D5)', () => {
    const lower = visible.toLowerCase()
    for (const banned of ['юридически значим', 'юридическую силу', 'эцп', 'legally binding', 'подписано на экране']) {
      expect(lower, banned).not.toContain(banned)
    }
  })

  it('does not show a quote as an act: its id is "not found" here', () => {
    const wrong = renderApp('/acts/q-1', undefined, withCards(quote()))
    expect(wrong).toContain('data-state="error"')
    expect(text(wrong)).toContain(t('apiError.not_found'))
  })
})

describe('S18 /acts/new: the step behind "Создать акт" (AC 1, TC-1, TC-6)', () => {
  it('makes the act of a signed quote that has none, and says so while it waits', () => {
    const html = renderApp('/acts/new?quoteId=q-1', undefined, withCards(quote()))
    expect(html).toContain('data-screen="S18"')
    expect(html).toContain('data-state="creating"')
    expect(text(html)).toContain(t('act.new.creating'))
  })

  it('opens the act that already exists instead of making a second one', () => {
    const existing = summary({ id: 'a-9', status: 'draft', number: null })
    const html = renderApp('/acts/new?quoteId=q-1', undefined, withCards(quote({ children: [existing] })))
    expect(html).not.toContain('data-state="creating"')
  })

  it('makes a new act when the only earlier one is cancelled', () => {
    const cancelled = summary({ id: 'a-9', status: 'cancelled' })
    const html = renderApp('/acts/new?quoteId=q-1', undefined, withCards(quote({ children: [cancelled] })))
    expect(html).toContain('data-state="creating"')
  })

  it.each([['sent'], ['draft'], ['declined']] as const)('does not make an act of a %s quote', (status) => {
    const html = renderApp('/acts/new?quoteId=q-1', undefined, withCards(quote({ status })))
    expect(html).toContain('data-state="locked"')
    expect(text(html)).toContain(t('act.new.locked.title'))
    expect(html).toContain('href="/quotes/q-1"')
  })

  it('asks which quote when the address names none', () => {
    const html = renderApp('/acts/new')
    expect(html).toContain('data-state="error"')
    expect(text(html)).toContain(t('act.new.noQuote'))
  })
})

describe('the message of the share sheet for an act', () => {
  it('greets the client by name, gives the amount and the link, and says nothing about a deadline', () => {
    const message = shareMessage(document())
    expect(message).toBe(`Здравствуйте, Қайрат! Отправляю акт выполненных работ на сумму ${formatMoney(32_393_000)}: http://localhost:5173/p/token-123`)
  })
})

describe('acts.css', () => {
  const css = read('./acts.css')
  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })
  it('lets every grid shrink, so nothing widens the page at 360 px', () => {
    expect(css).not.toMatch(/grid-template-columns:\s*1fr/)
  })
})
