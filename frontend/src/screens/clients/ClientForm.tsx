import { useMutation } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { clientFieldError, normalizeBinIin, validateClient, type ClientField } from '../../domain'
import { t } from '../../i18n/t'
import { isApiError, services, type Client, type ClientInput, type ClientKind } from '../../services'
import { Banner } from './parts'
import { errorText } from './errorText'

interface ClientFormProps {
  /** The client being edited; without it the form creates one. */
  client?: Client
  onSaved: (client: Client) => void
  onCancel: () => void
}

const FIELD_ORDER: readonly ClientField[] = ['name', 'contactName', 'phone', 'email', 'address', 'binIin']

type Values = Record<ClientField, string>
type Errors = Partial<Record<ClientField, string>>

function initialValues(client?: Client): Values {
  return {
    name: client?.name ?? '',
    contactName: client?.contactName ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    binIin: client?.binIin ?? '',
  }
}

interface TextFieldProps {
  field: ClientField
  label: string
  value: string
  error?: string
  hint?: string
  optional?: boolean
  multiline?: boolean
  type?: 'text' | 'tel' | 'email'
  inputMode?: 'text' | 'tel' | 'email' | 'numeric'
  autoComplete?: string
  onChange: (value: string) => void
  onBlur: () => void
  register: (field: ClientField, element: HTMLElement | null) => void
}

// components.md "Field": the label is above and tied to the control, the hint and the error are tied with
// aria-describedby, and an error is words with an icon, never only a red border.
function TextField(props: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const described = [props.hint ? hintId : null, props.error ? errorId : null].filter(Boolean).join(' ') || undefined
  const shared = {
    id,
    name: props.field,
    className: 'cl-control',
    value: props.value,
    autoComplete: props.autoComplete ?? 'off',
    'aria-invalid': props.error ? true : undefined,
    'aria-describedby': described,
    onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
    onBlur: props.onBlur,
  }
  return (
    <div className="cl-field">
      <label className="cl-label" htmlFor={id}>
        {props.label}
        {props.optional && <span className="cl-optional">{t('clientForm.optional')}</span>}
      </label>
      {props.multiline ? (
        <textarea {...shared} rows={2} ref={(element) => props.register(props.field, element)} />
      ) : (
        <input
          {...shared}
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          ref={(element) => props.register(props.field, element)}
        />
      )}
      {props.hint && (
        <p id={hintId} className="cl-hint">
          {props.hint}
        </p>
      )}
      {props.error && (
        <p id={errorId} className="cl-error">
          <CircleAlert aria-hidden="true" />
          <span>{props.error}</span>
        </p>
      )}
    </div>
  )
}

// S22/S23 form: a person or a company with name, phone, email, address and an optional ИИН/БИН. The rules are
// the ones the mock service applies (domain/client.ts), so a mistake shows up here first, in the same words.
export function ClientForm({ client, onSaved, onCancel }: ClientFormProps) {
  const [kind, setKind] = useState<ClientKind>(client?.kind ?? 'person')
  const [values, setValues] = useState<Values>(() => initialValues(client))
  const [errors, setErrors] = useState<Errors>({})
  const fields = useRef<Partial<Record<ClientField, HTMLElement | null>>>({})
  const kindName = useId()

  const save = useMutation({
    mutationFn: (input: ClientInput) =>
      client ? services.clients.update(client.id, input) : services.clients.create(input),
    onSuccess: onSaved,
    onError: (error) => {
      if (isApiError(error) && error.code === 'validation_error' && error.fields) {
        const fromServer: Errors = {}
        for (const field of FIELD_ORDER) if (error.fields[field]) fromServer[field] = error.fields[field]
        if (Object.keys(fromServer).length > 0) {
          setErrors(fromServer)
          focusFirst(fromServer)
        }
      }
    },
  })

  const register = (field: ClientField, element: HTMLElement | null) => {
    fields.current[field] = element
  }
  const focusFirst = (shown: Errors) => {
    const first = FIELD_ORDER.find((field) => shown[field])
    const element = first ? fields.current[first] : null
    if (!element) return
    element.focus()
    // The message sits under the field: bring both into view, not just the field.
    element.scrollIntoView({ block: 'center' })
  }
  const set = (field: ClientField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    // An error goes away as soon as the value is fixed; a new one waits for the field to lose focus.
    if (errors[field] && clientFieldError(field, value) === null) {
      setErrors((current) => ({ ...current, [field]: undefined }))
    }
  }
  const check = (field: ClientField) => () => {
    const key = clientFieldError(field, values[field])
    setErrors((current) => ({ ...current, [field]: key ? t(key) : undefined }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    const found = validateClient(values)
    const shown: Errors = {}
    for (const [field, key] of Object.entries(found)) shown[field as ClientField] = t(key)
    setErrors(shown)
    if (Object.keys(shown).length > 0) {
      focusFirst(shown)
      return
    }
    const blank = (value: string) => (value.trim() === '' ? null : value.trim())
    save.mutate({
      kind,
      name: values.name.trim(),
      binIin: blank(normalizeBinIin(values.binIin)),
      contactName: kind === 'company' ? blank(values.contactName) : null,
      phone: blank(values.phone),
      email: blank(values.email),
      address: blank(values.address),
    })
  }

  const company = kind === 'company'
  const hasErrors = FIELD_ORDER.some((field) => errors[field])
  const common = (field: ClientField) => ({
    field,
    value: values[field],
    error: errors[field],
    onChange: set(field),
    onBlur: check(field),
    register,
  })

  // Field mistakes are shown at the fields; anything else (a forced error, a lost connection) gets a banner.
  const fieldMistake = hasErrors && isApiError(save.error) && save.error.code === 'validation_error'
  const banner: ReactNode =
    save.isError && !fieldMistake ? (
      <Banner tone="danger" title={t('clientForm.saveError')}>
        {errorText(save.error)}
      </Banner>
    ) : null

  return (
    <form className="cl-form" onSubmit={submit} noValidate aria-busy={save.isPending || undefined}>
      {banner}

      <fieldset className="cl-segments" aria-label={t('clientForm.kind')}>
        {(['person', 'company'] as const).map((option) => (
          <label key={option} className="cl-segment">
            <input
              type="radio"
              name={kindName}
              value={option}
              checked={kind === option}
              onChange={() => setKind(option)}
            />
            <span>{t(`clients.kind.${option}`)}</span>
          </label>
        ))}
      </fieldset>

      <TextField {...common('name')} label={t(company ? 'clientForm.name.company' : 'clientForm.name.person')} />
      {company && <TextField {...common('contactName')} label={t('clientForm.contactName')} optional />}
      <TextField
        {...common('phone')}
        label={t('clientForm.phone')}
        optional
        type="tel"
        inputMode="tel"
        autoComplete="off"
      />
      <TextField
        {...common('email')}
        label={t('clientForm.email')}
        optional
        type="email"
        inputMode="email"
        autoComplete="off"
      />
      <TextField {...common('address')} label={t('clientForm.address')} optional multiline />
      <TextField
        {...common('binIin')}
        label={t(company ? 'clientForm.binIin.company' : 'clientForm.binIin.person')}
        hint={t('clientForm.binIin.hint')}
        optional
        inputMode="numeric"
      />

      <div className="cl-actions cl-actions-bar">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          <span className="dc-label">{t('clientForm.cancel')}</span>
        </button>
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          <span className="dc-label">
            {save.isPending ? t('clientForm.saving') : t(client ? 'clientForm.save' : 'clientForm.add')}
          </span>
        </button>
      </div>
    </form>
  )
}
