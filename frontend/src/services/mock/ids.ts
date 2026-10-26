// Ids and tokens for the mock. `crypto.randomUUID()` exists only in secure contexts, and the phone
// opens the dev server over plain http on the LAN (AGENTS.md, "phone on the LAN"), so ids are made
// from `getRandomValues`, which works everywhere.

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

/** A random UUID v4 string, like the ids the backend makes. */
export function newId(): string {
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = hex(bytes)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** A URL-safe random token (public links, mock access tokens). */
export function newToken(byteLength = 32): string {
  return btoa(String.fromCharCode(...randomBytes(byteLength)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
