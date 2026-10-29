import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DocumentRenderer, DocumentViewport } from '../../documents'
import { DEFAULT_TIME_ZONE, formatDate, formatDateTime } from '../../documents/format'
import { t } from '../../i18n/t'
import { services, type Document } from '../../services'
import { Banner, Money } from '../clients/parts'
import { documentBadge } from '../clients/documentStatus'
import { errorText } from '../errorText'
import { ErrorState, PageLoading } from '../ui'
import { rememberQuote, signatureImage, useQuote } from './quoteQueries'
import './quotes.css'

type Props = { quote: Document; screen: 'S13' | 'S09' }

/** The card of a quote: where it stands, the next step, the document as the client sees it, and the signature. */
export function QuoteView({ quote, screen }: Props) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const badge = documentBadge(quote)
  const signed = quote.status === 'signed'
  const signature = quote.signature
  const image = useQuery({
    queryKey: ['documents', 'signature', quote.id],
    queryFn: () => signatureImage(quote.id),
    enabled: signed && signature?.method === 'drawn',
    retry: false,
  })
  const imageUrl = image.data ?? null
  const signedAt = signature ? formatDateTime(signature.signedAt, DEFAULT_TIME_ZONE) : null

  // "Отправить" on a draft: issue it (the number is assigned here), then open the share sheet.
  async function send() {
    setSending(true)
    setSendError(null)
    try {
      rememberQuote(queryClient, await services.documents.issue(quote.id))
      navigate(`/quotes/${quote.id}/send`)
    } catch (error) {
      setSendError(errorText(error))
    } finally {
      setSending(false)
    }
  }

  const sent = quote.status === 'sent' || quote.status === 'issued'

  return (
    <div className="page qd" data-screen={screen}>
      <div className="qd-head">
        <h1 className="qd-number">
          <span className="dc-code">{quote.number ?? t('docNumber.draft')}</span>
        </h1>
        <span className="cl-badge" data-tone={badge.tone}>
          {badge.label}
        </span>
      </div>
      <div className="qd-summary">
        <p className="qd-client">{quote.clientSnapshot.name}</p>
        <p className="qd-amount">
          <Money tiyn={quote.grossTiyn} />
        </p>
        {quote.validUntil && <p className="muted">{t('qd.validUntil', { date: formatDate(quote.validUntil) })}</p>}
      </div>

      {sendError && (
        <Banner tone="danger" title={t('qd.send.error')}>
          {sendError}
        </Banner>
      )}

      <div className="qd-actions" data-count={quote.status === 'draft' || signed ? 2 : sent ? 1 : 0}>
        {quote.status === 'draft' && (
          <>
            <Link className="btn btn-secondary" to={`/quotes/${quote.id}/edit`}>
              <span className="dc-label">{t('qd.action.edit')}</span>
            </Link>
            <button type="button" className="btn btn-primary" aria-busy={sending || undefined} onClick={() => void send()}>
              <span className="dc-label">{sending ? t('qd.action.sending') : t('qd.action.send')}</span>
            </button>
          </>
        )}
        {sent && (
          <Link className="btn btn-primary" to={`/quotes/${quote.id}/send`}>
            <span className="dc-label">{t('qd.action.link')}</span>
          </Link>
        )}
        {signed && (
          <>
            {/* #31 opens the form that makes the act from this quote at /acts/new. */}
            <Link className="btn btn-secondary" to={`/acts/new?quoteId=${quote.id}`}>
              <span className="dc-label">{t('qd.action.act')}</span>
            </Link>
            <Link className="btn btn-primary" to={`/quotes/${quote.id}/invoice`}>
              <span className="dc-label">{t('qd.action.invoice')}</span>
            </Link>
          </>
        )}
      </div>

      <Link className="qd-doc" to={`/documents/${quote.id}/preview`} aria-label={t('qd.openDocument')}>
        <DocumentViewport zoom="fit">
          <DocumentRenderer type="quote" document={quote} signatureImageUrl={imageUrl ?? undefined} />
        </DocumentViewport>
      </Link>

      {signed && signature && signedAt && (
        <section className="card qd-sign" aria-labelledby="qd-sign-title">
          <h2 id="qd-sign-title">{t('qd.sign.title')}</h2>
          <p>{t('qd.sign.text', { date: signedAt.date, time: signedAt.time, name: signature.signerName })}</p>
          {imageUrl ? (
            <img className="qd-sign-image" src={imageUrl} alt={t('qd.sign.image')} />
          ) : (
            image.isError && <p className="muted">{t('qd.sign.noImage')}</p>
          )}
        </section>
      )}
    </div>
  )
}

// S13: the card of one quote.
export function QuoteDetailScreen() {
  const { quoteId = '' } = useParams()
  const query = useQuote(quoteId)
  if (query.isPending || (query.isError && query.isFetching)) return <PageLoading screen="S13" />
  if (query.isError) return <ErrorState screen="S13" error={query.error} onRetry={() => void query.refetch()} />
  return <QuoteView quote={query.data} screen="S13" />
}
