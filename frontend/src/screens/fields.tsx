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

/** 2 to 4 options set as a value: a group of radios drawn as a segmented control (components.md, SegmentedControl). */
export function SegmentedField<V extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: V
  options: readonly { value: V; label: string }[]
  onChange: (value: V) => void
}) {
  return (
    <div className="field">
      <span id={`${id}-label`} className="field-label">
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((option) => (
          <label key={option.value} className="segmented-option">
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="segmented-tile">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** A yes/no row; the whole row is the hit area (components.md, Switch). */
export function SwitchField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="switch-row" htmlFor={id}>
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input
        id={id}
        name={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  )
}
