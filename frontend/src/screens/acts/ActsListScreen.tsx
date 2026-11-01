import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { formatDate } from '../../documents/format'
import { t } from '../../i18n/t'
import { services, type DocumentSummary } from '../../services'
import { documentBadge } from '../clients/documentStatus'
import { Banner, EmptyState, ListSkeleton, Money } from '../clients/parts'
import { errorText } from '../errorText'
import { actsListKey } from './actQueries'
import '../quotes/quotes.css'
import './acts.css'

const PAGE_SIZE = 50
const SKELETON_ROWS = 5

function ActRow({ act }: { act: DocumentSummary }) {
  const badge = documentBadge(act)
  return (
    <li>
      <Link className="cl-row cl-doc" to={`/acts/${act.id}`}>
        <span className="cl-doc-main">
          <span className="cl-doc-line">
            <span className="dc-code">{act.number ?? t('docNumber.draft')}</span>
            <span className="ql-date">{formatDate(act.issueDate)}</span>
          </span>
          <span className="ql-client">{act.clientName}</span>
        </span>
        <span className="cl-doc-side">
          <span className="cl-doc-amount">
            <Money tiyn={act.grossTiyn} />
          </span>
          <span className="cl-badge" data-tone={badge.tone}>
            {badge.label}
          </span>
        </span>
      </Link>
    </li>
  )
}

// Документы › Акты: every act of the company, newest first, with number, client, amount and status. Acts are made
// from a signed quote, so the empty state points there.
export function ActsListScreen() {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const list = useQuery({
    queryKey: actsListKey(limit),
    queryFn: () => services.documents.list({ type: 'act', limit }),
    placeholderData: keepPreviousData,
  })

  const data = list.data
  const errorBanner = list.isError ? (
    <Banner
      tone="danger"
      title={t('act.list.error.title')}
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
    // After "Повторить" the failed query is fetching again: show the loading state, not nothing.
    body = errorBanner && !list.isFetching ? null : <ListSkeleton rows={SKELETON_ROWS} label={t('act.list.loading')} />
  } else if (data.total === 0) {
    body = (
      <EmptyState
        icon={ClipboardCheck}
        title={t('act.list.empty.title')}
        text={t('act.list.empty.text')}
        action={
          <Link className="btn btn-secondary" to="/documents/quotes">
            <span className="dc-label">{t('act.list.empty.action')}</span>
          </Link>
        }
      />
    )
  } else {
    body = (
      <>
        <ul className="card cl-list" aria-busy={list.isPlaceholderData || undefined}>
          {data.items.map((act) => (
            <ActRow key={act.id} act={act} />
          ))}
        </ul>
        {data.total > data.items.length && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            <span className="dc-label">{t('act.list.more')}</span>
          </button>
        )}
      </>
    )
  }

  return (
    <div className="page" data-screen="ACTS">
      <h1 className="cl-sr-only">{t('screen.ACTS.title')}</h1>
      {errorBanner}
      {body}
    </div>
  )
}
