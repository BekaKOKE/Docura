import { describe, expect, it } from 'vitest'
import { isApiError } from '../errors'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

// documents.signatureBlob (#22): the image of a signature that exists, for the quote's card.

const instant = async () => {}
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

function setup() {
  const store = createStore({ storage: null })
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(START) })
  return createMockServices(() => runtime)
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

describe('documents.signatureBlob', () => {
  it('returns the PNG of a signed quote', async () => {
    const services = setup()
    await services.auth.login({ email: 'seitkali@example.kz', password: DEV_PASSWORD })
    const signed = (await services.documents.list({ type: 'quote' })).items.find((d) => d.status === 'signed')
    expect(signed, 'the seed has a signed quote').toBeDefined()

    const blob = await services.documents.signatureBlob(signed!.id)

    expect(blob.type).toBe('image/png')
    expect(blob.size).toBeGreaterThan(100)
    const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 4)
    expect([...head]).toEqual(PNG_MAGIC)
  })

  it('is a 404 for a quote that has no signature', async () => {
    const services = setup()
    await services.auth.login({ email: 'seitkali@example.kz', password: DEV_PASSWORD })
    const unsigned = (await services.documents.list({ type: 'quote' })).items.find((d) => d.status !== 'signed')!

    const error = await services.documents.signatureBlob(unsigned.id).catch((e: unknown) => e)

    expect(isApiError(error) && error.code).toBe('not_found')
  })

  it("is a 404 for another company's signed quote", async () => {
    const services = setup()
    await services.auth.login({ email: 'seitkali@example.kz', password: DEV_PASSWORD })
    const signed = (await services.documents.list({ type: 'quote' })).items.find((d) => d.status === 'signed')!
    await services.auth.logout()
    const other = seed.users.find((u) => u.email === 'nurlanov@example.kz')!
    await services.auth.login({ email: other.email, password: DEV_PASSWORD })

    const error = await services.documents.signatureBlob(signed.id).catch((e: unknown) => e)

    expect(isApiError(error) && error.code).toBe('not_found')
  })
})
