import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { DocumentRenderer, DocumentViewport } from '../../documents'
import { formatDate } from '../../documents/format'
import { t } from '../../i18n/t'
import { services, type Document } from '../../services'
import { documentBadge } from '../clients/documentStatus'
import { Banner, Money } from '../clients/parts'
import { errorText } from '../errorText'
import { showErrorsAndFocus } from '../formState'
import { rememberQuote } from '../quotes/quoteQueries'
import { ShareSheet } from '../quotes/ShareSheet'
import { draftErrors, draftOf, previewOf, sameDraft, serverErrors, updateInput, type DraftErrors } from './actRules'
import { ActDraftForm } from './ActDraftForm'
import '../quotes/quotes.css'
import './acts.css'

type Action = 'save' | 'issue'

function PreviewLink({ act }: { act: Document }) {
  return (
    <Link className="qd-doc" to={`/documents/${act.id}/preview`} aria-label={t('act.card.openDocument')}>
      <DocumentViewport zoom="fit">
        <DocumentRenderer type="act" document={act} />
      </DocumentViewport>
    </Link>
  )
}

/** A draft: the form, the live document under it, "Сохранить" and "Выставить". */
function DraftBody({ act }: { act: Document }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => draftOf(act))
  const [errors, setErrors] = useState<DraftErrors>({})
  const [pending, setPending] = useState<Action | null>(null)
  const [problem, setProblem] = useState<{ title: string; text: string } | null>(null)
  const [saved, setSaved] = useState(false)
  // A second tap before the first answer must not save or issue twice.
  const busy = useRef(false)
  const form = useRef<HTMLFormElement>(null)

  const dirty = !sameDraft(values, draftOf(act))

  function change(next: typeof values) {
    setValues(next)
    setSaved(false)
  }

  async function run(action: Action) {
    if (busy.current) return
    // Issuing needs everything filled in; saving keeps whatever is typed so far.
    const found = action === 'issue' ? draftErrors(values) : {}
    if (Object.keys(found).length > 0) {
      showErrorsAndFocus(form.current, found, setErrors)
      return
    }
    busy.current = true
    setPending(action)
    setProblem(null)
    setErrors({})
    setSaved(false)
    try {
      let current = act
      if (dirty) {
        current = await services.documents.update(act.id, updateInput(act, values))
        rememberQuote(queryClient, current)
      }
      if (action === 'issue') rememberQuote(queryClient, await services.documents.issue(current.id))
      else setSaved(true)
    } catch (error) {
      const fields = serverErrors(error)
      if (fields) showErrorsAndFocus(form.current, fields, setErrors)
      else setProblem({ title: t(action === 'issue' ? 'act.card.issueFailed' : 'act.card.failed'), text: errorText(error) })
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  return (
    <form ref={form} className="act-draft" noValidate onSubmit={(event) => event.preventDefault()}>
      <ActDraftForm act={act} values={values} errors={errors} disabled={pending !== null} onChange={change} />

      {problem && (
        <Banner tone="danger" title={problem.title}>
          {problem.text}
        </Banner>
      )}
      {saved && <Banner tone="success" title={t('act.card.saved')} />}

      <div className="qd-actions" data-count={2}>
        <button type="button" className="btn btn-secondary" aria-busy={pending === 'save' || undefined} disabled={pending !== null} onClick={() => void run('save')}>
          <span className="dc-label">{pending === 'save' ? t('act.card.action.saving') : t('act.card.action.save')}</span>
        </button>
        {/* Not a submit button: Enter in a field must never issue the act, and an issued act can't be taken back. */}
        <button type="button" className="btn btn-primary" aria-busy={pending === 'issue' || undefined} disabled={pending !== null} onClick={() => void run('issue')}>
          <span className="dc-label">{pending === 'issue' ? t('act.card.action.issuing') : t('act.card.action.issue')}</span>
        </button>
      </div>

      <PreviewLink act={previewOf(act, values)} />
    </form>
  )
}

/** The card of an act (S18): where it stands, the next step and the document. */
export function ActView({ act }: { act: Document }) {
  const [shareOpen, setShareOpen] = useState(false)
  const badge = documentBadge(act)
  const draft = act.status === 'draft'

  return (
    <div className="page qd act" data-screen="S18" data-state={draft ? 'draft' : 'issued'}>
      <div className="qd-head">
        <h1 className="qd-number">
          <span className="dc-code">{act.number ?? t('docNumber.draft')}</span>
        </h1>
        <span className="cl-badge" data-tone={badge.tone}>
          {badge.label}
        </span>
      </div>
      <div className="qd-summary">
        <p className="qd-client">{act.clientSnapshot.name}</p>
        <p className="qd-amount">
          <Money tiyn={act.grossTiyn} />
        </p>
        {act.contractRef && <p className="muted act-wrap">{act.contractRef}</p>}
        {!draft && act.periodFrom && act.periodTo && (
          <p className="muted">{t('act.card.period', { from: formatDate(act.periodFrom), to: formatDate(act.periodTo) })}</p>
        )}
      </div>

      {draft ? (
        <>
          <DraftBody key={act.id} act={act} />
          {act.sourceDocumentId && (
            <Link className="btn btn-ghost btn-block" to={`/quotes/${act.sourceDocumentId}`}>
              <span className="dc-label">{t('act.card.action.quote')}</span>
            </Link>
          )}
        </>
      ) : (
        <>
          <div className="qd-actions" data-count={act.sourceDocumentId ? 2 : 1}>
            {act.sourceDocumentId && (
              <Link className="btn btn-secondary" to={`/quotes/${act.sourceDocumentId}`}>
                <span className="dc-label">{t('act.card.action.quote')}</span>
              </Link>
            )}
            <button type="button" className="btn btn-primary" aria-haspopup="dialog" disabled={!act.shareUrl} onClick={() => setShareOpen(true)}>
              <span className="dc-label">{t('act.card.action.send')}</span>
            </button>
          </div>
          <p className="muted">{t('act.card.printHint')}</p>
          <PreviewLink act={act} />
        </>
      )}

      {shareOpen && <ShareSheet quote={act} onClose={() => setShareOpen(false)} />}
    </div>
  )
}
