// What the sign-up and sign-in forms check before they call the service (the service checks again).
// Each rule returns a dictionary key, never text.

import type { MessageKey } from '../../i18n/t'

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
