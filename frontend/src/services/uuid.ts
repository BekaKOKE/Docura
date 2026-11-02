// UUIDs: the idempotency keys the screens send, and the ids the mock makes. `crypto.randomUUID()` exists only in
// secure contexts, and the phone opens the dev server over plain http on the LAN (AGENTS.md, "phone on the LAN"), so
// they are made from `getRandomValues`, which works everywhere.

/** A UUID in its usual text form, any version, either case: what `format: uuid` in contracts/openapi.yaml accepts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** A random lowercase RFC 4122 version 4 UUID, like the ids the backend makes. */
export function newUuid(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * An idempotency key (`clientRequestId`) for one request: sent again, by a repeated tap or a retry after a lost answer,
 * it makes one document or payment. Make it once per request and keep it; never make a new one for a retry.
 */
export function newRequestId(): string {
  return newUuid()
}
