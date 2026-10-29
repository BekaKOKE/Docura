import { Navigate, useNavigate, useParams } from 'react-router'
import { ErrorState, PageLoading } from '../ui'
import { QuoteView } from './QuoteDetailScreen'
import { useQuote } from './quoteQueries'
import { ShareSheet } from './ShareSheet'

// S09: the share sheet over the quote's card. A draft has no number and no link yet, so it goes back to its card,
// where "Отправить" issues it first.
export function SendScreen() {
  const { quoteId = '' } = useParams()
  const navigate = useNavigate()
  const query = useQuote(quoteId)

  if (query.isPending || (query.isError && query.isFetching)) return <PageLoading screen="S09" />
  if (query.isError) return <ErrorState screen="S09" error={query.error} onRetry={() => void query.refetch()} />

  const quote = query.data
  if (quote.status === 'draft' || quote.shareUrl === null) return <Navigate to={`/quotes/${quote.id}`} replace />

  return (
    <>
      <QuoteView quote={quote} screen="S09" />
      <ShareSheet quote={quote} onClose={() => navigate(`/quotes/${quote.id}`, { replace: true })} />
    </>
  )
}
