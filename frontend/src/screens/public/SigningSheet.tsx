import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatMoney } from '../../domain'
import { t, type MessageKey } from '../../i18n/t'
import { isApiError, services, type PublicDocument } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { FieldFrame } from '../fields'
import { isLongEnough, type SignatureStats } from './signature'
import { SignaturePad, type SignaturePadHandle } from './SignaturePad'
import './public.css'

export interface SigningSheetProps {
  doc: PublicDocument
  token: string
  onClose: () => void
  /** The signed document the service returned. */
  onSigned: (signed: PublicDocument) => void
  /** The document changed or the link changed under the client: load it again (the sheet is closed, the pad is gone). */
  onReload: () => void
}

/** What is still missing for the button, in the words of the hint under it. */
export function missingItems(input: { name: string; padOk: boolean; consentQuote: boolean; consentData: boolean }): MessageKey[] {
  const missing: MessageKey[] = []
  if (input.name.trim() === '') missing.push('pub.missing.name')
  if (!input.padOk) missing.push('pub.missing.pad')
  if (!input.consentQuote) missing.push('pub.missing.consentQuote')
  if (!input.consentData) missing.push('pub.missing.consentData')
  return missing
}

function SigningBody({ doc, token, onSigned, onReload }: Omit<SigningSheetProps, 'onClose'>) {
  const pad = useRef<SignaturePadHandle>(null)
  const [name, setName] = useState(doc.clientSnapshot.name)
  const [nameTouched, setNameTouched] = useState(false)
  const [stats, setStats] = useState<SignatureStats | null>(null)
  const [consentQuote, setConsentQuote] = useState(false)
  const [consentData, setConsentData] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)

  const padOk = isLongEnough(stats)
  const missing = missingItems({ name, padOk, consentQuote, consentData })
  const nameError = nameTouched && name.trim() === '' ? t('pub.name.error') : null
  const padStatus = stats === null ? t('pub.pad.empty') : padOk ? t('pub.pad.added') : t('pub.pad.short')

  async function submit() {
    if (sending || missing.length > 0) return
    const signaturePng = pad.current?.toPng()
    if (!signaturePng) return
    setSending(true)
    setError(null)
    try {
      const signed = await services.public.sign(token, {
        signerName: name.trim(),
        signaturePng,
        consentAccepted: true,
        personalDataConsent: true,
        version: doc.version,
      })
      onSigned(signed)
    } catch (caught) {
      const code = isApiError(caught) ? caught.code : null
      if (code === 'version_conflict') setConflict(true)
      // Signed meanwhile, expired or withdrawn: the page shows its own state for it.
      else if (code === 'already_signed' || code === 'link_expired' || code === 'link_revoked' || code === 'not_found') onReload()
      else if (code === 'rate_limited') setError(t('pub.sign.rateLimited'))
      // Anything else is treated as a lost connection: the name, the drawing and the ticks stay as they are.
      else setError(t('pub.sign.network'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="pub-sheet">
      {conflict && (
        <div className="pub-conflict" role="alertdialog" aria-labelledby="pub-conflict-title" aria-describedby="pub-conflict-text">
          <TriangleAlert aria-hidden="true" />
          <div className="pub-conflict-text">
            <strong id="pub-conflict-title">{t('pub.conflict.title')}</strong>
            <span id="pub-conflict-text">{t('pub.conflict.text')}</span>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={onReload}>
            <span className="dc-label">{t('pub.conflict.action')}</span>
          </button>
        </div>
      )}

      <FieldFrame id="pub-name" label={t('pub.name.label')} error={nameError}>
        {(describedBy) => (
          <input
            id="pub-name"
            name="pub-name"
            className="input"
            autoComplete="name"
            value={name}
            aria-invalid={nameError ? 'true' : undefined}
            aria-describedby={describedBy}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNameTouched(true)}
          />
        )}
      </FieldFrame>

      <div className="field">
        <span id="pub-pad-label" className="field-label">
          {t('pub.pad.label')}
        </span>
        <div className="pub-pad-frame" data-state={stats === null ? 'empty' : padOk ? 'ok' : 'short'}>
          <SignaturePad ref={pad} onChange={setStats} />
          <span className="pub-pad-cross" aria-hidden="true">
            ×
          </span>
        </div>
        <p className="field-hint">{t('pub.pad.hint')}</p>
        <p className="pub-rotate">{t('pub.pad.rotate')}</p>
        <div className="pub-pad-row">
          <p className="pub-pad-status" role="status" data-state={stats === null ? 'empty' : padOk ? 'ok' : 'short'}>
            {padStatus}
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              pad.current?.clear()
            }}
          >
            <span className="dc-label">{t('pub.pad.clear')}</span>
          </button>
        </div>
      </div>

      <label className="pub-check">
        <input type="checkbox" checked={consentQuote} onChange={(event) => setConsentQuote(event.target.checked)} />
        <span>{t('pub.consent.quote', { number: doc.number ?? '', amount: formatMoney(doc.grossTiyn) })}</span>
      </label>
      <label className="pub-check">
        <input type="checkbox" checked={consentData} onChange={(event) => setConsentData(event.target.checked)} />
        <span>{t('pub.consent.data')}</span>
      </label>

      {error && (
        <div className="banner banner-danger" role="alert">
          <CircleAlert aria-hidden="true" />
          <div className="banner-text">{error}</div>
        </div>
      )}

      <div className="pub-submit">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={missing.length > 0 || sending || conflict}
          aria-busy={sending || undefined}
          aria-describedby={missing.length > 0 ? 'pub-missing' : undefined}
          onClick={() => void submit()}
        >
          <span className="dc-label">{sending ? t('pub.submitting') : t('pub.submit')}</span>
        </button>
        {missing.length > 0 && (
          <p id="pub-missing" className="field-hint">
            {t('pub.missing', { items: missing.map((key) => t(key)).join(', ') })}
          </p>
        )}
      </div>
    </div>
  )
}

// components.md "Signing sheet": the name, the pad, the two consents and "Подписать". The body is unmounted when the
// sheet closes, so reopening it (or reloading a changed document) starts with an empty pad.
export function SigningSheet({ onClose, ...body }: SigningSheetProps) {
  return (
    <BottomSheet open title={t('pub.sheet.title')} onClose={onClose}>
      <SigningBody {...body} />
    </BottomSheet>
  )
}
