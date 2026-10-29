import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { formatDate } from '../../documents/format'
import { t } from '../../i18n/t'
import { services, type DocumentSummary } from '../../services'
import { Banner, EmptyState, ListSkeleton, Money } from '../clients/parts'
import { documentBadge } from '../clients/documentStatus'
import { errorText } from '../errorText'
import { quotesListKey } from './quoteQueries'
import './quotes.css'

const PAGE_SIZE = 50
const SKELETON_ROWS = 5

function QuoteRow({ quote }: { quote: DocumentSummary }) {
  const badge = documentBadge(quote)
  return (
    <li>
      <Link className="cl-row cl-doc" to={`/quotes/${quote.id}`}>
        <span className="cl-doc-main">
          <span className="cl-doc-line">
            <span className="dc-code">{quote.number ?? t('docNumber.draft')}</span>
            <span className="ql-date">{formatDate(quote.issueDate)}</span>
          </span>
          <span className="ql-client">{quote.clientName}</span>
        </span>
        <span className="cl-doc-side">
          <span className="cl-doc-amount">
            <Money tiyn={quote.grossTiyn} />
          </span>
          <span className="cl-badge" data-tone={badge.tone}>
            {badge.label}
          </span>
        </span>
      </Link>
    </li>
  )
}

// S06: every quote of the company, newest first, with where it stands. Filter chips and search are post-MVP polish.
export function QuotesListScreen() {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const list = useQuery({
    queryKey: quotesListKey(limit),
    queryFn: () => services.documents.list({ type: 'quote', limit }),
    placeholderData: keepPreviousData,
  })

  const data = list.data
  const errorBanner = list.isError ? (
    <Banner
      tone="danger"
      title={t('ql.error.title')}
      action={
        <button type="button" className="btn btn-secondary" onClick={() => void list.refetch()}>
          <span className="dc-label">{t('state.retry')}</span>
        </button>
      }
    >
      {errorText(list.error)}
    </Banner>
  ) : null

  let body
  if (!data) {
    body = errorBanner ? null : <ListSkeleton rows={SKELETON_ROWS} label={t('ql.loading')} />
  } else if (data.total === 0) {
    body = (
      <EmptyState
        icon={FileText}
        title={t('ql.empty.title')}
        text={t('ql.empty.text')}
        action={
          <Link className="btn btn-primary" to="/quotes/new">
            <span className="dc-label">{t('ql.empty.action')}</span>
          </Link>
        }
      />
    )
  } else {
    body = (
      <>
        <ul className="card cl-list" aria-busy={list.isPlaceholderData || undefined}>
          {data.items.map((quote) => (
            <QuoteRow key={quote.id} quote={quote} />
          ))}
        </ul>
        {data.total > data.items.length && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            <span className="dc-label">{t('ql.more')}</span>
          </button>
        )}
      </>
    )
  }

  return (
    <div className="page" data-screen="S06">
      <h1 className="cl-sr-only">{t('screen.S06.title')}</h1>
      {errorBanner}
      {body}
    </div>
  )
}
