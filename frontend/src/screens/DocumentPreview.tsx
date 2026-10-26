import { useQuery } from '@tanstack/react-query'
import { CircleAlert, Download, ZoomIn, ZoomOut } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { DocumentRenderer, DocumentViewport, hasRenderer, printDocument, type Zoom } from '../documents'
import { t } from '../i18n/t'
import { isApiError, services, type Document } from '../services'
import './preview.css'

// S08, Предпросмотр: the document as the client will see it and as it prints (components.md §2, S08).
// On a phone the A4 sheet is scaled to the screen width, with "Крупнее" for the real size (the sheet then scrolls
// inside its own box); a sticky bar holds "Скачать PDF". On a desktop the sheet shows at full size.
// The side-by-side preview next to the editor is EditorWithPreview (src/documents), used by the editor (#19).

/** The Russian sentence for a failed call: an ApiError carries one, anything else gets the general text. */
function errorText(error: unknown): string {
  return isApiError(error) ? error.message : t('preview.error.generic')
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="pv" data-screen="S08">
      {children}
    </div>
  )
}

export function PreviewLoading() {
  return (
    <Frame>
      <div className="pv-stage">
        <div className="pv-skeleton" role="status" aria-busy="true">
          <span className="pv-sr-only">{t('preview.loading')}</span>
        </div>
      </div>
    </Frame>
  )
}

export function PreviewError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const unauthorized = isApiError(error) && error.code === 'unauthorized'
  return (
    <Frame>
      <div className="pv-banner" role="alert">
        <CircleAlert aria-hidden="true" />
        <div className="pv-banner-text">
          <strong>{t('preview.error.title')}</strong>
          <span>{errorText(error)}</span>
        </div>
        <div className="pv-banner-actions">
          <button type="button" className="btn btn-secondary btn-block" onClick={onRetry}>
            <span className="dc-label">{t('preview.retry')}</span>
          </button>
          {unauthorized && (
            <Link className="btn btn-primary btn-block" to="/login">
              <span className="dc-label">{t('preview.login')}</span>
            </Link>
          )}
        </div>
      </div>
    </Frame>
  )
}

/** A type with no renderer yet (the act, #31): a plain notice instead of a blank sheet. */
export function PreviewNotBuilt() {
  return (
    <Frame>
      <p className="pv-notice">{t('preview.actPending')}</p>
    </Frame>
  )
}

interface PreviewReadyProps {
  document: Document
  zoom: Zoom
  onZoom: (zoom: Zoom) => void
  onPrint: () => void
}

export function PreviewReady({ document, zoom, onZoom, onPrint }: PreviewReadyProps) {
  const actual = zoom === 'actual'
  return (
    <Frame>
      <div className="pv-stage">
        <DocumentViewport zoom={zoom}>
          <DocumentRenderer type={document.type} document={document} />
        </DocumentViewport>
      </div>
      <div className="pv-bar no-print">
        {/* The sheet fits a desktop at full size, so the zoom button is a phone control (preview.css). */}
        <button type="button" className="btn btn-secondary pv-zoom" onClick={() => onZoom(actual ? 'fit' : 'actual')}>
          {actual ? <ZoomOut aria-hidden="true" /> : <ZoomIn aria-hidden="true" />}
          <span className="dc-label">{t(actual ? 'preview.zoomOut' : 'preview.zoomIn')}</span>
        </button>
        <button type="button" className="btn btn-primary pv-print" onClick={onPrint}>
          <Download aria-hidden="true" />
          <span className="dc-label">{t('preview.print')}</span>
        </button>
      </div>
    </Frame>
  )
}

export function DocumentPreview() {
  const { documentId = '' } = useParams()
  const [zoom, setZoom] = useState<Zoom>('fit')
  const query = useQuery({
    queryKey: ['documents', 'detail', documentId],
    queryFn: () => services.documents.get(documentId),
  })

  // After "Повторить" the failed query is fetching again: show the loading state, not the old error.
  if (query.isPending || (query.isError && query.isFetching)) return <PreviewLoading />
  if (query.isError) return <PreviewError error={query.error} onRetry={() => void query.refetch()} />

  const document = query.data
  if (!hasRenderer(document.type)) return <PreviewNotBuilt />
  // The page title is the file name Chrome offers for the PDF.
  const fileName = document.number ?? t(document.type === 'invoice' ? 'doc.invoice.title' : 'doc.quote.title')
  return <PreviewReady document={document} zoom={zoom} onZoom={setZoom} onPrint={() => void printDocument(fileName)} />
}
