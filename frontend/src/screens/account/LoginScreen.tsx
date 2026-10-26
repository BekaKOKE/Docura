import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { destinationAfterSignIn, REGISTER_PATH, safeFrom, startSession } from '../../app/session'
import { t } from '../../i18n/t'
import { services, type LoginInput } from '../../services'
import { TextField } from '../fields'
import { showErrorsAndFocus, useFieldErrors } from '../formState'
import { ProblemBanner } from '../ui'
import { serverProblem, validateEmail, validatePassword } from './authRules'
import { AuthFrame } from './AuthFrame'

type Field = keyof LoginInput

const FIELDS: readonly Field[] = ['email', 'password']

// S02. Signs in and goes back to the page the user was opening (the guard keeps it in `state.from`), or to the
// company setup when the account has no company yet (#15 AC 1, 2).
export function LoginScreen() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: unknown } | null)?.from
  const form = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<LoginInput>({ email: '', password: '' })
  const { errors, setError, setErrors } = useFieldErrors<Field>()

  const rule = (field: Field, value: string) => {
    const key = field === 'email' ? validateEmail(value) : validatePassword(value, false)
    return key ? t(key) : null
  }

  const login = useMutation({
    mutationFn: async (input: LoginInput) => {
      await services.auth.login({ ...input, email: input.email.trim() })
      return startSession(client)
    },
    onSuccess: (me) => navigate(me ? destinationAfterSignIn(me, from) : (safeFrom(from) ?? '/'), { replace: true }),
    onError: (error) => {
      const { fields } = serverProblem(error, FIELDS)
      if (Object.keys(fields).length > 0) showErrorsAndFocus(form.current, fields, setErrors)
    },
  })
  const problem = login.isError ? serverProblem(login.error, FIELDS) : null

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setError(field, rule(field, value))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (login.isPending) return
    const found: Partial<Record<Field, string>> = {}
    for (const field of FIELDS) {
      const message = rule(field, values[field])
      if (message) found[field] = message
    }
    if (Object.keys(found).length > 0) return showErrorsAndFocus(form.current, found, setErrors)
    setErrors({})
    login.mutate(values)
  }

  return (
    <AuthFrame screen="S02" title={t('screen.S02.title')} lead={t('auth.login.lead')}>
      <form ref={form} className="form" onSubmit={submit} noValidate>
        <TextField
          id="email"
          label={t('auth.field.email')}
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(value) => update('email', value)}
          onBlur={() => setError('email', rule('email', values.email))}
          error={errors.email}
          autoComplete="username"
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
          error={errors.password}
          autoComplete="current-password"
        />
        {problem?.banner && (
          <ProblemBanner message={problem.banner} onRetry={problem.retryable ? () => login.mutate(values) : undefined} />
        )}
        <button type="submit" className="btn btn-primary btn-block" aria-busy={login.isPending || undefined}>
          <span className="dc-label">{t('auth.login.submit')}</span>
        </button>
      </form>
      <p className="auth-switch">
        <span className="muted">{t('auth.login.noAccount')}</span>{' '}
        <Link className="text-link" to={REGISTER_PATH}>
          {t('auth.login.toRegister')}
        </Link>
      </p>
    </AuthFrame>
  )
}
