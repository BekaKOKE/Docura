import type { Ref } from 'react'
import { t } from '../i18n/t'
import { formatMoneyInputText } from './moneyInputText'
import './moneyInput.css'

interface MoneyInputProps {
  /** Ties the visible `<label for>` to the field. */
  id: string
  name?: string
  /** The text as typed. The parent parses it (`parsePriceInput`) and owns the error. */
  value: string
  onChange: (value: string) => void
  /** Called after the text has been formatted. */
  onBlur?: () => void
  invalid?: boolean
  /** Ids of the hint and the error message, as for any field. */
  describedBy?: string
  disabled?: boolean
  /** React 19: `ref` is an ordinary prop; the parent uses it to focus the field on an error. */
  ref?: Ref<HTMLInputElement>
}

// components.md "MoneyInput": right-aligned, tabular, the ₸ suffix is muted and not part of the value; accepts
// "18500", "18 500", "18500,5", "18500.5"; groups the digits with NBSP on blur; decimal keypad. The value stays
// text: the parent turns it into integer tiyn with `parsePriceInput` (src/domain/article.ts) and shows the error,
// so a minus sign or letters reach the validation and get their own message instead of being swallowed.
export function MoneyInput({ ref, ...props }: MoneyInputProps) {
  const currencyId = `${props.id}-currency`
  const described = [currencyId, props.describedBy].filter(Boolean).join(' ')
  return (
    <div className="mi" data-invalid={props.invalid || undefined}>
      <input
        ref={ref}
        id={props.id}
        name={props.name}
        className="mi-control"
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        disabled={props.disabled}
        value={props.value}
        aria-invalid={props.invalid ? true : undefined}
        aria-describedby={described}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={() => {
          const formatted = formatMoneyInputText(props.value)
          if (formatted !== props.value) props.onChange(formatted)
          props.onBlur?.()
        }}
      />
      <span className="mi-suffix" aria-hidden="true">
        ₸
      </span>
      <span id={currencyId} className="mi-sr">
        {t('money.tengeWord')}
      </span>
    </div>
  )
}
