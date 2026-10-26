// What the sign-up and sign-in forms check before they call the service (the service checks again).
// Each rule returns a dictionary key, never text.

import type { MessageKey } from '../../i18n/t'
import { isApiError, type ApiFieldErrors } from '../../services'
import { errorText } from '../errorText'

export const MIN_PASSWORD_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): MessageKey | null {
  const email = value.trim()
  if (email === '') return 'auth.error.emailRequired'
  return EMAIL_PATTERN.test(email) ? null : 'auth.error.emailInvalid'
}

/** `forNewAccount`: a new password must be long enough; an existing one is only checked by the server. */
export function validatePassword(value: string, forNewAccount: boolean): MessageKey | null {
  if (value === '') return 'auth.error.passwordRequired'
  return forNewAccount && value.length < MIN_PASSWORD_LENGTH ? 'auth.error.passwordShort' : null
}

export function validateFullName(value: string): MessageKey | null {
  return value.trim() === '' ? 'auth.error.nameRequired' : null
}

export interface ServerProblem {
  /** Messages for the fields the server named, keyed by field. */
  fields: Record<string, string>
  /** A message for the whole form, when the server named no field of this form. */
  banner: string | null
  /** True when trying the same thing again can help (a lost call, a rate limit), not when the data must change. */
  retryable: boolean
}

/** Sorts a failed call into messages under fields and a message above the form. */
export function serverProblem(error: unknown, formFields: readonly string[]): ServerProblem {
  if (isApiError(error) && error.code === 'validation_error' && error.fields) {
    const named = Object.entries(error.fields as ApiFieldErrors).filter(([field]) => formFields.includes(field))
    if (named.length > 0) return { fields: Object.fromEntries(named), banner: null, retryable: false }
  }
  const dataProblem = isApiError(error) && (error.code === 'unauthorized' || error.code === 'validation_error')
  return { fields: {}, banner: errorText(error), retryable: !dataProblem }
}
