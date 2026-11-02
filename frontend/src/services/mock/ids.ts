// Ids and tokens for the mock. `crypto.randomUUID()` exists only in secure contexts, and the phone
// opens the dev server over plain http on the LAN (AGENTS.md, "phone on the LAN"), so ids are made
// from `getRandomValues`, which works everywhere.

import { t } from '../../i18n/t'
import { ApiError } from '../errors'
import { isUuid, newUuid } from '../uuid'

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

/** A random UUID v4 string, like the ids the backend makes: the same helper as the screens' request ids. */
export const newId = newUuid

/**
 * Refuses an idempotency key that is not a UUID (`format: uuid` in contracts/openapi.yaml), as the backend will: a
 * `validation_error` on `clientRequestId`. `required` where the contract requires the key (convert, payments).
 */
export function checkRequestId(value: string | null | undefined, required: boolean): void {
  if (value == null && !required) return
  if (!isUuid(value)) {
    throw new ApiError({
      code: 'validation_error',
      message: t('apiError.validation_error'),
      fields: { clientRequestId: t('validation.requestIdInvalid') },
    })
  }
}

/** A URL-safe random token (public links, mock access tokens). */
export function newToken(byteLength = 32): string {
  return btoa(String.fromCharCode(...randomBytes(byteLength)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
