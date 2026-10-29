import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, Package, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { parsePriceInput } from '../../domain/article'
import { addDays, todayInZone } from '../../domain/dates'
import { EditorWithPreview } from '../../documents'
import { formatDate, formatDateTime } from '../../documents/format'
import { t, tCount, type MessageKey } from '../../i18n/t'
import { services, type Article, type Client, type ClientSnapshot, type Company, type Document } from '../../services'
import { Banner, EmptyState } from '../clients/parts'
import { useCompany } from '../company/queries'
import { errorText } from '../errorText'
import { FieldFrame, SwitchField, TextField } from '../fields'
import { ErrorState, PageLoading } from '../ui'
import { CatalogPicker } from './CatalogPicker'
import { clientMetaParts, ClientPicker } from './ClientPicker'
import {
  blankLine,
  draftFromDocument,
  draftTotals,
  emptyDraft,
  lineErrorKey,
  lineFromArticle,
  moveLine,
  patchLine,
  removeLine,
  restoreLine,
  toDocumentInput,
  validateDraft,
  validUntilOf,
  VALIDITY_PRESETS,
  VAT_RATE_BP,
  type DraftLine,
  type ErrorKey,
  type FieldKey,
  type LineProblems,
  type QuoteDraft,
  type RemovedLine,
  type ValidityChoice,
} from './draft'
import { LineCard, lineFieldId } from './LineCard'
import { clientSnapshotOf, previewDocument } from './previewDocument'
import { Toast } from './Toast'
import { TotalsBar } from './TotalsBar'
import './quoteEditor.css'

const FIELDS: readonly FieldKey[] = ['title', 'qty', 'price']
const VAT_RATE = String(VAT_RATE_BP / 100)

const detailKey = (id: string) => ['documents', 'detail', id] as const

/** What the screen hands to itself after the first save: the new quote, so the page it moves to needs no second load. */
interface Handoff {
  saved: Document
  time: string
  /** The draft was saved but issuing it failed: the page it moves to says so. */
  sendError?: string
}

const handoffOf = (state: unknown): Handoff | null =>
  typeof state === 'object' && state !== null && 'saved' in state && 'time' in state ? (state as Handoff) : null

/** The id of the control an error belongs to, so the screen can scroll to it and focus it. */
function targetOf(key: ErrorKey): string {
  if (key === 'client') return 'qe-client'
  if (key === 'validUntil') return 'qe-valid-until'
  const [lineKey, field] = key.split('.') as [string, FieldKey]
  return lineFieldId(lineKey, field)
}

/** Fields that bring up the on-screen keyboard (a checkbox or a radio does not). */
function isTextEntry(target: EventTarget): boolean {
  if (target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(target.type)
}

interface EditorProps {
  company: Company
  /** The saved quote being edited; null for a new one. */
  quote: Document | null
  /** "14:32" when the quote was just saved on the page it came from. */
  savedTime: string | null
  /** Why "Отправить" failed after the draft was saved, if it did. */
  sendError: string | null
}

function Editor({ company, quote, savedTime, sendError }: EditorProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const readOnly = quote !== null && quote.status !== 'draft'
  const [issueDate] = useState(() => quote?.issueDate ?? todayInZone(company.timezone, new Date()))
  const [draft, setDraft] = useState<QuoteDraft>(() => {
    if (!quote) return emptyDraft(company, issueDate)
    const opened = draftFromDocument(quote)
    // A company that stopped being a VAT payer since the quote was drawn has no switch to turn VAT off: the quote
    // opens without it, as the service would save it.
    return readOnly ? opened : { ...opened, vatEnabled: opened.vatEnabled && company.vatPayer }
  })
  const [client, setClient] = useState<ClientSnapshot | null>(quote?.clientSnapshot ?? null)

  const [openKey, setOpenKey] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'client' | 'catalog' | null>(null)
  const [totalsOpen, setTotalsOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  // The errors the person has been told about: a field they left, or everything after a failed save.
  const [shown, setShown] = useState<ReadonlySet<ErrorKey>>(() => new Set())

  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(sendError)
  // The draft is saved and only the sending failed: the banner says so instead of "не удалось сохранить".
  const [sendFailed, setSendFailed] = useState(sendError !== null)
  const [saved, setSaved] = useState<string | null>(savedTime)
  const [removed, setRemoved] = useState<{ id: number; line: RemovedLine } | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null)

  const savedQuote = useRef({ id: quote?.id ?? null, version: quote?.version ?? 0 })
  // One key per opened editor: a create that is sent twice (a lost answer, a repeated tap) makes one quote.
  const [requestId] = useState(() => `qe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
  const busy = useRef(false)
  const removals = useRef(0)
  const errorBox = useRef<HTMLDivElement>(null)

  const totals = useMemo(() => draftTotals(draft.lines, draft.vatEnabled), [draft.lines, draft.vatEnabled])
  const problems = useMemo(() => new Map(validateDraft(draft, issueDate)), [draft, issueDate])

  useEffect(() => {
    if (focusRequest) document.getElementById(focusRequest.id)?.focus()
  }, [focusRequest])

  // The first save moves to the quote's own address and the screen opens again: put the cursor back on "Сохранить".
  useEffect(() => {
    if (savedTime) document.getElementById('qe-save')?.focus()
  }, [savedTime])

  useEffect(() => {
    if (saveError) errorBox.current?.scrollIntoView?.({ block: 'nearest' })
  }, [saveError])

  const focus = (id: string) => setFocusRequest((current) => ({ id, n: (current?.n ?? 0) + 1 }))
  const dismissRemoved = useCallback(() => setRemoved(null), [])

  const change = (next: QuoteDraft) => {
    setDraft(next)
    setDirty(true)
  }
  const changeLine = (key: string, patch: Partial<DraftLine>) => change({ ...draft, lines: patchLine(draft.lines, key, patch) })

  const show = (keys: readonly ErrorKey[]) => setShown((current) => new Set([...current, ...keys]))
  const messageOf = (key: ErrorKey): string | null => {
    const message = shown.has(key) ? problems.get(key) : undefined
    return message ? t(message) : null
  }
  const problemsOf = (line: DraftLine): LineProblems => {
    const out: LineProblems = {}
    for (const field of FIELDS) {
      const key = lineErrorKey(line.key, field)
      const message = shown.has(key) ? problems.get(key) : undefined
      if (message) out[field] = message as MessageKey
    }
    return out
  }

  // ------------------------------------------------------------- lines

  function addFromCatalog(article: Article) {
    const line = lineFromArticle(article)
    change({ ...draft, lines: [...draft.lines, line] })
    setOpenKey(line.key)
    setSheet(null)
    focus(lineFieldId(line.key, 'qty'))
  }

  function addByHand() {
    const line = blankLine()
    change({ ...draft, lines: [...draft.lines, line] })
    setOpenKey(line.key)
    focus(lineFieldId(line.key, 'title'))
  }

  function move(key: string, step: -1 | 1) {
    change({ ...draft, lines: moveLine(draft.lines, key, step) })
    focus(lineFieldId(key, 'toggle'))
  }

  function remove(key: string) {
    const result = removeLine(draft.lines, key)
    if (!result.removed) return
    change({ ...draft, lines: result.lines })
    if (openKey === key) setOpenKey(null)
    removals.current += 1
    setRemoved({ id: removals.current, line: result.removed })
    focus('qe-add-manual')
  }

  function undoRemove() {
    if (!removed) return
    change({ ...draft, lines: restoreLine(draft.lines, removed.line) })
    focus(lineFieldId(removed.line.line.key, 'toggle'))
    setRemoved(null)
  }

  // ------------------------------------------------------------- terms

  function chooseValidity(choice: ValidityChoice) {
    // "Дата" starts from the day the chosen number of days would give, so the field is never empty and wrong.
    const validUntil = choice === 'date' ? validUntilOf(draft, issueDate) || addDays(issueDate, 14) : draft.validUntil
    change({ ...draft, validity: choice, validUntil })
  }

  // ------------------------------------------------------------- save

  function reveal(found: readonly [ErrorKey, MessageKey][]) {
    const keys = found.map(([key]) => key)
    const first = keys[0]!
    flushSync(() => {
      show(keys)
      if (first !== 'client' && first !== 'validUntil') setOpenKey(first.split('.')[0]!)
    })
    const target = document.getElementById(targetOf(first))
    target?.focus({ preventScroll: true })
    target?.scrollIntoView?.({ block: 'center' })
  }

  /** Saves the draft. With `thenSend` the quote is issued right after (its number is assigned) and the share sheet opens. */
  async function save(thenSend = false) {
    if (busy.current) return
    const found = validateDraft(draft, issueDate)
    if (found.length > 0) {
      reveal(found)
      return
    }
    busy.current = true
    setSaving(true)
    setSaveError(null)
    setSendFailed(false)
    const articleIds = new Map<string, string>()
    try {
      // A manual line the person asked to keep goes into the catalogue first. Once it is there the line points at it,
      // so a save that fails later and is repeated does not make the item twice.
      for (const line of draft.lines) {
        const price = parsePriceInput(line.price)
        if (!line.saveToCatalog || line.articleId !== null || !price.ok) continue
        const article = await services.articles.create({
          kind: line.kind,
          title: line.title.trim(),
          unit: line.unit,
          unitPriceTiyn: price.tiyn,
        })
        articleIds.set(line.key, article.id)
        setDraft((current) => ({ ...current, lines: patchLine(current.lines, line.key, { articleId: article.id, saveToCatalog: false }) }))
      }

      const input = toDocumentInput(draft, issueDate, articleIds)
      const current = savedQuote.current
      const result = current.id
        ? await services.documents.update(current.id, { ...input, version: current.version })
        : await services.documents.create({ ...input, clientRequestId: requestId })
      savedQuote.current = { id: result.id, version: result.version }

      const time = formatDateTime(new Date().toISOString(), company.timezone).time
      setDirty(false)
      setSaved(time)
      queryClient.setQueryData(detailKey(result.id), result)
      void queryClient.invalidateQueries({ queryKey: ['documents', 'list'] })
      if (thenSend) {
        let issued: Document
        try {
          issued = await services.documents.issue(result.id)
        } catch (error) {
          // The draft is saved. Move to its own address (a reload must not open an empty form) and say what failed.
          const failed: Handoff = { saved: result, time, sendError: errorText(error) }
          navigate(current.id ? '.' : `/quotes/${result.id}/edit`, { replace: true, state: failed })
          setSendFailed(true)
          setSaveError(failed.sendError ?? null)
          return
        }
        queryClient.setQueryData(detailKey(issued.id), issued)
        navigate(`/quotes/${issued.id}/send`, { replace: true })
        return
      }
      // The page this screen moves to (or reloads into) opens from the newest copy, not from the first one.
      const handoff: Handoff = { saved: result, time }
      navigate(current.id ? '.' : `/quotes/${result.id}/edit`, { replace: true, state: handoff })
    } catch (error) {
      setSaveError(errorText(error))
    } finally {
      // Catalogue items made before a failed save exist all the same.
      if (articleIds.size > 0) void queryClient.invalidateQueries({ queryKey: ['articles'] })
      busy.current = false
      setSaving(false)
    }
  }

  // ------------------------------------------------------------- render

  const clientError = messageOf('client')
  const dateError = messageOf('validUntil')
  const status = saving
    ? t('qe.status.saving')
    : dirty
      ? t('qe.status.dirty')
      : saved
        ? t('qe.status.saved', { time: saved })
        : quote
          ? null
          : t('qe.status.new')

  const signature = quote?.signature ?? null
  const signedAt = signature ? formatDateTime(signature.signedAt, company.timezone) : null

  const preview = previewDocument(draft, { client, company, issueDate, number: quote?.number ?? null })

  const form = (
    <div
      className="qe-root"
      data-screen="S07"
      data-typing={typing || undefined}
      onFocusCapture={(event: FocusEvent) => setTyping(isTextEntry(event.target))}
      onBlurCapture={() => setTyping(false)}
    >
      {/* Nothing can be typed while the save is on its way: what is saved is what is on the screen. */}
      <div className="page qe" inert={saving || undefined}>
        <h1 className="sr-only">{quote?.number ?? t('qe.heading.new')}</h1>
        {status && (
          <p className="qe-status muted" role="status">
            {status}
          </p>
        )}

        {readOnly && signature && signedAt && (
          <Banner tone="success">{t('qe.readonly.signed', { date: signedAt.date, time: signedAt.time, name: signature.signerName })}</Banner>
        )}
        {readOnly && !signature && <p className="qe-note">{t('qe.readonly.other')}</p>}

        <div ref={errorBox}>
          {saveError && (
            <Banner tone="danger" title={sendFailed ? t('qd.send.error') : t('qe.saveError.title')}>
              {saveError} {sendFailed ? t('qd.send.hint') : t('qe.saveError.hint')}
            </Banner>
          )}
        </div>

        <section className="qe-section" aria-labelledby="qe-client-label">
          <h2 id="qe-client-label" className="qe-label">
            {t('qe.client.label')}
          </h2>
          {client ? (
            <div className="card qe-client">
              <div className="qe-client-text">
                <span className="qe-client-name">{client.name}</span>
                <span className="qe-client-meta">{clientMetaParts(client).map((part) => part.text).join(' · ')}</span>
              </div>
              {!readOnly && (
                <button id="qe-client" type="button" className="btn btn-ghost" aria-haspopup="dialog" onClick={() => setSheet('client')}>
                  <span className="dc-label">{t('qe.client.change')}</span>
                </button>
              )}
            </div>
          ) : (
            <button
              id="qe-client"
              type="button"
              className="btn btn-secondary btn-block"
              aria-haspopup="dialog"
              aria-invalid={clientError ? 'true' : undefined}
              aria-describedby={clientError ? 'qe-client-error' : undefined}
              onClick={() => setSheet('client')}
            >
              <span className="dc-label">{t('qe.client.choose')}</span>
            </button>
          )}
          {clientError && (
            <p id="qe-client-error" className="field-error">
              <CircleAlert aria-hidden="true" />
              <span>{clientError}</span>
            </p>
          )}
        </section>

        <section className="qe-section" aria-labelledby="qe-lines-label">
          <h2 id="qe-lines-label" className="qe-label">
            {t('qe.lines.label')}
          </h2>
          {draft.lines.length === 0 ? (
            <EmptyState icon={Package} title={t('qe.lines.empty.title')} text={t('qe.lines.empty.text')} />
          ) : (
            <ol className="qe-lines">
              {draft.lines.map((line, index) => (
                <LineCard
                  key={line.key}
                  n={index + 1}
                  line={line}
                  totals={totals.lines[index] ?? null}
                  vatEnabled={draft.vatEnabled}
                  expanded={openKey === line.key}
                  readOnly={readOnly}
                  problems={problemsOf(line)}
                  canMoveUp={index > 0}
                  canMoveDown={index < draft.lines.length - 1}
                  onToggle={() => setOpenKey(openKey === line.key ? null : line.key)}
                  onChange={(patch) => changeLine(line.key, patch)}
                  onBlur={(field) => show([lineErrorKey(line.key, field)])}
                  onMove={(step) => move(line.key, step)}
                  onRemove={() => remove(line.key)}
                />
              ))}
            </ol>
          )}
          {!readOnly && (
            <div className="qe-add">
              <button id="qe-add-catalog" type="button" className="btn btn-secondary" aria-haspopup="dialog" onClick={() => setSheet('catalog')}>
                <Plus aria-hidden="true" />
                <span className="dc-label">{t('qe.lines.fromCatalog')}</span>
              </button>
              <button id="qe-add-manual" type="button" className="btn btn-secondary" onClick={addByHand}>
                <Pencil aria-hidden="true" />
                <span className="dc-label">{t('qe.lines.manual')}</span>
              </button>
            </div>
          )}
        </section>

        <section className="qe-section" aria-labelledby="qe-terms-label">
          <h2 id="qe-terms-label" className="qe-label">
            {t('qe.terms.label')}
          </h2>

          {readOnly ? (
            <div className="card qe-terms">
              {draft.validUntil !== '' && (
                <p>
                  {t('qe.validity.dateLabel')} <span className="qe-nowrap">{formatDate(draft.validUntil)}</span>
                </p>
              )}
              <p>{draft.vatEnabled ? t('qe.vat.label', { rate: VAT_RATE }) : t('qe.noVat.label')}</p>
              {draft.notes !== '' && <p className="qe-notes-text">{draft.notes}</p>}
            </div>
          ) : (
            <>
              <div className="field qe-validity">
                <span id="qe-validity-label" className="field-label">
                  {t('qe.validity.label')}
                </span>
                <div className="segmented" role="radiogroup" aria-labelledby="qe-validity-label">
                  {[...VALIDITY_PRESETS, 'date' as const].map((choice) => (
                    <label key={choice} className="segmented-option">
                      <input
                        type="radio"
                        name="qe-validity"
                        value={choice}
                        checked={draft.validity === choice}
                        onChange={() => chooseValidity(choice)}
                      />
                      <span className="segmented-tile">{choice === 'date' ? t('qe.validity.date') : tCount('count.day', choice)}</span>
                    </label>
                  ))}
                </div>
              </div>
              {draft.validity === 'date' && (
                <TextField
                  id="qe-valid-until"
                  type="date"
                  label={t('qe.validity.dateLabel')}
                  value={draft.validUntil}
                  error={dateError}
                  onChange={(validUntil) => change({ ...draft, validUntil })}
                  onBlur={() => show(['validUntil'])}
                />
              )}

              {company.vatPayer ? (
                <SwitchField
                  id="qe-vat"
                  label={t('qe.vat.label', { rate: VAT_RATE })}
                  hint={t('qe.vat.hint')}
                  checked={draft.vatEnabled}
                  onChange={(vatEnabled) => change({ ...draft, vatEnabled })}
                />
              ) : (
                <div className="qe-novat">
                  <strong>{t('qe.noVat.label')}</strong>
                  <p className="field-hint">{t('qe.noVat.text')}</p>
                  <Link className="text-link" to="/settings/company">
                    {t('qe.noVat.link')}
                  </Link>
                </div>
              )}

              <FieldFrame id="qe-notes" label={t('qe.notes.label')} optional>
                {(describedBy) => (
                  <textarea
                    id="qe-notes"
                    name="qe-notes"
                    className="input qe-textarea"
                    rows={3}
                    value={draft.notes}
                    aria-describedby={describedBy}
                    onChange={(event) => change({ ...draft, notes: event.target.value })}
                  />
                )}
              </FieldFrame>
            </>
          )}
        </section>
      </div>

      <div className="qe-bars">
        <TotalsBar
          totals={totals}
          vatEnabled={draft.vatEnabled}
          lineCount={draft.lines.length}
          expanded={totalsOpen}
          onToggle={() => setTotalsOpen((open) => !open)}
        />
        {!readOnly && (
          <div className="qe-actions">
            <button id="qe-send" type="button" className="btn btn-secondary" aria-busy={saving || undefined} onClick={() => void save(true)}>
              <span className="dc-label">{t('qd.action.send')}</span>
            </button>
            <button id="qe-save" type="button" className="btn btn-primary" aria-busy={saving || undefined} onClick={() => void save()}>
              <span className="dc-label">{saving ? t('qe.saving') : t('qe.save')}</span>
            </button>
          </div>
        )}
      </div>

      {removed && (
        <Toast key={removed.id} text={t('qe.line.removed')} actionLabel={t('qe.line.undo')} onAction={undoRemove} onDismiss={dismissRemoved} />
      )}

      <ClientPicker
        open={sheet === 'client'}
        onClose={() => setSheet(null)}
        onPick={(picked: Client) => {
          change({ ...draft, clientId: picked.id })
          setClient(clientSnapshotOf(picked))
          setSheet(null)
          // The sheet gives focus back to the button it was opened from, which the client card has just replaced.
          focus('qe-client')
        }}
      />
      <CatalogPicker open={sheet === 'catalog'} onClose={() => setSheet(null)} onPick={addFromCatalog} />
    </div>
  )

  return <EditorWithPreview preview={{ type: 'quote', document: preview }}>{form}</EditorWithPreview>
}

// S07: the quote editor (#19). Loads the company (for VAT and the default validity) and, for an existing quote, the
// quote; the form itself lives in <Editor>, which starts from what was loaded and then owns its own state.
export function QuoteEditorScreen() {
  const { quoteId } = useParams()
  const handoff = handoffOf(useLocation().state)
  const handedOver = handoff !== null && handoff.saved.id === quoteId ? handoff : null

  const company = useCompany()
  const loaded = useQuery({
    queryKey: detailKey(quoteId ?? ''),
    queryFn: () => services.documents.get(quoteId as string),
    enabled: quoteId !== undefined && handedOver === null,
  })

  if (company.isError) return <ErrorState screen="S07" error={company.error} onRetry={() => void company.refetch()} />
  if (loaded.isError) return <ErrorState screen="S07" error={loaded.error} onRetry={() => void loaded.refetch()} />

  // A quote opened from the list may be in the cache from an earlier visit: wait for the fresh copy, so the version
  // the form sends back is the current one.
  const quote = handedOver?.saved ?? (loaded.isFetchedAfterMount ? loaded.data : undefined)
  if (!company.data || (quoteId !== undefined && !quote)) return <PageLoading screen="S07" />

  return <Editor key={quote?.id ?? 'new'} company={company.data} quote={quote ?? null} savedTime={handedOver?.time ?? null} sendError={handedOver?.sendError ?? null} />
}
