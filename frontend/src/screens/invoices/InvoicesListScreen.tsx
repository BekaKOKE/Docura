import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import { services, type DocumentSummary, type Page } from '../../services'
import { Banner, EmptyState, ListSkeleton, Money } from '../clients/parts'
import { errorText } from '../errorText'
import { invoiceBadge, isPartlyPaid, owesMoney, percentPaid, shortDate, waitingOf } from './invoiceStatus'
import './invoices.css'

// The service gives at most 200 invoices at a time. The strip adds up every invoice, so the screen asks again until
// it has them all; the rows are shown 50 at a time.
const FETCH_LIMIT = 200
const PAGE_SIZE = 50
const SKELETON_ROWS = 5

export const invoicesListKey = ['documents', 'list', { type: 'invoice', limit: FETCH_LIMIT }] as const

async function fetchAllInvoices(): Promise<Page<DocumentSummary>> {
  const items: DocumentSummary[] = []
  for (;;) {
    const page = await services.documents.list({ type: 'invoice', limit: FETCH_LIMIT, offset: items.length })
    items.push(...page.items)
    if (page.items.length === 0 || items.length >= page.total) return { items, total: page.total }
  }
}

/** "Қайрат, СЧ-2026-0014, 246 400 тенге, Оплачен на 40%, до 24.10, остаток …": the name of a row for a screen reader, in this order. */
function rowName(invoice: DocumentSummary, badge: string): string {
  const amount = formatMoney(invoice.grossTiyn).replace(/\s*₸$/, '')
  const parts = [invoice.clientName, invoice.number ?? t('docNumber.draft'), `${amount} ${t('money.tengeWord')}`, badge]
  if (invoice.dueDate) parts.push(t('il.due', { date: shortDate(invoice.dueDate) }))
  if (isPartlyPaid(invoice)) parts.push(t('il.balance', { amount: formatMoney(invoice.payment?.balanceTiyn ?? 0) }))
  return parts.join(', ')
}

function InvoiceRow({ invoice, now }: { invoice: DocumentSummary; now: Date }) {
  const badge = invoiceBadge(invoice, now)
  const partly = isPartlyPaid(invoice)
  const percent = percentPaid(invoice)
  return (
    <li>
      <Link className="cl-row iv-row" to={`/invoices/${invoice.id}`} aria-label={rowName(invoice, badge.label)}>
        <span className="iv-main">
          <span className="iv-line">
            <span className="ql-client">{invoice.clientName}</span>
            <span className="iv-amount">
              <Money tiyn={invoice.grossTiyn} />
            </span>
          </span>
          <span className="iv-line iv-meta">
            <span className="dc-code">{invoice.number ?? t('docNumber.draft')}</span>
            {invoice.dueDate && <span className="iv-due">{t('il.due', { date: shortDate(invoice.dueDate) })}</span>}
            <span className="cl-badge" data-tone={badge.tone}>
              {badge.label}
            </span>
          </span>
          {partly && (
            <>
              <span
                className="iv-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={t('il.progress', { percent })}
              >
                <span className="iv-progress-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="iv-balance">{t('il.balance', { amount: formatMoney(invoice.payment?.balanceTiyn ?? 0) })}</span>
            </>
          )}
        </span>
      </Link>
    </li>
  )
}

// S15: every invoice of the company, newest first, with who owes what. S21 is the same list narrowed to the unpaid
// ones (?filter=unpaid), the page the dashboard opens. Filter chips, search and the desktop table are post-MVP polish.
export function InvoicesListScreen() {
  const [params] = useSearchParams()
  const unpaidOnly = params.get('filter') === 'unpaid'
  // One instance per filter, so the number of rows shown starts again when the filter changes.
  return <InvoicesList key={String(unpaidOnly)} unpaidOnly={unpaidOnly} />
}

function InvoicesList({ unpaidOnly }: { unpaidOnly: boolean }) {
  const [shown, setShown] = useState(PAGE_SIZE)
  const list = useQuery({
    queryKey: invoicesListKey,
    queryFn: fetchAllInvoices,
    placeholderData: keepPreviousData,
  })

  // The day the badges are counted from is the day the screen was opened.
  const [now] = useState(() => new Date())
  const data = list.data
  const errorBanner = list.isError ? (
    <Banner
      tone="danger"
      title={t('il.error.title')}
      action={
        <button type="button" className="btn btn-secondary" onClick={() => void list.refetch()}>
          <span className="dc-label">{t('state.retry')}</span>
        </button>
      }
    >
      {errorText(list.error)}
    </Banner>
  ) : null

  // "Unpaid" is exactly what the strip counts as owed, so the list and the strip never disagree.
  const rows = data ? data.items.filter((invoice) => !unpaidOnly || owesMoney(invoice)) : []

  let body
  if (!data) {
    // After "Повторить" the failed query is fetching again: show the loading state, not nothing.
    body = errorBanner && !list.isFetching ? null : <ListSkeleton rows={SKELETON_ROWS} label={t('il.loading')} />
  } else if (rows.length === 0 && unpaidOnly && data.items.length > 0) {
    // There are invoices, and every one is paid: that is good news, not "no invoices yet".
    body = <EmptyState icon={Receipt} title={t('il.empty.unpaid.title')} text={t('il.empty.unpaid.text')} />
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon={Receipt}
        title={t('il.empty.title')}
        text={t('il.empty.text')}
        action={
          <Link className="btn btn-secondary" to="/documents/quotes">
            <span className="dc-label">{t('il.empty.action')}</span>
          </Link>
        }
      />
    )
  } else {
    body = (
      <>
        <ul className="card cl-list" aria-busy={list.isPlaceholderData || undefined}>
          {rows.slice(0, shown).map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} now={now} />
          ))}
        </ul>
        {rows.length > shown && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            <span className="dc-label">{t('il.more')}</span>
          </button>
        )}
      </>
    )
  }

  const waiting = data ? waitingOf(data.items) : null

  return (
    <div className="page" data-screen={unpaidOnly ? 'S21' : 'S15'}>
      <h1 className="cl-sr-only">{t(unpaidOnly ? 'screen.S21.title' : 'screen.S15.title')}</h1>
      {waiting && data && data.items.length > 0 && (
        <p className="card iv-strip">
          <span>
            {t('il.waiting')} <Money tiyn={waiting.waitingTiyn} />
          </span>
          <span aria-hidden="true"> · </span>
          <span>
            {t('il.overdue')} <Money tiyn={waiting.overdueTiyn} />
          </span>
        </p>
      )}
      {errorBanner}
      {body}
    </div>
  )
}
