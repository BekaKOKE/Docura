// Ids and tokens for the mock. `crypto.randomUUID()` exists only in secure contexts, and the phone
// opens the dev server over plain http on the LAN (AGENTS.md, "phone on the LAN"), so ids are made
// from `getRandomValues`, which works everywhere.

import { newUuid } from '../uuid'

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

/** A random UUID v4 string, like the ids the backend makes: the same helper as the screens' request ids. */
export const newId = newUuid

/** A URL-safe random token (public links, mock access tokens). */
export function newToken(byteLength = 32): string {
  return btoa(String.fromCharCode(...randomBytes(byteLength)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
