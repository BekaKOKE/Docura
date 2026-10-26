import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { meKey } from '../../app/session'
import { cleanCompanyValue, validateCompanyField } from '../../domain/company'
import { t } from '../../i18n/t'
import { services, type Company, type LegalForm } from '../../services'
import { SegmentedField, SwitchField, TextField } from '../fields'
import { showErrorsAndFocus, useFieldErrors } from '../formState'
import { Banner, ProblemBanner } from '../ui'
import { serverProblem } from '../serverProblem'
import {
  defaultPositionKey,
  LEGAL_FORM_OPTIONS,
  toCompanyInput,
  type CompanyFormValues,
  type CompanyTextField,
} from './formValues'
import { logoFileProblem } from './logoCheck'
import { companyKey, logoKey } from './queries'

type FormField = CompanyTextField | 'legalForm' | 'logo'

const SERVER_FIELDS: readonly string[] = [
  'legalForm',
  'legalName',
  'binIin',
  'address',
  'phone',
  'directorName',
  'directorPosition',
  'bankName',
  'iik',
  'bik',
  'kbe',
  'defaultKnp',
  'quoteValidityDays',
  'logo',
]

interface StagedLogo {
  file: File
  previewUrl: string
}

interface CompanyFormProps {
  /** `setup`: creates the company and goes to Главная (S03). `settings`: changes it and stays (S28). */
  mode: 'setup' | 'settings'
  initial: CompanyFormValues
  /** The logo already saved, if any. */
  savedLogoUrl: string | null
  /** Shown under the save button in setup: the way out for someone who signed up with the wrong account. */
  footer?: ReactNode
}

// The company requisites form of S03 (first setup) and S28 (settings): one form, two entry points.
// ИИН/БИН, ИИК, Кбе and КНП are checked when the field loses focus; saving is blocked, and focus moves to the
// first field with an error, until every value is right (#15 AC 4).
export function CompanyForm({ mode, initial, savedLogoUrl, footer }: CompanyFormProps) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const form = useRef<HTMLFormElement>(null)
  const created = useRef<Company | null>(null)
  const uploaded = useRef<File | null>(null)
  const [values, setValues] = useState<CompanyFormValues>(initial)
  const [staged, setStaged] = useState<StagedLogo | null>(null)
  const [saved, setSaved] = useState(false)
  const { errors, setError, setErrors } = useFieldErrors<FormField>()

  // The preview of a picked file is an object URL: let it go when it is replaced or the form closes.
  const stagedUrl = useRef<string | null>(null)
  useEffect(() => () => void (stagedUrl.current && URL.revokeObjectURL(stagedUrl.current)), [])

  const rule = (field: CompanyTextField, value: string) => {
    const key = validateCompanyField(field, value)
    return key ? t(key) : null
  }

  function change<K extends keyof CompanyFormValues>(field: K, value: CompanyFormValues[K]) {
    setSaved(false)
    setValues((current) => ({ ...current, [field]: value }))
    // A field that shows an error is checked again while the user fixes it, so the message goes as soon as it is right.
    if (typeof value === 'string' && errors[field as FormField]) setError(field as FormField, rule(field as CompanyTextField, value))
  }

  function blur(field: CompanyTextField) {
    const cleaned = cleanCompanyValue(field, values[field])
    if (cleaned !== values[field]) setValues((current) => ({ ...current, [field]: cleaned }))
    setError(field, rule(field, cleaned))
  }

  function changeLegalForm(next: LegalForm) {
    setSaved(false)
    setValues((current) => {
      // The position follows the form until the user writes their own.
      const wasDefault =
        current.directorPosition === '' || current.directorPosition === t(defaultPositionKey(current.legalForm))
      return {
        ...current,
        legalForm: next,
        directorPosition: wasDefault ? t(defaultPositionKey(next)) : current.directorPosition,
      }
    })
    setError('directorPosition', null)
  }

  async function pickLogo(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const problem = await logoFileProblem(file)
    if (problem) return setError('logo', t(problem))
    if (stagedUrl.current) URL.revokeObjectURL(stagedUrl.current)
    stagedUrl.current = URL.createObjectURL(file)
    setStaged({ file, previewUrl: stagedUrl.current })
    setError('logo', null)
    setSaved(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      const input = toCompanyInput(values)
      let company: Company
      if (mode === 'setup') {
        // Once created, a retry (after the logo failed) must not create a second company.
        created.current ??= await services.company.create(input)
        company = created.current
      } else {
        company = await services.company.update(input)
      }
      if (staged && uploaded.current !== staged.file) {
        await services.company.uploadLogo(staged.file)
        uploaded.current = staged.file
      }
      return company
    },
    onSuccess: (company) => {
      client.setQueryData(companyKey, company)
      client.setQueryData(meKey, (me: Awaited<ReturnType<typeof services.auth.me>> | undefined) =>
        me ? { ...me, companies: [company] } : me,
      )
      if (staged) void client.invalidateQueries({ queryKey: logoKey })
      if (mode === 'setup') navigate('/', { replace: true })
      else setSaved(true)
    },
    onError: (error) => {
      const { fields } = serverProblem(error, SERVER_FIELDS)
      if (Object.keys(fields).length > 0) showErrorsAndFocus(form.current, fields as Partial<Record<FormField, string>>, setErrors)
    },
  })
  const problem = save.isError ? serverProblem(save.error, SERVER_FIELDS) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    const found: Partial<Record<FormField, string>> = {}
    for (const field of Object.keys(values) as (keyof CompanyFormValues)[]) {
      if (field === 'legalForm' || field === 'vatPayer') continue
      const message = rule(field, values[field])
      if (message) found[field] = message
    }
    if (errors.logo) found.logo = errors.logo
    if (Object.keys(found).length > 0) return showErrorsAndFocus(form.current, found, setErrors)
    setErrors({})
    save.mutate()
  }

  const text = (field: CompanyTextField) => ({
    id: field,
    value: values[field],
    onChange: (value: string) => change(field, value),
    onBlur: () => blur(field),
    error: errors[field],
  })
  const logoUrl = staged?.previewUrl ?? savedLogoUrl

  return (
    <form ref={form} className="form" onSubmit={submit} noValidate>
      <section className="form-section" aria-labelledby="sec-org">
        <h2 id="sec-org">{t('company.section.org')}</h2>
        <SegmentedField
          id="legalForm"
          label={t('company.field.legalForm')}
          value={values.legalForm}
          options={LEGAL_FORM_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
          onChange={changeLegalForm}
        />
        <TextField {...text('legalName')} label={t('company.field.legalName')} hint={t('company.hint.legalName')} autoComplete="organization" />
        <TextField
          {...text('binIin')}
          label={t('company.field.binIin')}
          hint={t('company.hint.binIin')}
          inputMode="numeric"
          autoComplete="off"
          code
        />
        <TextField {...text('address')} label={t('company.field.address')} autoComplete="street-address" />
        <TextField
          {...text('phone')}
          label={t('company.field.phone')}
          hint={t('company.hint.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          optional
        />
      </section>

      <section className="form-section" aria-labelledby="sec-director">
        <h2 id="sec-director">{t('company.section.director')}</h2>
        <TextField {...text('directorName')} label={t('company.field.directorName')} autoComplete="name" />
        <TextField {...text('directorPosition')} label={t('company.field.directorPosition')} autoComplete="off" />
      </section>

      <section className="form-section" aria-labelledby="sec-vat">
        <h2 id="sec-vat">{t('company.section.vat')}</h2>
        <SwitchField
          id="vatPayer"
          label={t('company.field.vatPayer')}
          hint={t('company.hint.vatPayer')}
          checked={values.vatPayer}
          onChange={(checked) => change('vatPayer', checked)}
        />
      </section>

      <section className="form-section" aria-labelledby="sec-bank">
        <h2 id="sec-bank">{t('company.section.bank')}</h2>
        <p className="muted">{t('company.hint.bank')}</p>
        <TextField {...text('bankName')} label={t('company.field.bankName')} autoComplete="off" optional />
        <TextField
          {...text('iik')}
          label={t('company.field.iik')}
          hint={t('company.hint.iik')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          code
          optional
        />
        <TextField
          {...text('bik')}
          label={t('company.field.bik')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          code
          optional
        />
        <TextField {...text('kbe')} label={t('company.field.kbe')} hint={t('company.hint.kbe')} inputMode="numeric" autoComplete="off" code optional />
        <TextField
          {...text('defaultKnp')}
          label={t('company.field.defaultKnp')}
          hint={t('company.hint.defaultKnp')}
          inputMode="numeric"
          autoComplete="off"
          code
          optional
        />
      </section>

      <section className="form-section" aria-labelledby="sec-docs">
        <h2 id="sec-docs">{t('company.section.docs')}</h2>
        <TextField
          {...text('quoteValidityDays')}
          label={t('company.field.quoteValidityDays')}
          hint={t('company.hint.quoteValidityDays')}
          inputMode="numeric"
          autoComplete="off"
        />
      </section>

      <section className="form-section" aria-labelledby="sec-logo">
        <h2 id="sec-logo">{t('company.section.logo')}</h2>
        <div className="logo-box" data-invalid={errors.logo ? 'true' : undefined}>
          <div className="logo-preview">
            {logoUrl ? <img src={logoUrl} alt={t('company.logo.alt')} /> : <span>{t('company.logo.none')}</span>}
          </div>
          <label className="btn btn-secondary btn-block file-btn">
            <input
              id="logo"
              name="logo"
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg"
              aria-describedby={errors.logo ? 'logo-error' : 'logo-hint'}
              aria-invalid={errors.logo ? 'true' : undefined}
              onChange={(event) => void pickLogo(event)}
            />
            <span className="dc-label">{t(logoUrl ? 'company.logo.replace' : 'company.logo.pick')}</span>
          </label>
          <p id="logo-hint" className="field-hint">
            {t('company.hint.logo')}
          </p>
          {errors.logo && (
            <p id="logo-error" className="field-error">
              <span>{errors.logo}</span>
            </p>
          )}
        </div>
      </section>

      {problem?.banner && (
        <ProblemBanner message={problem.banner} onRetry={problem.retryable ? () => save.mutate() : undefined} />
      )}
      {saved && <Banner tone="success">{t('company.saved')}</Banner>}
      <button type="submit" className="btn btn-primary btn-block" aria-busy={save.isPending || undefined}>
        <span className="dc-label">{t('company.save')}</span>
      </button>
      {footer}
    </form>
  )
}
