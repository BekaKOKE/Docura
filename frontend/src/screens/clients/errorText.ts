import { t } from '../../i18n/t'
import { isApiError } from '../../services'

/** The Russian sentence for a failed call: an ApiError carries one, anything else gets the general text. */
export function errorText(error: unknown): string {
  return isApiError(error) ? error.message : t('error.generic')
}
