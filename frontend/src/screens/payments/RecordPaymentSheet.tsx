import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { moneyInputTextFromTiyn } from '../../components/moneyInputText'
import { isIsoDate, todayInZone } from '../../domain/dates'
import { t } from '../../i18n/t'
import { isApiError, newRequestId, services, type DocumentSummary, type Payment, type PaymentMethod } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { Banner, Money } from '../clients/parts'
import { errorText } from '../errorText'
import { FieldFrame, TextField } from '../fields'
import { refreshAfterPaymentChange } from './paymentQueries'
import {
  checkAmount,
  DEFAULT_METHOD,
  NOTE_MAX,
  PAYMENT_METHODS,
  readLastMethod,
  rememberMethod,
  submitLabel,
} from './paymentRules'
import './payments.css'

/** What the sheet needs of an invoice: a row of the list has this much, and so does the card. */
export type PayableInvoice = Pick<DocumentSummary, 'id' | 'number' | 'grossTiyn' | 'payment'>

export interface RecordPaymentSheetProps {
  invoice: PayableInvoice
  /** The company's zone: "today" in it is the date the sheet starts with. */
  timeZone: string
  onClose: () => void
  /** The payment was saved. The parent closes the sheet and shows the toast. */
  onRecorded: (payment: Payment) => void
}

const AMOUNT_ID = 'pm-amount'
const DATE_ID = 'pm-date'

function PaymentForm({ invoice, timeZone, onRecorded }: Omit<RecordPaymentSheetProps, 'onClose'>) {
  const client = useQueryClient()
  const balance = invoice.payment?.balanceTiyn ?? invoice.grossTiyn
  const [amount, setAmount] = useState(() => moneyInputTextFromTiyn(balance))
  const [method, setMethod] = useState<PaymentMethod>(() => readLastMethod() ?? DEFAULT_METHOD)
  const [paidOn, setPaidOn] = useState(() => todayInZone(timeZone, new Date()))
  const [note, setNote] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  // What the service refused with, under the field it is about; anything else goes in a banner on top.
  const [serverAmount, setServerAmount] = useState<string | null>(null)
  const [serverDate, setServerDate] = useState<string | null>(null)
  const [serverNote, setServerNote] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  // One key for this opened sheet, reused on every retry: a second tap or a resent request makes one payment.
  const [requestId] = useState(newRequestId)
  const busy = useRef(false)
  const amountField = useRef<HTMLInputElement>(null)

  // The amount starts selected, so typing replaces it. The sheet moves focus to its panel when it opens, so this waits for that.
  useEffect(() => {
    const timer = setTimeout(() => {
      amountField.current?.focus()
      amountField.current?.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const check = checkAmount(amount, balance)
  // "Больше остатка" is said as soon as it is true; the other refusals wait until the field was left or save was tried.
  const localAmountError = !check.ok && (amountTouched || tried || check.kind === 'over') ? check.message : null
  const amountError = serverAmount ?? localAmountError
  const dateError = serverDate ?? (tried && !isIsoDate(paidOn) ? t('pm.error.date') : null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    setTried(true)
    if (!check.ok) {
      setServerAmount(null)
      amountField.current?.focus()
      return
    }
    if (!isIsoDate(paidOn)) {
      document.getElementById(DATE_ID)?.focus()
      return
    }
    busy.current = true
    setSending(true)
    setBanner(null)
    setServerAmount(null)
    setServerDate(null)
    setServerNote(null)
    try {
      const result = await services.payments.create(invoice.id, {
        amountTiyn: check.tiyn,
        method,
        paidOn,
        note: note.trim() === '' ? null : note.trim(),
        clientRequestId: requestId,
      })
      rememberMethod(method)
      refreshAfterPaymentChange(client, invoice.id)
      onRecorded(result.payment)
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'overpayment') {
        setServerAmount(errorText(caught))
        amountField.current?.focus()
        // The balance may have moved since the sheet opened (another phone): ask for it again.
        refreshAfterPaymentChange(client, invoice.id)
      } else if (isApiError(caught) && caught.code === 'validation_error' && caught.fields) {
        const { amountTiyn, paidOn: date, note: noteMessage, method: methodMessage } = caught.fields
        setServerAmount(amountTiyn ?? null)
        setServerDate(date ?? null)
        setServerNote(noteMessage ?? null)
        if (!amountTiyn && !date && !noteMessage) setBanner(methodMessage ?? errorText(caught))
      } else {
        setBanner(errorText(caught))
      }
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  return (
    <form className="pm-body" noValidate onSubmit={(event) => void submit(event)}>
      <p className="pm-sub">
        {t('pm.sub.left')} <Money tiyn={balance} /> {t('pm.sub.of')} <Money tiyn={invoice.grossTiyn} />
      </p>

      {banner && (
        <Banner tone="danger" title={t('pm.failed')}>
          {banner}
        </Banner>
      )}

      <FieldFrame id={AMOUNT_ID} label={t('pm.amount.label')} error={amountError}>
        {(describedBy) => (
          <MoneyInput
            id={AMOUNT_ID}
            name={AMOUNT_ID}
            ref={amountField}
            value={amount}
            invalid={Boolean(amountError)}
            describedBy={describedBy}
            onChange={(next) => {
              setAmount(next)
              setServerAmount(null)
            }}
            onBlur={() => setAmountTouched(true)}
          />
        )}
      </FieldFrame>

      <div className="field">
        <span id="pm-method-label" className="field-label">
          {t('pm.method.label')}
        </span>
        <div className="pm-chips" role="radiogroup" aria-labelledby="pm-method-label">
          {PAYMENT_METHODS.map((option) => (
            <label key={option} className="pm-chip">
              <input type="radio" name="pm-method" value={option} checked={method === option} onChange={() => setMethod(option)} />
              <span className="pm-chip-tile">{t(`pay.method.${option}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <TextField
        id={DATE_ID}
        type="date"
        label={t('pm.date.label')}
        value={paidOn}
        error={dateError}
        onChange={(next) => {
          setPaidOn(next)
          setServerDate(null)
        }}
      />

      <TextField
        id="pm-note"
        label={t('pm.note.label')}
        optional
        maxLength={NOTE_MAX}
        autoComplete="off"
        value={note}
        error={serverNote}
        onChange={(next) => {
          setNote(next)
          setServerNote(null)
        }}
      />

      <button type="submit" className="btn btn-primary btn-block pm-submit" aria-busy={sending || undefined}>
        <span className="dc-label">{sending ? t('pm.submitting') : submitLabel(amount, balance)}</span>
      </button>
    </form>
  )
}

// components.md "Record payment sheet" (S16, and the ⋯ of a row on S15): the amount is the balance and selected, the
// method is the one used last, the date is today in the company's zone. The body unmounts with the sheet, so a reopened
// sheet starts again with a new request key.
export function RecordPaymentSheet({ invoice, timeZone, onClose, onRecorded }: RecordPaymentSheetProps) {
  return (
    <BottomSheet open title={t('pm.title', { number: invoice.number ?? '' })} onClose={onClose}>
      <PaymentForm key={invoice.id} invoice={invoice} timeZone={timeZone} onRecorded={onRecorded} />
    </BottomSheet>
  )
}
