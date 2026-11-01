import { readFileSync } from 'node:fs'
import type { QueryClient } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import { ApiError, type Dashboard, type DocumentSummary } from '../../services'
import { renderApp } from '../../test/renderApp'
import { dashboardKey, DashboardView } from './DashboardScreen'
import { isQuiet, monthName, periodTitle } from './dashboardFigures'

// S04 the dashboard (#32). Rendered to a string like the other screens' tests; the figures are built by hand because a
// screen's tests do not import the mock (src/services/boundary.test.ts). The mock's own numbers are in
// services/mock/dashboard.test.ts.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

function quote(id: string, patch: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id,
    companyId: 'c-1',
    type: 'quote',
    status: 'signed',
    number: `КП-2026-${id.padStart(4, '0')}`,
    issueDate: '2026-10-12',
    validUntil: null,
    dueDate: null,
    clientId: 'k-1',
    clientName: 'Қайрат Әбілқасымов',
    sourceDocumentId: null,
    currency: 'KZT',
    netTiyn: 27_927_500,
    vatTiyn: 4_468_000,
    grossTiyn: 32_393_000, // 323 930 ₸
    version: 2,
    issuedAt: '2026-10-12T06:00:00Z',
    signedAt: '2026-10-12T07:30:00Z',
    isExpired: false,
    payment: null,
    ...patch,
  }
}

// The TC-1 figures: 64 786 ₸ in, 97 179 ₸ owed (0 late), 161 965 ₸ invoiced, 1 of 2 quotes signed.
const tc1: Dashboard = {
  from: '2026-10-01',
  to: '2026-10-31',
  awaitingSignature: { count: 1, grossTiyn: 1_392_000 },
  signed: { count: 1, grossTiyn: 32_393_000 },
  acceptanceRate: 1,
  invoicedTiyn: 16_196_500,
  cashedTiyn: 6_478_600,
  outstanding: { count: 1, balanceTiyn: 9_717_900, overdue: { count: 0, balanceTiyn: 0 } },
  toInvoice: [quote('5')],
  recentEvents: [],
}

const empty: Dashboard = {
  ...tc1,
  awaitingSignature: { count: 0, grossTiyn: 0 },
  signed: { count: 0, grossTiyn: 0 },
  acceptanceRate: null,
  invoicedTiyn: 0,
  cashedTiyn: 0,
  outstanding: { count: 0, balanceTiyn: 0, overdue: { count: 0, balanceTiyn: 0 } },
  toInvoice: [],
}

const render = (data?: Dashboard) =>
  renderApp('/', undefined, (client: QueryClient) => {
    if (data) client.setQueryData(dashboardKey, data)
  })

/** The view alone, for the states a cached query cannot show on the server (an errored query is refetched on mount). */
const view = (props: { data: Dashboard | undefined; error: unknown; fetching: boolean }) =>
  renderToString(
    <MemoryRouter>
      <DashboardView {...props} onRetry={() => {}} />
    </MemoryRouter>,
  )

describe('S04 the four tiles (AC 1, TC-1)', () => {
  const html = render(tc1)
  const visible = text(html)

  it('is the screen of the route /', () => {
    expect(html).toContain('data-screen="S04"')
    expect(visible).not.toContain(t('placeholder.route'))
  })

  it('shows what came in, what is owed with the late part, what was invoiced and how many quotes are signed', () => {
    expect(visible).toContain(`${t('db.tile.received')} 64 786`)
    expect(visible).toContain(`${t('db.tile.waiting')} 97 179`)
    expect(visible).toContain(`${t('db.tile.waiting.overdue')} 0`)
    expect(visible).toContain(`${t('db.tile.invoiced')} 161 965`)
    expect(visible).toContain(`${t('db.tile.quotes')} 1 из 2`)
  })

  it('names the month under the title', () => {
    expect(visible).toContain('Октябрь 2026')
  })

  it('puts each tile in a heading and keeps the figures on one line', () => {
    expect(html.match(/class="db-tile-label"/g)).toHaveLength(4)
    expect(html).toContain('class="dc-money"')
  })

  it('makes "Ждём оплаты" a link to the unpaid invoices, and no other tile a link', () => {
    expect(html).toMatch(/<a[^>]*href="\/documents\/invoices\?filter=unpaid"[^>]*>[\s\S]*?Ждём оплаты/)
    expect(html.match(/db-tile-link/g)).toHaveLength(1)
  })

  it('marks the late part in the danger tone only when something is late', () => {
    expect(html).not.toContain('data-tone="danger"')
    const late = render({ ...tc1, outstanding: { count: 2, balanceTiyn: 12_000_000, overdue: { count: 1, balanceTiyn: 2_000_000 } } })
    expect(late).toContain('data-tone="danger"')
    expect(text(late)).toContain(`${t('db.tile.waiting.overdue')} 20 000`)
    expect(text(late)).toContain(`${t('db.tile.waiting')} 120 000`)
  })

  it('counts N of M as the signed quotes over the signed and the waiting ones', () => {
    const three = render({ ...tc1, signed: { count: 3, grossTiyn: 0 }, awaitingSignature: { count: 1, grossTiyn: 0 } })
    expect(text(three)).toContain(`${t('db.tile.quotes')} 3 из 4`)
  })
})

describe('S04 "Подписано — выставьте счёт" (AC 3)', () => {
  const rows = [quote('5'), quote('2', { clientName: 'ТОО «Алатау Құрылыс Сервис»', grossTiyn: 13_421_200 })]
  const html = render({ ...tc1, toInvoice: rows })
  const visible = text(html)

  it('lists the quotes in the order the service gave them, each a link to the convert screen', () => {
    expect(visible).toContain(t('db.toInvoice.title'))
    const at = ['5', '2'].map((id) => html.indexOf(`href="/quotes/${id}/invoice"`))
    expect(at.every((i) => i > 0)).toBe(true)
    expect(at[0]).toBeLessThan(at[1]!)
  })

  it('shows client, number and total, and the [Счёт] cue', () => {
    for (const word of ['Қайрат Әбілқасымов', 'ТОО «Алатау Құрылыс Сервис»', 'КП-2026-0005', '323 930', '134 212']) {
      expect(visible, word).toContain(word)
    }
    expect(visible).toContain(t('db.toInvoice.action'))
  })

  it('names a row for a screen reader: client, number, total, what the tap does', () => {
    expect(html).toMatch(/aria-label="Қайрат Әбілқасымов, КП-2026-0005, 323.930 тенге, выставить счёт"/)
  })

  it('shows at most what the service gave (up to 5)', () => {
    const five = Array.from({ length: 5 }, (_, i) => quote(String(i + 1)))
    expect(render({ ...tc1, toInvoice: five }).match(/href="\/quotes\/\d\/invoice"/g)).toHaveLength(5)
  })

  it('has no list when nothing waits for an invoice', () => {
    const none = render({ ...tc1, toInvoice: [] })
    expect(text(none)).not.toContain(t('db.toInvoice.title'))
    expect(none).not.toContain('/invoice"')
  })
})

describe('S04 states (AC 4, TC-4)', () => {
  it('empty month: 0 ₸ in every tile, "За октябрь пока ничего" and one action: create a quote', () => {
    const html = render(empty)
    const visible = text(html)
    expect(visible).toContain(`${t('db.tile.received')} 0`)
    expect(visible).toContain(`${t('db.tile.invoiced')} 0`)
    expect(visible).toContain(`${t('db.tile.quotes')} 0 из 0`)
    expect(visible).toContain('За октябрь пока ничего')
    expect(html).toMatch(/<a[^>]*href="\/quotes\/new"[^>]*>[\s\S]*?Создать КП/)
    // The shell has its own "Создать КП" in the sidebar: count the buttons of the page itself.
    expect(html.slice(html.indexOf('data-screen="S04"')).match(/class="btn /g)).toHaveLength(1)
  })

  it('a month with money in it does not say "пока ничего"', () => {
    expect(text(render(tc1))).not.toContain('пока ничего')
  })

  it('a month with no activity is quiet even when older invoices or quotes still wait (AC 4)', () => {
    expect(isQuiet({ ...empty, toInvoice: [quote('5')] })).toBe(true)
    expect(isQuiet({ ...empty, outstanding: { count: 1, balanceTiyn: 100, overdue: { count: 0, balanceTiyn: 0 } } })).toBe(true)
    expect(isQuiet({ ...empty, cashedTiyn: 1 })).toBe(false)
    expect(isQuiet({ ...empty, invoicedTiyn: 1 })).toBe(false)
    expect(isQuiet(empty)).toBe(true)
  })

  it('names the month in words from the period', () => {
    expect(monthName('2026-03-01')).toBe('март')
    expect(monthName('2026-12-01')).toBe('декабрь')
    expect(periodTitle('2026-05-01')).toBe('Май 2026')
  })

  it('loading: a skeleton, and no figures yet', () => {
    const html = render()
    expect(html).toContain('cl-skeleton')
    expect(text(html)).toContain(t('db.loading'))
    expect(html).not.toContain('db-tile')
  })

  it('error: a banner with "Повторить" and no fake zeros', () => {
    const html = view({ data: undefined, error: new ApiError({ code: 'rate_limited', message: 'Слишком много попыток' }), fetching: false })
    expect(html).toContain('role="alert"')
    expect(text(html)).toContain(t('db.error.title'))
    expect(text(html)).toContain('Слишком много попыток')
    expect(text(html)).toContain(t('state.retry'))
    expect(html).not.toContain('db-tile')
    expect(text(html)).not.toContain('0 ₸')
  })

  it('error after an earlier load: the banner only, without the figures kept from it (TC-4)', () => {
    const html = view({ data: empty, error: new ApiError({ code: 'rate_limited', message: 'Слишком много попыток' }), fetching: false })
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('db-tile')
    expect(text(html)).not.toContain('0 ₸')
    expect(text(html)).not.toContain('пока ничего')
  })

  it('after "Повторить" the screen shows the skeleton again, not an empty page', () => {
    const html = view({ data: undefined, error: new ApiError({ code: 'rate_limited', message: 'Слишком много попыток' }), fetching: true })
    expect(html).toContain('cl-skeleton')
  })
})

describe('the dashboard files follow the design rules (components.md §0)', () => {
  const css = read('./dashboard.css')
  const source = read('./DashboardScreen.tsx')

  it('uses tokens only: no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl)\(/)
  })

  it('keeps the grids shrinkable, one tile per row on a phone, and a target of 48 px or more', () => {
    expect(css).toMatch(/\.db-tiles\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/)
    expect(css).toMatch(/\.db-tile\s*\{[^}]*min-height: 72px/)
  })

  it('sends every visible string through t()', () => {
    expect(source).not.toMatch(/>\s*[А-Яа-яЁё][^<{]*</)
    expect(source).not.toMatch(/(placeholder|aria-label|title|alt)="[А-Яа-яЁё]/)
  })
})
