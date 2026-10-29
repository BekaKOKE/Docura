import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { MoneyInput } from '../../components/MoneyInput'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import { services, type Document } from '../../services'
import { Banner, Money } from '../clients/parts'
import { errorText } from '../errorText'
import { FieldFrame } from '../fields'
import { ErrorState, PageLoading } from '../ui'
import { quoteKey, useQuote } from '../quotes/quoteQueries'
import { availableTiyn, choose, invoicedTiyn, offeredBases, type Basis, type Typed } from './convertRules'
import './convert.css'

/** An idempotency key for one request: the same key twice makes one invoice (a repeated tap, a lost answer). */
function newRequestId(): string {
  return `cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const TITLE: Record<Basis, 'cv.basis.full' | 'cv.basis.remaining' | 'cv.basis.percent' | 'cv.basis.amount'> = {
  full: 'cv.basis.full',
  remaining: 'cv.basis.remaining',
  percent: 'cv.basis.percent',
  amount: 'cv.basis.amount',
}

function ConvertForm({ quote }: { quote: Document }) {
  const queryClient = useQueryClient()
  const offered = offeredBases(quote)
  const [basis, setBasis] = useState<Basis>(offered[0] ?? 'full')
  const [typed, setTyped] = useState<Typed>({ percent: '50', amount: '' })
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Document | null>(null)
  const busy = useRef(false)
  const ids = useRef(new Map<string, string>())
  const done = useRef<HTMLDivElement>(null)

  // What was on offer may have gone (the whole quote is invoiced, "Полная сумма" after a first invoice).
  const active: Basis = offered.includes(basis) ? basis : (offered[0] ?? basis)
  const choice = choose(quote, active, typed)
  const available = availableTiyn(quote)
  const fieldError = touched && !choice.ok ? t(choice.error) : null

  useEffect(() => {
    if (created) done.current?.focus()
  }, [created])

  async function submit() {
    if (busy.current) return
    setTouched(true)
    if (!choice.ok) {
      document.getElementById(active === 'percent' ? 'cv-percent' : 'cv-amount')?.focus()
      return
    }
    busy.current = true
    setSending(true)
    setError(null)
    // One key per request: a different choice is a different request, the same one repeated is the same.
    const key = JSON.stringify(choice.input)
    const clientRequestId = ids.current.get(key) ?? newRequestId()
    ids.current.set(key, clientRequestId)
    try {
      const invoice = await services.documents.convert(quote.id, { ...choice.input, issue: true, clientRequestId })
      queryClient.setQueryData(quoteKey(quote.id), { ...quote, children: [...quote.children, invoice] })
      void queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      ids.current.clear()
      setCreated(invoice)
      setTouched(false)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  return (
    <div className="page cv" data-screen="S14">
      <header className="cv-head">
        <h1 className="cv-title">
          <span className="dc-code">{quote.number}</span>
        </h1>
        <p className="cv-client">{quote.clientSnapshot.name}</p>
      </header>

      <dl className="cv-sums">
        <div>
          <dt>{t('cv.total')}</dt>
          <dd>
            <Money tiyn={quote.grossTiyn} />
          </dd>
        </div>
        {invoicedTiyn(quote) > 0 && (
          <div>
            <dt>{t('cv.invoiced')}</dt>
            <dd>
              <Money tiyn={invoicedTiyn(quote)} />
            </dd>
          </div>
        )}
        <div className="cv-sums-available">
          <dt>{t('cv.available')}</dt>
          <dd>
            <Money tiyn={available} />
          </dd>
        </div>
      </dl>

      {created && (
        <div ref={done} className="cv-done" role="status" tabIndex={-1}>
          <CircleCheck aria-hidden="true" />
          <div className="cv-done-text">
            <strong>{t('cv.done', { number: created.number ?? '', amount: formatMoney(created.grossTiyn) })}</strong>
            <div className="cv-done-actions">
              <Link className="btn btn-secondary" to={`/quotes/${quote.id}`}>
                <span className="dc-label">{t('cv.back')}</span>
              </Link>
              <Link className="btn btn-primary" to={`/invoices/${created.id}`}>
                <span className="dc-label">{t('cv.open')}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {offered.length === 0 ? (
        <p className="cv-note">{t('cv.allDone')}</p>
      ) : (
        <form
          className="cv-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <fieldset className="cv-options">
            <legend className="cv-legend">{t('cv.what')}</legend>
            {offered.map((option) => {
              const selected = option === active
              return (
                <div key={option} className="cv-option" data-selected={selected || undefined}>
                  <label className="cv-option-row">
                    <input type="radio" name="cv-basis" value={option} checked={selected} onChange={() => setBasis(option)} />
                    <span className="cv-option-text">
                      <span className="cv-option-title">{t(TITLE[option])}</span>
                      <span className="cv-option-hint">
                        {option === 'full' && t('cv.basis.full.hint', { amount: formatMoney(quote.grossTiyn) })}
                        {option === 'remaining' && t('cv.basis.remaining.hint', { amount: formatMoney(available) })}
                        {option === 'percent' && t('cv.basis.percent.hint')}
                        {option === 'amount' && t('cv.basis.amount.hint')}
                      </span>
                    </span>
                  </label>
                  {selected && option === 'percent' && (
                    <FieldFrame id="cv-percent" label={t('cv.percent.label')} error={fieldError}>
                      {(describedBy) => (
                        <div className="cv-percent">
                          <input
                            id="cv-percent"
                            name="cv-percent"
                            className="input"
                            inputMode="decimal"
                            autoComplete="off"
                            value={typed.percent}
                            aria-invalid={fieldError ? 'true' : undefined}
                            aria-describedby={describedBy}
                            onChange={(event) => setTyped({ ...typed, percent: event.target.value })}
                            onBlur={() => setTouched(true)}
                          />
                          <span className="cv-percent-sign" aria-hidden="true">
                            {t('cv.percent.suffix')}
                          </span>
                        </div>
                      )}
                    </FieldFrame>
                  )}
                  {selected && option === 'amount' && (
                    <FieldFrame id="cv-amount" label={t('cv.amount.label')} error={fieldError}>
                      {(describedBy) => (
                        <MoneyInput
                          id="cv-amount"
                          name="cv-amount"
                          value={typed.amount}
                          invalid={Boolean(fieldError)}
                          describedBy={describedBy}
                          onChange={(amount) => setTyped({ ...typed, amount })}
                          onBlur={() => setTouched(true)}
                        />
                      )}
                    </FieldFrame>
                  )}
                </div>
              )
            })}
          </fieldset>

          {choice.ok && (
            <p className="cv-preview" aria-live="polite">
              {t('cv.preview', { amount: formatMoney(choice.tiyn) })}
            </p>
          )}

          {error && (
            <Banner tone="danger" title={t('cv.failed')}>
              {error}
            </Banner>
          )}

          <button type="submit" className="btn btn-primary btn-block cv-confirm" aria-busy={sending || undefined}>
            <span className="dc-label">{sending ? t('cv.confirming') : t('cv.confirm')}</span>
          </button>
        </form>
      )}
    </div>
  )
}

// S14: "Выставить счёт" on a signed quote: all of it, what is left, or a prepayment by percent or by sum.
export function ConvertScreen() {
  const { quoteId = '' } = useParams()
  const query = useQuote(quoteId)

  if (query.isPending || (query.isError && query.isFetching)) return <PageLoading screen="S14" />
  if (query.isError) return <ErrorState screen="S14" error={query.error} onRetry={() => void query.refetch()} />

  const quote = query.data
  if (quote.type !== 'quote' || quote.status !== 'signed') {
    return (
      <div className="page cv" data-screen="S14" data-state="locked">
        <div className="cv-locked" role="status">
          <TriangleAlert aria-hidden="true" />
          <h1>{t('cv.locked.title')}</h1>
          <p>{t('cv.locked.text')}</p>
          <Link className="btn btn-secondary" to={`/quotes/${quote.id}`}>
            <span className="dc-label">{t('cv.locked.back')}</span>
          </Link>
        </div>
      </div>
    )
  }
  return <ConvertForm key={quote.id} quote={quote} />
}
