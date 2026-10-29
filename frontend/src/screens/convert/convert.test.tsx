import { readFileSync } from 'node:fs'
import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import type { Document, DocumentSummary } from '../../services'
import { renderApp } from '../../test/renderApp'
import { quoteKey } from '../quotes/quoteQueries'

// S14 (#27): the screen that makes an invoice from a signed quote, as it is first drawn. Rendered to a string like the
// other screens' tests; the quote is built by hand because a screen's tests do not import the mock
// (src/services/boundary.test.ts). The rules of the invoice itself are in services/mock/convert.test.ts.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

function invoice(id: string, grossTiyn: number, patch: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id,
    companyId: 'c-1',
    type: 'invoice',
    status: 'issued',
    number: 'СЧ-2026-0001',
    issueDate: '2026-10-20',
    validUntil: null,
    dueDate: '2026-10-25',
    clientId: 'k-1',
    clientName: 'Қайрат Әбілқасымов',
    sourceDocumentId: 'q-1',
    currency: 'KZT',
    netTiyn: 0,
    vatTiyn: 0,
    grossTiyn,
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
    id: 'q-1',
    companyId: 'c-1',
    type: 'quote',
    status: 'signed',
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
    version: 2,
    issuedAt: '2026-10-20T06:00:00Z',
    signedAt: '2026-10-21T06:00:00Z',
    isExpired: false,
    payment: null,
    periodFrom: null,
    periodTo: null,
    contractRef: null,
    clientSnapshot: { kind: 'person', name: 'Қайрат Әбілқасымов', binIin: '880715301453', phone: '+7 701 123 45 67', email: null, address: null },
    companySnapshot: {
      legalForm: 'ip',
      legalName: 'ИП Сейткали Б.',
      binIin: '850312300121',
      address: 'г. Алматы',
      phone: null,
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
    lines: [],
    shareUrl: 'http://localhost:5173/p/tok',
    signature: { method: 'drawn', signerName: 'Қайрат Әбілқасымов', signedAt: '2026-10-21T06:00:00Z', documentVersion: 1 },
    children: [],
    ...patch,
  }
}

const renderScreen = (doc?: Document) =>
  renderApp('/quotes/q-1/invoice', undefined, (client: QueryClient) => {
    if (doc) client.setQueryData(quoteKey('q-1'), doc)
  })

const radios = (html: string) => [...html.matchAll(/<input[^>]*name="cv-basis"[^>]*value="([^"]+)"[^>]*>/g)].map((m) => m[1])

describe('S14 on a quote with no invoice yet', () => {
  const html = renderScreen(quote())
  const visible = text(html)

  it('is the invoice screen, with the quote, its total and what can be invoiced (AC 1, 4)', () => {
    expect(html).toContain('data-screen="S14"')
    expect(visible).toContain('КП-2026-0004')
    expect(visible).toContain('Қайрат Әбілқасымов')
    expect(visible).toContain(`${t('cv.total')} 323 930`)
    expect(visible).toContain(`${t('cv.available')} 323 930`)
    expect(visible).not.toContain(t('cv.invoiced'))
  })

  it('offers the full sum, then the two prepayments; the full sum is chosen, so three taps are enough (AC 1)', () => {
    expect(radios(html)).toEqual(['full', 'percent', 'amount'])
    const checked = [...html.matchAll(/<input[^>]*name="cv-basis"[^>]*>/g)].map((m) => m[0]).filter((tag) => tag.includes('checked'))
    expect(checked).toHaveLength(1)
    expect(checked[0]).toContain('value="full"')
    expect(visible).toContain(t('cv.basis.full'))
    expect(visible).toContain(t('cv.basis.percent'))
    expect(visible).toContain(t('cv.basis.amount'))
    expect(visible).not.toContain(t('cv.basis.remaining'))
  })

  it('shows the amount the invoice will be and one confirm button', () => {
    expect(visible).toContain('Счёт на 323 930 ₸')
    expect(html.match(/type="submit"/g)).toHaveLength(1)
    expect(visible).toContain(t('cv.confirm'))
  })
})

describe('S14 after a 50 % invoice (AC 3)', () => {
  const half = quote({ children: [invoice('i-1', 16_196_500)] })
  const html = renderScreen(half)
  const visible = text(html)

  it('offers the remainder of 161 965 ₸ and no longer the full sum', () => {
    expect(radios(html)).toEqual(['remaining', 'percent', 'amount'])
    expect(visible).toContain(t('cv.basis.remaining'))
    expect(visible).toContain('161 965')
    expect(visible).not.toContain(t('cv.basis.full'))
  })

  it('shows what is invoiced and what is still available (AC 4)', () => {
    expect(visible).toContain(`${t('cv.invoiced')} 161 965`)
    expect(visible).toContain(`${t('cv.available')} 161 965`)
  })

  it('a cancelled invoice gives its money back', () => {
    const cancelled = renderScreen(quote({ children: [invoice('i-1', 16_196_500, { status: 'cancelled' })] }))
    expect(radios(cancelled)).toEqual(['full', 'percent', 'amount'])
  })
})

describe('S14 when everything is invoiced (AC 3)', () => {
  const full = quote({ children: [invoice('i-1', 16_196_500), invoice('i-2', 16_196_500, { number: 'СЧ-2026-0002' })] })
  const html = renderScreen(full)

  it('offers nothing and says so', () => {
    expect(radios(html)).toEqual([])
    expect(html).not.toContain('type="submit"')
    expect(text(html)).toContain(t('cv.allDone'))
    expect(text(html)).toContain(`${t('cv.available')} 0`)
  })
})

describe('S14 on a quote that is not signed (AC 6)', () => {
  it.each(['draft', 'sent'] as const)('shows no way to invoice a %s quote', (status) => {
    const html = renderScreen(quote({ status, signature: null }))
    expect(html).toContain('data-state="locked"')
    expect(text(html)).toContain(t('cv.locked.title'))
    expect(html).not.toContain('name="cv-basis"')
    expect(html).not.toContain('type="submit"')
    expect(html).toContain('href="/quotes/q-1"')
  })

  it('shows the loading state before the quote arrives', () => {
    const loading = renderScreen()
    expect(loading).toContain('data-screen="S14"')
    expect(loading).toContain('data-state="loading"')
  })
})

describe('the screen follows the design rules (components.md §0)', () => {
  const css = read('./convert.css')
  const sources = ['./ConvertScreen.tsx'].map(read).join('\n')

  it('uses tokens only: no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl)\(/)
  })

  it('puts two buttons side by side at most, and keeps the targets 48 px or more', () => {
    expect(css).toMatch(/\.cv-done-actions\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
    for (const rule of ['.cv-option-row', '.cv-confirm']) {
      const block = css.slice(css.indexOf(`${rule} {`))
      expect(block.slice(0, block.indexOf('}')), rule).toMatch(/min-height: (64px|var\(--dc-size-control-lg\))/)
    }
    expect(css).toContain('minmax(0, 1fr)')
  })

  it('sends every visible string through t()', () => {
    expect(sources).not.toMatch(/>\s*[А-Яа-яЁё][^<{]*</)
    expect(sources).not.toMatch(/(placeholder|aria-label|title|alt)="[А-Яа-яЁё]/)
  })
})
