// The mock AuthService: sign-up, sign-in, who am I, sign-out, against the store. The seed users sign in with
// the dev password (contracts/README.md); a new account has no company until onboarding (#15) creates one.

import { t } from '../../i18n/t'
import type { AuthService } from '../contracts'
import { ApiError } from '../errors'
import type { AuthSession, Me } from '../types'
import { newId, newToken } from './ids'
import { toCompany, toUser } from './mappers'
import type { MockRuntime } from './runtime'
import type { StoreData, StoredUser } from './storeTypes'

/** `/api/auth/*` allows 5 tries a minute per email (replica/architecture.md, "Rate limits"). */
export const LOGIN_LIMIT = 5
export const LOGIN_WINDOW_MS = 60_000
export const MIN_PASSWORD_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

function unauthorized(message = t('apiError.unauthorized')): ApiError {
  return new ApiError({ code: 'unauthorized', message })
}

function sessionUser(data: Readonly<StoreData>): StoredUser {
  const user = data.session ? data.users.find((u) => u.id === data.session?.userId) : undefined
  if (!user) throw unauthorized()
  return user
}

export function createMockAuth(getRuntime: () => MockRuntime): AuthService {
  const attempts = new Map<string, number[]>()

  /** Counts this try and says whether the email is over the limit. */
  function overLimit(email: string, now: number): boolean {
    const recent = (attempts.get(email) ?? []).filter((at) => now - at < LOGIN_WINDOW_MS)
    const over = recent.length >= LOGIN_LIMIT
    attempts.set(email, over ? recent : [...recent, now])
    return over
  }

  return {
    register(input) {
      const runtime = getRuntime()
      return runtime.call((): AuthSession => {
        const email = normalizeEmail(input.email)
        const fullName = input.fullName.trim()
        const fields: Record<string, string> = {}
        if (!EMAIL_PATTERN.test(email)) fields.email = t('auth.error.emailInvalid')
        if (input.password.length < MIN_PASSWORD_LENGTH) fields.password = t('auth.error.passwordShort')
        if (fullName === '') fields.fullName = t('auth.error.nameRequired')
        if (Object.keys(fields).length > 0) {
          throw new ApiError({ code: 'validation_error', message: t('apiError.validation_error'), fields })
        }
        return runtime.store.writeAll((data) => {
          if (data.users.some((u) => normalizeEmail(u.email) === email)) {
            throw new ApiError({
              code: 'validation_error',
              message: t('apiError.validation_error'),
              fields: { email: t('auth.error.emailTaken') },
            })
          }
          const user: StoredUser = {
            id: newId(),
            email,
            fullName,
            locale: 'ru',
            companyId: null,
            role: 'owner',
            password: input.password,
          }
          data.users.push(user)
          data.session = { userId: user.id, accessToken: `mock.${newToken()}` }
          return { accessToken: data.session.accessToken, user: toUser(user) }
        })
      })
    },

    login(input) {
      const runtime = getRuntime()
      return runtime.call((): AuthSession => {
        const email = normalizeEmail(input.email)
        if (overLimit(email, runtime.now().getTime())) {
          throw new ApiError({ code: 'rate_limited', message: t('apiError.rate_limited') })
        }
        return runtime.store.writeAll((data) => {
          const user = data.users.find((u) => normalizeEmail(u.email) === email)
          if (!user || user.password !== input.password) throw unauthorized(t('auth.error.wrongCredentials'))
          attempts.delete(email)
          data.session = { userId: user.id, accessToken: `mock.${newToken()}` }
          return { accessToken: data.session.accessToken, user: toUser(user) }
        })
      })
    },

    me() {
      const runtime = getRuntime()
      return runtime.call((): Me =>
        runtime.store.readAll((data) => {
          const user = sessionUser(data)
          const company = user.companyId ? data.companies.find((c) => c.id === user.companyId) : undefined
          return { user: toUser(user), companies: company ? [toCompany(company)] : [] }
        }),
      )
    },

    logout() {
      const runtime = getRuntime()
      // Never fails, so an error forced in the dev panel waits for the next call instead.
      return runtime.call(
        () =>
          runtime.store.writeAll((data) => {
            data.session = null
          }),
        { injectable: false },
      )
    },
  }
}
