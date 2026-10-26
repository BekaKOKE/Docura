import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import { renderApp } from '../../test/renderApp'
import { ApiError } from '../../services'
import { serverProblem } from '../serverProblem'
import { validateEmail, validateFullName, validatePassword } from './authRules'

describe('sign-up and sign-in rules', () => {
  it('asks for an email, and for one that looks like an email', () => {
    expect(validateEmail('')).toBe('auth.error.emailRequired')
    expect(validateEmail('   ')).toBe('auth.error.emailRequired')
    expect(validateEmail('aliya')).toBe('auth.error.emailInvalid')
    expect(validateEmail('aliya@example')).toBe('auth.error.emailInvalid')
    expect(validateEmail(' aliya@example.kz ')).toBeNull()
  })

  it('asks for a password of 8 characters on sign-up and any password on sign-in', () => {
    expect(validatePassword('', true)).toBe('auth.error.passwordRequired')
    expect(validatePassword('короткий', true)).toBeNull()
    expect(validatePassword('1234567', true)).toBe('auth.error.passwordShort')
    expect(validatePassword('Тест-Пароль-2026', true)).toBeNull()
    expect(validatePassword('1', false)).toBeNull()
    expect(validatePassword('', false)).toBe('auth.error.passwordRequired')
  })

  it('asks for a name', () => {
    expect(validateFullName(' ')).toBe('auth.error.nameRequired')
    expect(validateFullName('Әлия Сейткали')).toBeNull()
  })

  it('says every message in Russian words, never a status code', () => {
    for (const key of [
      'auth.error.emailRequired',
      'auth.error.emailInvalid',
      'auth.error.passwordRequired',
      'auth.error.passwordShort',
      'auth.error.nameRequired',
      'auth.error.emailTaken',
      'auth.error.wrongCredentials',
    ] as const) {
      expect(t(key), key).toMatch(/[А-Яа-яЁё]/)
      expect(t(key), key).not.toMatch(/\b(401|422|429|error)\b/i)
    }
  })
})

describe('serverProblem', () => {
  const fields = ['fullName', 'email', 'password']

  it('puts a duplicate email under the email field', () => {
    const taken = new ApiError({ code: 'validation_error', message: 'Проверьте заполненные поля.', fields: { email: t('auth.error.emailTaken') } })
    expect(serverProblem(taken, fields)).toEqual({ fields: { email: 'Эта почта уже зарегистрирована.' }, banner: null, retryable: false })
  })

  it('shows a wrong password above the form, without a retry', () => {
    const wrong = new ApiError({ code: 'unauthorized', message: t('auth.error.wrongCredentials') })
    expect(serverProblem(wrong, fields)).toEqual({ fields: {}, banner: 'Неверная почта или пароль.', retryable: false })
  })

  it('offers a retry for an error that is not about the data', () => {
    const limited = new ApiError({ code: 'rate_limited', message: t('apiError.rate_limited') })
    expect(serverProblem(limited, fields)).toMatchObject({ banner: 'Слишком много попыток. Подождите минуту.', retryable: true })
    expect(serverProblem(new Error('boom'), fields)).toMatchObject({ banner: t('error.generic'), retryable: true })
  })
})

describe('the sign-up and sign-in screens', () => {
  it('sign-up asks for name, email and password and has a full-width submit', () => {
    const html = renderApp('/register', null)
    for (const key of ['auth.field.fullName', 'auth.field.email', 'auth.field.password'] as const) {
      expect(html, key).toContain(t(key))
    }
    expect(html).toContain('autoComplete="new-password"')
    expect(html).toContain('autoComplete="name"')
    expect(html).toMatch(/<button[^>]*class="btn btn-primary btn-block"[^>]*type="submit"|<button[^>]*type="submit"[^>]*class="btn btn-primary btn-block"/)
    expect(html).toContain(t('auth.register.submit'))
    expect(html).toContain('href="/login"')
  })

  it('sign-in links to sign-up and asks for the current password', () => {
    const html = renderApp('/login', null)
    expect(html).toContain('autoComplete="current-password"')
    expect(html).toContain('href="/register"')
    expect(html).toContain(t('auth.login.submit'))
    expect(html).toContain('type="email"')
    expect(html).toContain('inputMode="email"')
  })
})
