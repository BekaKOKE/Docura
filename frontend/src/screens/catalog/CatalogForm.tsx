import { useMutation } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { moneyInputTextFromTiyn } from '../../components/moneyInputText'
import { ARTICLE_UNITS, parsePriceInput, titleError, unitError } from '../../domain/article'
import { t } from '../../i18n/t'
import { isApiError, services, type Article, type ArticleInput, type ArticleKind } from '../../services'
import { errorText } from '../clients/errorText'
import { Banner } from '../clients/parts'

interface CatalogFormProps {
  /** The item being edited; without it the form creates one. */
  article?: Article
  onSaved: (article: Article) => void
  onCancel: () => void
}

type FormField = 'title' | 'unit' | 'price'
const FIELD_ORDER: readonly FormField[] = ['title', 'unit', 'price']
type Errors = Partial<Record<FormField, string>>

// The mock and the API name the price field `unitPriceTiyn`; the form calls it `price`.
const SERVER_FIELD: Record<string, FormField> = { title: 'title', unit: 'unit', unitPriceTiyn: 'price' }

interface FieldProps {
  label: string
  hint?: string
  error?: string
  /** Gets the id of the control and what to put in its aria-describedby. */
  children: (control: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

// components.md "Field": the label is above and tied to the control, the hint and the error are tied with
// aria-describedby, and an error is words with an icon, never only a red border.
function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="cl-field">
      <label className="cl-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="cl-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="cl-error">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

// S24 form: kind, title, unit and price of one catalogue item. The rules are the ones the mock service applies
// (domain/article.ts), so a mistake shows up here first, in the same words.
export function CatalogForm({ article, onSaved, onCancel }: CatalogFormProps) {
  const [kind, setKind] = useState<ArticleKind>(article?.kind ?? 'service')
  const [title, setTitle] = useState(article?.title ?? '')
  const [unit, setUnit] = useState<string>(article?.unit ?? ARTICLE_UNITS[0])
  const [price, setPrice] = useState(article ? moneyInputTextFromTiyn(article.unitPriceTiyn) : '')
  const [errors, setErrors] = useState<Errors>({})
  const controls = useRef<Partial<Record<FormField, HTMLElement | null>>>({})
  const kindName = useId()

  const save = useMutation({
    mutationFn: (input: ArticleInput) =>
      article ? services.articles.update(article.id, input) : services.articles.create(input),
    onSuccess: onSaved,
    onError: (error) => {
      if (isApiError(error) && error.code === 'validation_error' && error.fields) {
        const fromServer: Errors = {}
        for (const [name, message] of Object.entries(error.fields)) {
          const field = SERVER_FIELD[name]
          if (field) fromServer[field] = message
        }
        if (Object.keys(fromServer).length > 0) {
          setErrors(fromServer)
          focusFirst(fromServer)
        }
      }
    },
  })

  const focusFirst = (shown: Errors) => {
    const first = FIELD_ORDER.find((field) => shown[field])
    const element = first ? controls.current[first] : null
    if (!element) return
    // Focus without jumping, then bring the whole field (control and message) above the sticky buttons.
    element.focus({ preventScroll: true })
    // A tick later, so the message that was just set is in the field's height.
    setTimeout(() => element.closest('.cl-field')?.scrollIntoView({ block: 'nearest' }), 0)
  }
  const register = (field: FormField) => (element: HTMLElement | null) => {
    controls.current[field] = element
  }

  const errorOf = (field: FormField, value: string): string | undefined => {
    const key =
      field === 'title'
        ? titleError(value)
        : field === 'unit'
          ? unitError(value)
          : (() => {
              const parsed = parsePriceInput(value)
              return parsed.ok ? null : parsed.error
            })()
    return key ? t(key) : undefined
  }
  // An error goes away as soon as the value is fixed; a new one waits for the field to lose focus.
  const change = (field: FormField, set: (value: string) => void) => (value: string) => {
    set(value)
    if (errors[field] && errorOf(field, value) === undefined) setErrors((current) => ({ ...current, [field]: undefined }))
  }
  const check = (field: FormField, value: string) => () => {
    setErrors((current) => ({ ...current, [field]: errorOf(field, value) }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    const shown: Errors = {}
    for (const [field, value] of [['title', title], ['unit', unit], ['price', price]] as const) {
      const message = errorOf(field, value)
      if (message) shown[field] = message
    }
    setErrors(shown)
    if (Object.keys(shown).length > 0) {
      focusFirst(shown)
      return
    }
    const parsed = parsePriceInput(price)
    if (!parsed.ok) return
    save.mutate({ kind, title: title.trim(), unit, unitPriceTiyn: parsed.tiyn })
  }

  // Field mistakes are shown at the fields; anything else (a forced error, a lost connection) gets a banner.
  const hasErrors = FIELD_ORDER.some((field) => errors[field])
  const fieldMistake = hasErrors && isApiError(save.error) && save.error.code === 'validation_error'
  const banner: ReactNode =
    save.isError && !fieldMistake ? (
      <Banner tone="danger" title={t('catalogForm.saveError')}>
        {errorText(save.error)}
      </Banner>
    ) : null

  return (
    <form className="cl-form" onSubmit={submit} noValidate aria-busy={save.isPending || undefined}>
      {banner}

      <fieldset className="cl-segments" aria-label={t('catalogForm.kind')}>
        {(['service', 'material'] as const).map((option) => (
          <label key={option} className="cl-segment">
            <input
              type="radio"
              name={kindName}
              value={option}
              checked={kind === option}
              onChange={() => setKind(option)}
            />
            <span>{t(`catalog.kind.${option}`)}</span>
          </label>
        ))}
      </fieldset>

      <Field label={t('catalogForm.name')} error={errors.title}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="title"
            ref={register('title')}
            className="cl-control"
            type="text"
            autoComplete="off"
            value={title}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => change('title', setTitle)(event.target.value)}
            onBlur={check('title', title)}
          />
        )}
      </Field>

      <Field label={t('catalogForm.unit')} error={errors.unit}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="unit"
            ref={register('unit')}
            className="cl-control ct-select"
            value={unit}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => change('unit', setUnit)(event.target.value)}
            onBlur={check('unit', unit)}
          >
            {ARTICLE_UNITS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label={t('catalogForm.price')} hint={t('catalogForm.price.hint')} error={errors.price}>
        {({ id, describedBy, invalid }) => (
          <MoneyInput
            id={id}
            name="price"
            ref={register('price')}
            value={price}
            invalid={invalid}
            describedBy={describedBy}
            onChange={change('price', setPrice)}
            onBlur={check('price', price)}
          />
        )}
      </Field>

      <div className="cl-actions cl-actions-bar">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          <span className="dc-label">{t('catalogForm.cancel')}</span>
        </button>
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          <span className="dc-label">
            {save.isPending ? t('catalogForm.saving') : t(article ? 'catalogForm.save' : 'catalogForm.add')}
          </span>
        </button>
      </div>
    </form>
  )
}
