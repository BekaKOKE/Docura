import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { DocumentRenderer, DocumentViewport } from '../../documents'
import { formatDate } from '../../documents/format'
import { t } from '../../i18n/t'
import { ApiError, services, type Document, type Payment } from '../../services'
import { Banner, ListSkeleton, Money } from '../clients/parts'
import { errorText } from '../errorText'
import { ErrorState, PageLoading } from '../ui'
import { useQuote } from '../quotes/quoteQueries'
import { ShareSheet } from '../quotes/ShareSheet'
import { invoiceBadge, isPartlyPaid, percentPaid } from './invoiceStatus'
import './invoices.css'

export const paymentsKey = (invoiceId: string) => ['payments', invoiceId] as const

function PaymentRow({ payment }: { payment: Payment }) {
  return (
    <li className="iv-payment">
      <span className="iv-payment-main">
        <span className="iv-payment-method">{t(`pay.method.${payment.method}`)}</span>
        <span className="iv-payment-date">{formatDate(payment.paidOn)}</span>
        {payment.note && <span className="iv-payment-note">{payment.note}</span>}
      </span>
      <span className="iv-payment-amount">
        <Money tiyn={payment.amountTiyn} />
      </span>
    </li>
  )
}

function Payments({ invoiceId }: { invoiceId: string }) {
  const query = useQuery({ queryKey: paymentsKey(invoiceId), queryFn: () => services.payments.list(invoiceId) })
  let body
  if (query.isPending) body = <ListSkeleton rows={1} label={t('id.payments.loading')} />
  else if (query.isError) {
    body = (
      <Banner
        tone="danger"
        title={t('id.payments.error')}
        action={
          <button type="button" className="btn btn-secondary" onClick={() => void query.refetch()}>
            <span className="dc-label">{t('state.retry')}</span>
          </button>
        }
      >
        {errorText(query.error)}
      </Banner>
    )
  } else if (query.data.length === 0) body = <p className="muted">{t('id.payments.empty')}</p>
  else {
    body = (
      <ul className="card iv-payments">
        {query.data.map((payment) => (
          <PaymentRow key={payment.id} payment={payment} />
        ))}
      </ul>
    )
  }
  return (
    <section aria-labelledby="iv-payments-title">
      <h2 id="iv-payments-title" className="iv-label">
        {t('id.payments')}
      </h2>
      {body}
    </section>
  )
}

/** The card of an invoice: where it stands, what is paid and what is left, the document and the payments. */
export function InvoiceView({ invoice }: { invoice: Document }) {
  const [shareOpen, setShareOpen] = useState(false)
  const [now] = useState(() => new Date())
  const badge = invoiceBadge(invoice, now)
  const paid = invoice.payment?.paidTiyn ?? 0
  const balance = invoice.payment?.balanceTiyn ?? invoice.grossTiyn
  const percent = percentPaid(invoice)

  return (
    <div className="page iv" data-screen="S16">
      <div className="qd-head">
        <h1 className="qd-number">
          <span className="dc-code">{invoice.number ?? t('docNumber.draft')}</span>
        </h1>
        <span className="cl-badge" data-tone={badge.tone}>
          {badge.label}
        </span>
      </div>
      <div className="qd-summary">
        <p className="qd-client">{invoice.clientSnapshot.name}</p>
        <p className="qd-amount">
          <Money tiyn={invoice.grossTiyn} />
        </p>
        {invoice.dueDate && <p className="muted">{t('id.dueDate', { date: formatDate(invoice.dueDate) })}</p>}
        {invoice.contractRef && <p className="muted">{invoice.contractRef}</p>}
      </div>

      <dl className="iv-state">
        <div>
          <dt>{t('id.paid')}</dt>
          <dd>
            <Money tiyn={paid} />
          </dd>
        </div>
        <div className="iv-state-balance">
          <dt>{t('id.balance')}</dt>
          <dd>
            <Money tiyn={balance} />
          </dd>
        </div>
      </dl>
      {isPartlyPaid(invoice) && (
        <span className="iv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('il.progress', { percent })}>
          <span className="iv-progress-fill" style={{ width: `${percent}%` }} />
        </span>
      )}

      <div className="qd-actions" data-count={invoice.sourceDocumentId ? 2 : 1}>
        {invoice.sourceDocumentId && (
          <Link className="btn btn-secondary" to={`/quotes/${invoice.sourceDocumentId}`}>
            <span className="dc-label">{t('id.action.quote')}</span>
          </Link>
        )}
        <button type="button" className="btn btn-primary" aria-haspopup="dialog" disabled={!invoice.shareUrl} onClick={() => setShareOpen(true)}>
          <span className="dc-label">{t('id.action.send')}</span>
        </button>
      </div>

      <Payments invoiceId={invoice.id} />

      <Link className="qd-doc" to={`/documents/${invoice.id}/preview`} aria-label={t('id.openDocument')}>
        <DocumentViewport zoom="fit">
          <DocumentRenderer type="invoice" document={invoice} />
        </DocumentViewport>
      </Link>

      {shareOpen && <ShareSheet quote={invoice} onClose={() => setShareOpen(false)} />}
    </div>
  )
}

// S16: the card of one invoice. Recording a payment on it is #30.
export function InvoiceDetailScreen() {
  const { invoiceId = '' } = useParams()
  const query = useQuote(invoiceId)
  if (query.isPending || (query.isError && query.isFetching)) return <PageLoading screen="S16" />
  if (query.isError) return <ErrorState screen="S16" error={query.error} onRetry={() => void query.refetch()} />
  // Any document has an address here, but only an invoice is shown as one: a quote's id is "not found" on this page.
  if (query.data.type !== 'invoice') {
    return <ErrorState screen="S16" error={new ApiError({ code: 'not_found', message: t('apiError.not_found') })} onRetry={() => void query.refetch()} />
  }
  return <InvoiceView invoice={query.data} />
}
