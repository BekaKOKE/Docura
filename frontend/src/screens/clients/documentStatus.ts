import type { MessageKey } from '../../i18n/t'
import { t } from '../../i18n/t'
import type { DocumentSummary } from '../../services'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface DocumentBadge {
  label: string
  tone: BadgeTone
}

/**
 * The StatusBadge of a document row (components.md "StatusBadge"): the words and the tint. Derived from the
 * summary alone, so the client card needs no second call.
 */
export function documentBadge(doc: DocumentSummary): DocumentBadge {
  if (doc.status === 'cancelled') return { label: t('docStatus.cancelled'), tone: 'neutral' }
  if (doc.status === 'draft') return { label: t('docStatus.draft'), tone: 'neutral' }

  if (doc.type === 'quote') {
    if (doc.status === 'signed') return { label: t('docStatus.quote.signed'), tone: 'success' }
    if (doc.status === 'declined') return { label: t('docStatus.quote.declined'), tone: 'danger' }
    if (doc.isExpired) return { label: t('docStatus.quote.expired'), tone: 'warning' }
    return { label: t('docStatus.quote.sent'), tone: 'info' }
  }

  if (doc.type === 'invoice') {
    const payment = doc.payment
    if (payment?.state === 'paid') return { label: t('docStatus.invoice.paid'), tone: 'success' }
    if (payment?.state === 'overdue') return { label: t('docStatus.invoice.overdue'), tone: 'danger' }
    if (payment?.state === 'partial') {
      const percent = Math.round((payment.paidTiyn / doc.grossTiyn) * 100)
      return { label: t('docStatus.invoice.partial', { percent }), tone: 'warning' }
    }
    return { label: t('docStatus.invoice.issued'), tone: 'info' }
  }

  return doc.status === 'signed'
    ? { label: t('docStatus.act.signed'), tone: 'success' }
    : { label: t('docStatus.act.issued'), tone: 'info' }
}

export const documentTypeKey = (type: DocumentSummary['type']): MessageKey => `docType.${type}`

/** Where a tap on the document goes: the editor for a draft quote, otherwise the card of that kind (S13, S16, S18). */
export function documentPath(doc: DocumentSummary): string {
  if (doc.type === 'quote') return doc.status === 'draft' ? `/quotes/${doc.id}/edit` : `/quotes/${doc.id}`
  return doc.type === 'invoice' ? `/invoices/${doc.id}` : `/acts/${doc.id}`
}
