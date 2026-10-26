import { isApiError, type ApiFieldErrors } from '../services'
import { errorText } from './errorText'

export interface ServerProblem {
  /** Messages for the fields the server named, keyed by field. */
  fields: Record<string, string>
  /** A message for the whole form, when the server named no field of this form. */
  banner: string | null
  /** True when sending the same thing again can help (a lost call, a rate limit); false for a wrong password. */
  retryable: boolean
}

/** Sorts a failed call into messages under fields and a message above the form. */
export function serverProblem(error: unknown, formFields: readonly string[]): ServerProblem {
  if (isApiError(error) && error.code === 'validation_error' && error.fields) {
    const named = Object.entries(error.fields as ApiFieldErrors).filter(([field]) => formFields.includes(field))
    if (named.length > 0) return { fields: Object.fromEntries(named), banner: null, retryable: false }
  }
  // A wrong password can't be fixed by sending it again; anything else (a lost call, a limit) can.
  const wrongCredentials = isApiError(error) && error.code === 'unauthorized'
  return { fields: {}, banner: errorText(error), retryable: !wrongCredentials }
}
