import { Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { t } from '../../i18n/t'
import type { Document } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { FieldFrame } from '../fields'
import { copyText, shareMessage, whatsappLink } from './share'
import './quotes.css'

type CopyState = 'idle' | 'done' | 'failed'

function ShareBody({ quote }: { quote: Document }) {
  const link = quote.shareUrl ?? ''
  const [message, setMessage] = useState(() => shareMessage(quote))
  const [copied, setCopied] = useState<CopyState>('idle')
  const whatsapp = whatsappLink(quote.clientSnapshot.phone, message)

  async function copy() {
    setCopied((await copyText(link)) ? 'done' : 'failed')
  }

  return (
    <div className="qs-body">
      <FieldFrame id="qs-message" label={t('qs.message.label')} hint={t('qs.message.hint')}>
        {(describedBy) => (
          <textarea
            id="qs-message"
            name="qs-message"
            className="input qs-message"
            rows={5}
            value={message}
            aria-describedby={describedBy}
            onChange={(event) => setMessage(event.target.value)}
          />
        )}
      </FieldFrame>

      <div className="qs-rows">
        {whatsapp ? (
          <a className="qs-row" href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            <span className="qs-row-text">
              <span className="qs-row-title">{t('qs.whatsapp')}</span>
              <span className="qs-row-hint">{t('qs.whatsapp.hint')}</span>
            </span>
          </a>
        ) : (
          <div className="qs-row" aria-disabled="true">
            <MessageCircle aria-hidden="true" />
            <span className="qs-row-text">
              <span className="qs-row-title">{t('qs.whatsapp')}</span>
              <span className="qs-row-hint">{t('qs.whatsapp.noPhone')}</span>
            </span>
          </div>
        )}
        <button type="button" className="qs-row" onClick={() => void copy()}>
          <Copy aria-hidden="true" />
          <span className="qs-row-text">
            <span className="qs-row-title">{t('qs.copy')}</span>
            <span className="qs-row-hint">{t('qs.copy.hint')}</span>
          </span>
        </button>
      </div>

      <p className="qs-status" role="status" data-state={copied}>
        {copied === 'done' ? t('qs.copied') : copied === 'failed' ? t('qs.copyFailed') : ''}
      </p>
      {copied === 'failed' && (
        <FieldFrame id="qs-link" label={t('qs.link.label')}>
          {() => <input id="qs-link" className="input input-code" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />}
        </FieldFrame>
      )}
    </div>
  )
}

export interface ShareSheetProps {
  quote: Document
  onClose: () => void
}

// components.md "send sheet" (S09): the message the client gets, WhatsApp and a plain copy of the link. SMS and e-mail
// are post-MVP (docs/spec.md §9). The sheet unmounts its body on close, so a reopened sheet has a fresh message.
export function ShareSheet({ quote, onClose }: ShareSheetProps) {
  return (
    <BottomSheet open title={t('qs.title', { number: quote.number ?? '' })} onClose={onClose}>
      <ShareBody quote={quote} />
    </BottomSheet>
  )
}
