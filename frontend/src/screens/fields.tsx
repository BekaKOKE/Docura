import { CircleAlert } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { t } from '../i18n/t'

// Form controls of components.md ("Field"): label above, 48 px control with 16 px text, a hint, and an error
// in words under the control, tied to it with aria-describedby. Optional fields say "необязательно" instead of a star.

interface FieldFrameProps {
  id: string
  label: string
  optional?: boolean
  hint?: string
  error?: string | null
  children: (describedBy: string | undefined) => ReactNode
}

const hintId = (id: string) => `${id}-hint`
const errorId = (id: string) => `${id}-error`

export function FieldFrame({ id, label, optional, hint, error, children }: FieldFrameProps) {
  const ids = [hint ? hintId(id) : null, error ? errorId(id) : null].filter(Boolean).join(' ')
  return (
    <div className="field" data-invalid={error ? 'true' : undefined}>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && <span className="field-optional"> {t('form.optional')}</span>}
      </label>
      {children(ids || undefined)}
      {hint && (
        <p id={hintId(id)} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId(id)} className="field-error">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'onBlur' | 'className'> {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  optional?: boolean
  hint?: string
  error?: string | null
  /** Identifiers (ИИН/БИН, ИИК) are set in the mono face. */
  code?: boolean
}

export function TextField({ id, label, value, onChange, onBlur, optional, hint, error, code, ...input }: TextFieldProps) {
  return (
    <FieldFrame id={id} label={label} optional={optional} hint={hint} error={error}>
      {(describedBy) => (
        <input
          {...input}
          id={id}
          name={id}
          className={code ? 'input input-code' : 'input'}
          value={value}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
    </FieldFrame>
  )
}
