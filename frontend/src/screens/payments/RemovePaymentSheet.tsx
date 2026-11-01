import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { formatMoney } from '../../domain'
import { formatDate } from '../../documents/format'
import { t } from '../../i18n/t'
import { services, type Payment } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { Banner } from '../clients/parts'
import { errorText } from '../errorText'
import { refreshAfterPaymentChange } from './paymentQueries'
import './payments.css'

export interface RemovePaymentSheetProps {
  payment: Payment
  onClose: () => void
  /** The payment is gone. The parent closes the sheet and says so. */
  onRemoved: () => void
}

function RemoveBody({ payment, onClose, onRemoved }: RemovePaymentSheetProps) {
  const client = useQueryClient()
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  async function remove() {
    if (busy.current) return
    busy.current = true
    setRemoving(true)
    setError(null)
    try {
      await services.payments.remove(payment.id)
      refreshAfterPaymentChange(client, payment.documentId)
      onRemoved()
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      busy.current = false
      setRemoving(false)
    }
  }

  return (
    <div className="pm-body">
      <p className="pm-confirm">{t('pm.remove.text', { amount: formatMoney(payment.amountTiyn), date: formatDate(payment.paidOn) })}</p>
      {error && (
        <Banner tone="danger" title={t('pm.remove.failed')}>
          {error}
        </Banner>
      )}
      {/* Two buttons side by side, and no more. */}
      <div className="pm-pair">
        <button type="button" className="btn btn-secondary pm-submit" onClick={onClose}>
          <span className="dc-label">{t('pm.remove.keep')}</span>
        </button>
        <button type="button" className="btn btn-primary pm-submit" aria-busy={removing || undefined} onClick={() => void remove()}>
          <span className="dc-label">{removing ? t('pm.remove.removing') : t('pm.remove.confirm')}</span>
        </button>
      </div>
    </div>
  )
}

// Removing a wrong entry asks first: the balance of the invoice grows by the payment (docs/spec.md §5, "Payments").
export function RemovePaymentSheet(props: RemovePaymentSheetProps) {
  return (
    <BottomSheet open title={t('pm.remove.title')} onClose={props.onClose}>
      <RemoveBody {...props} />
    </BottomSheet>
  )
}
