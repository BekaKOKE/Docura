import { afterEach, describe, expect, it, vi } from 'vitest'
import { isUuid, newRequestId, newUuid } from './uuid'

// #83: the idempotency keys are lowercase RFC 4122 version 4 UUIDs, also where `crypto.randomUUID` is missing.

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newRequestId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('makes 1000 distinct v4 UUIDs without crypto.randomUUID, as over plain http on the LAN (TC-3)', () => {
    const { getRandomValues } = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(globalThis.crypto) })
    expect(globalThis.crypto.randomUUID).toBeUndefined()
    const keys = Array.from({ length: 1000 }, () => newRequestId())
    for (const key of keys) expect(key).toMatch(V4)
    expect(new Set(keys).size).toBe(1000)
  })

  it('sets the version and variant bits whatever the random bytes are', () => {
    for (const fill of [0x00, 0xff]) {
      vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(fill) })
      expect(newUuid()).toMatch(V4)
    }
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0) })
    expect(newUuid()).toBe('00000000-0000-4000-8000-000000000000')
  })
})

describe('isUuid', () => {
  it('takes a UUID in its text form, any version or case', () => {
    expect(isUuid(newUuid())).toBe(true)
    expect(isUuid('6D1D1F0E-8D0A-4F6B-9A2E-1B2C3D4E5F60')).toBe(true)
    expect(isUuid('e3bc7ccf-e8aa-599e-b602-fdd8495bc378')).toBe(true)
  })

  it('refuses the keys the screens made before #83, and anything else', () => {
    for (const value of ['used-once', 'pm-mh1x2k-ab12cd34', 'qe-1', 'cv-1', 'act-1', '', '6d1d1f0e8d0a4f6b9a2e1b2c3d4e5f60', ' 6d1d1f0e-8d0a-4f6b-9a2e-1b2c3d4e5f60', null, undefined, 42]) {
      expect(isUuid(value), String(value)).toBe(false)
    }
  })
})
