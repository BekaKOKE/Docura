import { Banknote, FileText } from 'lucide-react'
import { Link } from 'react-router'
import { formatMoney } from '../../domain'
import { t } from '../../i18n/t'
import { BottomSheet } from '../../shell/BottomSheet'
import type { PayableInvoice } from './RecordPaymentSheet'

export interface InvoiceMenuSheetProps {
  invoice: PayableInvoice
  onClose: () => void
  /** "Записать оплату" was chosen: the parent closes this menu and opens the payment sheet. */
  onRecord: () => void
}

// components.md "Row": the ⋯ of an invoice row opens the actions of a swipe, so a swipe is never the only way.
// Of the four listed there only the one built in this milestone is here, with a way into the card for the rest.
export function InvoiceMenuSheet({ invoice, onClose, onRecord }: InvoiceMenuSheetProps) {
  const balance = invoice.payment?.balanceTiyn ?? invoice.grossTiyn
  return (
    <BottomSheet open title={t('pm.menu.title', { number: invoice.number ?? '' })} onClose={onClose}>
      <ul className="sheet-list">
        <li>
          <button type="button" className="sheet-row" onClick={onRecord}>
            <Banknote aria-hidden="true" />
            <span className="sheet-row-text">
              <span className="sheet-row-label dc-label">{t('pm.menu.record')}</span>
              <span className="sheet-row-hint">{t('pm.menu.record.hint', { amount: formatMoney(balance) })}</span>
            </span>
          </button>
        </li>
        <li>
          <Link className="sheet-row" to={`/invoices/${invoice.id}`} onClick={onClose}>
            <FileText aria-hidden="true" />
            <span className="sheet-row-text">
              <span className="sheet-row-label dc-label">{t('pm.menu.open')}</span>
              <span className="sheet-row-hint">{t('pm.menu.open.hint')}</span>
            </span>
          </Link>
        </li>
      </ul>
    </BottomSheet>
  )
}
