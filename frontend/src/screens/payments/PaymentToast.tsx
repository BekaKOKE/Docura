import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/t'
import { services } from '../../services'
import { refreshAfterPaymentChange, type PaymentToastState } from './paymentQueries'
import { NOTICE_MS, UNDO_MS } from './paymentRules'
import './payments.css'

type UndoState = 'ready' | 'busy' | 'undone' | 'failed'

export interface PaymentToastProps {
  toast: PaymentToastState
  /** Called when the toast has been on screen long enough, or after the undo. Keep it stable (useCallback). */
  onDismiss: () => void
}

// components.md "Toast": "Оплата записана · Отменить", 8 s; Отменить removes the payment again. A plain notice ("Оплата
// удалена") has no action and goes sooner. The parent gives the toast `key={toast.id}`, so a new payment starts a new timer.
export function PaymentToast({ toast, onDismiss }: PaymentToastProps) {
  const client = useQueryClient()
  const [undo, setUndo] = useState<UndoState>('ready')
  const busy = useRef(false)
  const recorded = toast.kind === 'recorded'

  const lastsMs = recorded && (undo === 'ready' || undo === 'busy' || undo === 'failed') ? UNDO_MS : NOTICE_MS
  useEffect(() => {
    // A removal in flight is not cut short by the timer; the answer restarts it.
    if (undo === 'busy') return
    const timer = setTimeout(onDismiss, lastsMs)
    return () => clearTimeout(timer)
  }, [onDismiss, lastsMs, undo])

  async function undoPayment() {
    if (toast.kind !== 'recorded' || busy.current) return
    busy.current = true
    setUndo('busy')
    try {
      await services.payments.remove(toast.paymentId)
      refreshAfterPaymentChange(client, toast.invoiceId)
      setUndo('undone')
    } catch {
      setUndo('failed')
    } finally {
      busy.current = false
    }
  }

  let text: string
  if (toast.kind === 'notice') text = toast.text
  else if (undo === 'undone') text = t('pm.toast.undone')
  else if (undo === 'failed') text = t('pm.toast.undoFailed')
  else text = t('pm.toast.recorded')

  const action = recorded && (undo === 'ready' || undo === 'busy' || undo === 'failed')
  return (
    <div className="pm-toast" role="status">
      <span className="pm-toast-text">{text}</span>
      {action && (
        <button type="button" className="pm-toast-action" aria-busy={undo === 'busy' || undefined} onClick={() => void undoPayment()}>
          <span className="dc-label">{t('pm.toast.undo')}</span>
        </button>
      )}
    </div>
  )
}
