import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Download, LinkIcon, Phone, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { DocumentRenderer, printDocument } from '../../documents'
import { DEFAULT_TIME_ZONE, formatDate, formatDateTime, formatQty, taxIdLabel } from '../../documents/format'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import { isApiError, services, type PublicDocument } from '../../services'
import { errorText } from '../errorText'
import { SigningSheet } from './SigningSheet'
import './public.css'

const publicKey = (token: string) => ['public', token] as const

/** `tel:+77015551234` from how the phone is written. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** The page is for the client only: search engines must not list it (components.md §3, "Trust and security cues"). */
function NoIndex() {
  return <meta name="robots" content="noindex" />
}

function Frame({ state, children }: { state?: string; children: ReactNode }) {
  return (
    <div className="pub" data-screen="S11" data-state={state}>
      <NoIndex />
      {children}
    </div>
  )
}

export function PublicLoading() {
  return (
    // Not "loading": that is what the session guard calls its own state.
    <Frame state="pending">
      <div className="pub-skeleton" role="status" aria-busy="true">
        <span className="sr-only">{t('pub.loading')}</span>
        <div className="skeleton skeleton-title" aria-hidden="true" />
        <div className="skeleton skeleton-block" aria-hidden="true" />
        <div className="skeleton skeleton-block" aria-hidden="true" />
        <div className="skeleton skeleton-block" aria-hidden="true" />
      </div>
    </Frame>
  )
}

/** A withdrawn or unknown link: no document data at all. */
export function PublicGone() {
  return (
    <Frame state="gone">
      <section className="pub-gone" aria-labelledby="pub-gone-title">
        <LinkIcon aria-hidden="true" />
        <h1 id="pub-gone-title">{t('pub.gone.title')}</h1>
        <p>{t('pub.gone.text')}</p>
      </section>
    </Frame>
  )
}

function Money({ tiyn }: { tiyn: number }) {
  const text = formatMoney(tiyn)
  return (
    <span className="dc-money">
      {text.replace(/\s*₸$/, '')}
      <span aria-hidden="true">&nbsp;₸</span>
      <span className="sr-only"> {t('money.tengeWord')}</span>
    </span>
  )
}

function CompanyBlock({ doc }: { doc: PublicDocument }) {
  const company = doc.companySnapshot
  return (
    <header className="pub-company">
      {doc.logoUrl && <img className="pub-logo" src={doc.logoUrl} alt={t('pub.logo', { name: company.legalName })} />}
      <div className="pub-company-text">
        <p className="pub-company-name">{company.legalName}</p>
        <p className="pub-company-line">
          {t(taxIdLabel(company))} <span className="dc-code">{company.binIin}</span>
        </p>
        <p className="pub-company-line">{company.address}</p>
        {company.phone && (
          <a className="pub-phone" href={telHref(company.phone)}>
            <Phone aria-hidden="true" />
            <span className="dc-code">{company.phone}</span>
          </a>
        )}
      </div>
    </header>
  )
}

function Lines({ doc }: { doc: PublicDocument }) {
  return (
    <section aria-labelledby="pub-lines-title">
      <h2 id="pub-lines-title" className="pub-label">
        {t('pub.lines')}
      </h2>
      <ol className="pub-lines">
        {doc.lines.map((line) => (
          <li key={line.id} className="card pub-line">
            <span className="pub-line-title">{line.title}</span>
            <span className="pub-line-total">
              <Money tiyn={line.netTiyn} />
            </span>
            <span className="pub-line-meta">
              {t('pub.line.times', { qty: formatQty(line.qtyMilli), unit: line.unit, price: formatMoney(line.unitPriceTiyn) })}
            </span>
            {doc.vatEnabled && <span className="pub-line-vat dc-money">{t('pub.line.vat', { amount: formatMoney(line.vatTiyn) })}</span>}
          </li>
        ))}
      </ol>
      <dl className="pub-totals">
        <div>
          <dt>{t('pub.totals.net')}</dt>
          <dd>
            <Money tiyn={doc.netTiyn} />
          </dd>
        </div>
        {doc.vatEnabled && (
          <div>
            <dt>{t('pub.totals.vat', { rate: String(doc.vatRateBp / 100) })}</dt>
            <dd>
              <Money tiyn={doc.vatTiyn} />
            </dd>
          </div>
        )}
        <div className="pub-totals-gross">
          <dt>{t('pub.totals.gross')}</dt>
          <dd>
            <Money tiyn={doc.grossTiyn} />
          </dd>
        </div>
      </dl>
    </section>
  )
}

function Notice({ tone, children }: { tone: 'success' | 'warning' | 'neutral'; children: ReactNode }) {
  const Icon = tone === 'success' ? CircleCheck : tone === 'warning' ? TriangleAlert : CircleAlert
  return (
    <div className="pub-notice" data-tone={tone} role={tone === 'warning' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div className="pub-notice-text">{children}</div>
    </div>
  )
}

interface ViewProps {
  doc: PublicDocument
  token: string
  /** Load the document again (the sheet noticed a change). */
  onReload: () => void
  /** The service accepted the signature. */
  onSigned: (signed: PublicDocument) => void
  /** True right after this visitor signed: the success screen is shown. */
  justSigned: boolean
}

export function PublicView({ doc, token, onReload, onSigned, justSigned }: ViewProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const success = useRef<HTMLElement>(null)
  // The sheet that was opened from "Подписать" is gone with it: the success note takes the focus, and is read out.
  useEffect(() => {
    if (justSigned) success.current?.focus()
  }, [justSigned])
  const fileName = doc.number ?? t('doc.quote.title')
  const signature = doc.signature
  const signedAt = signature ? formatDateTime(signature.signedAt, DEFAULT_TIME_ZONE) : null
  const signed = doc.status === 'signed' && signature !== null
  const company = doc.companySnapshot

  const printButton = (
    <button type="button" className="btn btn-ghost btn-block" onClick={() => void printDocument(fileName)}>
      <Download aria-hidden="true" />
      <span className="dc-label">{t('pub.pdf')}</span>
    </button>
  )

  return (
    <Frame state={justSigned ? 'success' : signed ? 'signed' : doc.isExpired ? 'expired' : 'ready'}>
      <div className="pub-screen">
        <CompanyBlock doc={doc} />

        {justSigned && signature && signedAt && (
          <section ref={success} className="pub-success" role="status" tabIndex={-1} aria-labelledby="pub-success-title">
            <CircleCheck aria-hidden="true" />
            <h1 id="pub-success-title">{t('pub.success.title')}</h1>
            <p className="pub-success-when">{t('pub.success.when', { date: signedAt.date, time: signedAt.time })}</p>
            <p>{t('pub.success.text')}</p>
          </section>
        )}

        <section className="pub-head" aria-label={t('doc.quote.title')}>
          {!justSigned && <h1 className="pub-title">{t('doc.quote.title')}</h1>}
          {justSigned && <p className="pub-title">{t('doc.quote.title')}</p>}
          <p className="pub-number">
            {t('pub.number', { number: doc.number ?? '', date: formatDate(doc.issueDate) })}
          </p>
          <p className="pub-amount">
            <Money tiyn={doc.grossTiyn} />
          </p>
          <p className="muted">
            {doc.validUntil && `${t('pub.validUntil', { date: formatDate(doc.validUntil) })} · `}
            {doc.vatEnabled ? t('pub.withVat', { rate: String(doc.vatRateBp / 100) }) : t('pub.noVat')}
          </p>
        </section>

        {!justSigned && signed && signature && signedAt && (
          <Notice tone="success">
            {t('pub.signed.banner', { date: signedAt.date, time: signedAt.time, name: signature.signerName })}
          </Notice>
        )}
        {!signed && doc.isExpired && doc.validUntil && (
          <Notice tone="warning">
            {t('pub.expired', { date: formatDate(doc.validUntil) })}
            {company.phone && (
              <a className="btn btn-secondary btn-block pub-call" href={telHref(company.phone)}>
                <Phone aria-hidden="true" />
                <span className="dc-label">{t('pub.call')}</span>
              </a>
            )}
          </Notice>
        )}
        {!signed && !doc.isExpired && !doc.canSign && <Notice tone="neutral">{t('pub.closed')}</Notice>}

        <Lines doc={doc} />

        {doc.notes && (
          <section>
            <h2 className="pub-label">{t('pub.notes')}</h2>
            <p className="pub-notes">{doc.notes}</p>
          </section>
        )}

        {signed && doc.signatureImageUrl && (
          <img className="pub-signature" src={doc.signatureImageUrl} alt={t('pub.signed.image')} />
        )}

        {printButton}

        {doc.canSign && !justSigned && (
          <div className="pub-actions">
            <button type="button" className="btn btn-primary btn-block" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
              <span className="dc-label">{t('pub.sign')}</span>
            </button>
          </div>
        )}

        <footer className="pub-footer">
          <p>{t('pub.footer')}</p>
          <p>{t('pub.footer.record')}</p>
        </footer>
      </div>

      {/* The sheet that prints is this one: "Скачать PDF" prints the A4 document, not the phone layout. */}
      <div className="pub-print" aria-hidden="true">
        <DocumentRenderer type={doc.type} document={doc} signatureImageUrl={doc.signatureImageUrl ?? undefined} />
      </div>

      {sheetOpen && doc.canSign && (
        <SigningSheet
          doc={doc}
          token={token}
          onClose={() => setSheetOpen(false)}
          onReload={() => {
            setSheetOpen(false)
            onReload()
          }}
          onSigned={(signedDoc) => {
            setSheetOpen(false)
            onSigned(signedDoc)
          }}
        />
      )}
    </Frame>
  )
}

// S11: what the client sees at /p/:token. No account, no app navigation; the token in the link is the credential.
export function PublicScreen() {
  const { token = '' } = useParams()
  // One page per link: what happened on one (just signed) must not carry over to another.
  return <PublicPage key={token} token={token} />
}

function PublicPage({ token }: { token: string }) {
  const queryClient = useQueryClient()
  const [justSigned, setJustSigned] = useState(false)
  // After "Показать новую версию" the old copy must not be signable while the new one is on its way.
  const [reloading, setReloading] = useState(false)

  const query = useQuery({
    queryKey: publicKey(token),
    queryFn: () => services.public.get(token),
    retry: false,
    // Each load counts as a view on the owner's side: no refetch on focus.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  if (query.isPending || reloading || (query.isError && query.isFetching)) return <PublicLoading />
  if (query.isError) {
    const error = query.error
    if (isApiError(error) && (error.code === 'not_found' || error.code === 'link_revoked')) return <PublicGone />
    return (
      <Frame state="error">
        <div className="pub-error">
          <div className="banner banner-danger" role="alert">
            <CircleAlert aria-hidden="true" />
            <div className="banner-text">
              <strong>{t('pub.error.title')}</strong> {errorText(error)}
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void query.refetch()}>
            <span className="dc-label">{t('state.retry')}</span>
          </button>
        </div>
      </Frame>
    )
  }

  return (
    <PublicView
      doc={query.data}
      token={token}
      justSigned={justSigned}
      onReload={() => {
        setJustSigned(false)
        setReloading(true)
        void query.refetch().finally(() => setReloading(false))
      }}
      onSigned={(signed) => {
        queryClient.setQueryData(publicKey(token), signed)
        setJustSigned(true)
      }}
    />
  )
}
