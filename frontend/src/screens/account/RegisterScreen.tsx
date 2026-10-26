import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LOGIN_PATH, ONBOARDING_PATH, startSession } from '../../app/session'
import { t } from '../../i18n/t'
import { services, type RegisterInput } from '../../services'
import { TextField } from '../fields'
import { showErrorsAndFocus, useFieldErrors } from '../formState'
import { ProblemBanner } from '../ui'
import { serverProblem } from '../serverProblem'
import { validateEmail, validateFullName, validatePassword } from './authRules'
import { AuthFrame } from './AuthFrame'

type Field = keyof RegisterInput

const FIELDS: readonly Field[] = ['fullName', 'email', 'password']

// S01. Email, password and name; on success the account is signed in and the company setup opens (#15 AC 1).
export function RegisterScreen() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const form = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<RegisterInput>({ fullName: '', email: '', password: '' })
  const { errors, setError, setErrors } = useFieldErrors<Field>()

  const rule = (field: Field, value: string) => {
    const key =
      field === 'fullName' ? validateFullName(value) : field === 'email' ? validateEmail(value) : validatePassword(value, true)
    return key ? t(key) : null
  }

  const register = useMutation({
    mutationFn: async (input: RegisterInput) => {
      await services.auth.register({ ...input, email: input.email.trim(), fullName: input.fullName.trim() })
      await startSession(client)
    },
    onSuccess: () => navigate(ONBOARDING_PATH, { replace: true }),
    onError: (error) => {
      const { fields } = serverProblem(error, FIELDS)
      if (Object.keys(fields).length > 0) showErrorsAndFocus(form.current, fields, setErrors)
    },
  })
  const problem = register.isError ? serverProblem(register.error, FIELDS) : null

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setError(field, rule(field, value))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (register.isPending) return
    const found: Partial<Record<Field, string>> = {}
    for (const field of FIELDS) {
      const message = rule(field, values[field])
      if (message) found[field] = message
    }
    if (Object.keys(found).length > 0) return showErrorsAndFocus(form.current, found, setErrors)
    setErrors({})
    register.mutate(values)
  }

  return (
    <AuthFrame screen="S01" title={t('screen.S01.title')} lead={t('auth.register.lead')}>
      <form ref={form} className="form" onSubmit={submit} noValidate>
        <TextField
          id="fullName"
          label={t('auth.field.fullName')}
          value={values.fullName}
          onChange={(value) => update('fullName', value)}
          onBlur={() => setError('fullName', rule('fullName', values.fullName))}
          error={errors.fullName}
          autoComplete="name"
          autoCapitalize="words"
        />
        <TextField
          id="email"
          label={t('auth.field.email')}
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(value) => update('email', value)}
          onBlur={() => setError('email', rule('email', values.email))}
          error={errors.email}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
        />
        <TextField
          id="password"
          label={t('auth.field.password')}
          type="password"
          value={values.password}
          onChange={(value) => update('password', value)}
          onBlur={() => setError('password', rule('password', values.password))}
          hint={t('auth.hint.password')}
          error={errors.password}
          autoComplete="new-password"
        />
        {problem?.banner && (
          <ProblemBanner message={problem.banner} onRetry={problem.retryable ? () => register.mutate(values) : undefined} />
        )}
        <button type="submit" className="btn btn-primary btn-block" aria-busy={register.isPending || undefined}>
          <span className="dc-label">{t('auth.register.submit')}</span>
        </button>
      </form>
      <p className="auth-switch">
        <span className="muted">{t('auth.register.haveAccount')}</span>{' '}
        <Link className="text-link" to={LOGIN_PATH}>
          {t('auth.register.toLogin')}
        </Link>
      </p>
    </AuthFrame>
  )
}
