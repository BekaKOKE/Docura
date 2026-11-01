import { useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { t } from '../../i18n/t'
import { ApiError, isApiError, services } from '../../services'
import { quoteKey, useQuote } from '../quotes/quoteQueries'
import { ErrorState, PageLoading } from '../ui'
import { activeActOf } from './actRules'
import { ActView } from './ActView'
import './acts.css'

/** An idempotency key for one request: the same key twice makes one act (a repeated tap, a lost answer). */
function newRequestId(): string {
  return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** What the screen shows while the act is being made from a quote. */
function Creating() {
  return (
    <div className="page act" data-screen="S18" data-state="creating" role="status" aria-busy="true">
      <p className="act-creating">{t('act.new.creating')}</p>
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <div className="skeleton skeleton-block" aria-hidden="true" />
    </div>
  )
}

/** The quote is open and signed and has no act: ask the service for one, once, and go to it. */
function CreateAct({ quoteId }: { quoteId: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [failure, setFailure] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  // One key for this visit: the effect running twice (strict mode) or a retry is the same request, never a second act.
  const requestId = useRef(newRequestId())

  useEffect(() => {
    let current = true
    services.documents
      .convert(quoteId, { target: 'act', clientRequestId: requestId.current })
      .then(async (act) => {
        if (!current) return
        queryClient.setQueryData(quoteKey(act.id), act)
        void queryClient.invalidateQueries({ queryKey: quoteKey(quoteId) })
        void queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
        navigate(`/acts/${act.id}`, { replace: true })
      })
      .catch(async (error: unknown) => {
        if (!current) return
        // Someone made the act a moment ago (another tab): open that one.
        if (isApiError(error) && error.code === 'document_locked') {
          try {
            const quote = await services.documents.get(quoteId)
            const existing = activeActOf(quote)
            if (existing) {
              queryClient.setQueryData(quoteKey(quoteId), quote)
              if (current) navigate(`/acts/${existing.id}`, { replace: true })
              return
            }
          } catch {
            // The message below is the better answer.
          }
        }
        setFailure(error)
      })
    return () => {
      current = false
    }
  }, [quoteId, attempt, queryClient, navigate])

  if (failure) {
    return (
      <ErrorState
        screen="S18"
        error={failure}
        onRetry={() => {
          setFailure(null)
          setAttempt((n) => n + 1)
        }}
      />
    )
  }
  return <Creating />
}

/** /acts/new?quoteId=…: "Создать акт" on a signed quote. A quote that has an act opens it instead of making a second. */
function NewActScreen() {
  const [params] = useSearchParams()
  const quoteId = params.get('quoteId') ?? ''
  const query = useQuote(quoteId)

  if (quoteId === '') {
    return <ErrorState screen="S18" error={new ApiError({ code: 'not_found', message: t('act.new.noQuote') })} onRetry={() => {}} />
  }
  if (query.isPending || (query.isError && query.isFetching)) return <PageLoading screen="S18" />
  if (query.isError) return <ErrorState screen="S18" error={query.error} onRetry={() => void query.refetch()} />

  const quote = query.data
  if (quote.type !== 'quote' || quote.status !== 'signed') {
    return (
      <div className="page act" data-screen="S18" data-state="locked">
        <div className="act-locked" role="status">
          <TriangleAlert aria-hidden="true" />
          <h1>{t('act.new.locked.title')}</h1>
          <p>{t('act.new.locked.text')}</p>
          <Link className="btn btn-secondary" to={`/quotes/${quote.id}`}>
            <span className="dc-label">{t('act.new.locked.back')}</span>
          </Link>
        </div>
      </div>
    )
  }
  const existing = activeActOf(quote)
  if (existing) return <Navigate to={`/acts/${existing.id}`} replace />
  return <CreateAct key={quote.id} quoteId={quote.id} />
}

function ActById({ id }: { id: string }) {
  const query = useQuote(id)
  if (query.isPending || (query.isError && query.isFetching)) return <PageLoading screen="S18" />
  if (query.isError) return <ErrorState screen="S18" error={query.error} onRetry={() => void query.refetch()} />
  // Any document has an address here, but only an act is shown as one: a quote's id is "not found" on this page.
  if (query.data.type !== 'act') {
    return <ErrorState screen="S18" error={new ApiError({ code: 'not_found', message: t('apiError.not_found') })} onRetry={() => void query.refetch()} />
  }
  return <ActView act={query.data} />
}

// S18: the card of one act, and (at /acts/new) the step that makes the act from a signed quote.
export function ActDetailScreen() {
  const { actId = '' } = useParams()
  if (actId === 'new') return <NewActScreen />
  return <ActById id={actId} />
}
