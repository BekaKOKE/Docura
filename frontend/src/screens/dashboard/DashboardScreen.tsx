import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FilePlus2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import { services, type Dashboard, type DocumentSummary } from '../../services'
import { Banner, EmptyState, ListSkeleton, Money } from '../clients/parts'
import { errorText } from '../errorText'
import { isQuiet, monthName, periodTitle } from './dashboardFigures'
import './dashboard.css'

export const dashboardKey = ['dashboard'] as const

const SKELETON_TILES = 4

interface TileProps {
  label: string
  to?: string
  children: ReactNode
  sub?: ReactNode
}

// components.md section 5, "KPI tiles": a label (a heading), the figure, a line under it. The whole tile is a link when it leads somewhere.
function Tile({ label, to, children, sub }: TileProps) {
  const body = (
    <>
      <div className="db-tile-text">
        <h2 className="db-tile-label">{label}</h2>
        <span className="db-tile-value">{children}</span>
        {sub}
      </div>
      {to && <ChevronRight aria-hidden="true" />}
    </>
  )
  return to ? (
    <Link className="card db-tile db-tile-link" to={to}>
      {body}
    </Link>
  ) : (
    <div className="card db-tile">{body}</div>
  )
}

/** "Қайрат Әбілқасымов, КП-2026-0012, 323 930 тенге, выставить счёт": the name of a row for a screen reader. */
function rowName(quote: DocumentSummary): string {
  const amount = formatMoney(quote.grossTiyn).replace(/\s*₸$/, '')
  return [quote.clientName, quote.number ?? t('docNumber.draft'), `${amount} ${t('money.tengeWord')}`, t('db.toInvoice.rowAction')].join(', ')
}

function ToInvoiceList({ quotes }: { quotes: DocumentSummary[] }) {
  return (
    <section className="db-section" aria-labelledby="db-to-invoice">
      <h2 id="db-to-invoice" className="db-section-title">
        {t('db.toInvoice.title')}
      </h2>
      <ul className="card cl-list">
        {quotes.map((quote) => (
          <li key={quote.id}>
            <Link className="cl-row db-row" to={`/quotes/${quote.id}/invoice`} aria-label={rowName(quote)}>
              <span className="db-row-main">
                <span className="ql-client">{quote.clientName}</span>
                <span className="dc-code db-row-number">{quote.number ?? t('docNumber.draft')}</span>
              </span>
              <span className="db-row-side">
                <span className="db-row-amount">
                  <Money tiyn={quote.grossTiyn} />
                </span>
                <span className="db-row-action" aria-hidden="true">
                  {t('db.toInvoice.action')}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface ViewProps {
  data: Dashboard | undefined
  error: unknown
  /** True while a request is on its way (after "Повторить" the screen shows the loading state again). */
  fetching: boolean
  onRetry: () => void
}

// What S04 shows for the state of its query. An error shows the banner and nothing else: no fake zeros.
export function DashboardView({ data, error, fetching, onRetry }: ViewProps) {
  const errorBanner =
    error != null ? (
      <Banner
        tone="danger"
        title={t('db.error.title')}
        action={
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <span className="dc-label">{t('state.retry')}</span>
          </button>
        }
      >
        {errorText(error)}
      </Banner>
    ) : null

  let body: ReactNode = null
  if (!data) {
    // After "Повторить" the failed query is fetching again: show the loading state, not nothing.
    body = errorBanner && !fetching ? null : <ListSkeleton rows={SKELETON_TILES} label={t('db.loading')} />
  } else {
    const overdue = data.outstanding.overdue.balanceTiyn
    body = (
      <>
        <div className="db-tiles">
          <Tile label={t('db.tile.received')}>
            <Money tiyn={data.cashedTiyn} />
          </Tile>
          <Tile
            label={t('db.tile.waiting')}
            to="/documents/invoices?filter=unpaid"
            sub={
              <span className="db-tile-sub" data-tone={overdue > 0 ? 'danger' : undefined}>
                {t('db.tile.waiting.overdue')} <Money tiyn={overdue} />
              </span>
            }
          >
            <Money tiyn={data.outstanding.balanceTiyn} />
          </Tile>
          <Tile label={t('db.tile.invoiced')}>
            <Money tiyn={data.invoicedTiyn} />
          </Tile>
          <Tile label={t('db.tile.quotes')}>
            <span className="dc-money">
              {t('db.tile.quotes.value', { signed: data.signed.count, total: data.signed.count + data.awaitingSignature.count })}
            </span>
          </Tile>
        </div>
        {isQuiet(data) && (
          <EmptyState
            icon={FilePlus2}
            title={t('db.nothing.title', { month: monthName(data.from) })}
            text={t('db.nothing.text')}
            action={
              <Link className="btn btn-primary" to="/quotes/new">
                <span className="dc-label">{t('db.nothing.action')}</span>
              </Link>
            }
          />
        )}
        {data.toInvoice.length > 0 && <ToInvoiceList quotes={data.toInvoice} />}
      </>
    )
  }

  return (
    <div className="page db" data-screen="S04">
      <header className="db-head">
        <h1>{t('screen.S04.title')}</h1>
        {data && <p className="muted">{periodTitle(data.from)}</p>}
      </header>
      {errorBanner}
      {body}
    </div>
  )
}

// S04: the month in four tiles (what came in, what is owed with the late part, what was invoiced, how many quotes got
// signed) and the signed quotes still waiting for an invoice. The "Нужно сделать" rows, recent events, the period picker
// and the first-run checklist are post-MVP polish.
export function DashboardScreen() {
  const dashboard = useQuery({ queryKey: dashboardKey, queryFn: () => services.dashboard.get() })
  return (
    <DashboardView
      data={dashboard.data}
      error={dashboard.isError ? dashboard.error : null}
      fetching={dashboard.isFetching}
      onRetry={() => void dashboard.refetch()}
    />
  )
}
