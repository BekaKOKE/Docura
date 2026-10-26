import { t } from '../i18n/t'
import { isApiError } from '../services'

/** A message the user can read for any failure: an ApiError's own (Russian) text, else the code's, else a generic one. */
export function errorText(error: unknown): string {
  if (isApiError(error)) {
    return /[А-Яа-яЁё]/.test(error.message) ? error.message : t(`apiError.${error.code}`)
  }
  return t('error.generic')
}
