import { describe, expect, it } from 'vitest'
import { isApiError } from '../errors'
import type { ConvertInput, PaymentInput } from '../types'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

// #83 AC 3, TC-5: `clientRequestId` is `format: uuid` in the contract, and the mock refuses anything else the way the
// backend will: validation_error (422) on `clientRequestId`, and nothing is made.

const instant = async () => {}
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

async function signedIn() {
  const store = createStore({ storage: null })
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(START) })
  const services = createMockServices(() => runtime)
  await services.auth.login({ email: 'seitkali@example.kz', password: DEV_PASSWORD })
  const all = (await services.documents.list({ limit: 200 })).items
  const signedQuote = all.find((d) => d.type === 'quote' && d.status === 'signed')!
  const unpaidInvoice = all.find((d) => d.type === 'invoice' && d.status === 'issued' && d.payment?.state === 'unpaid')!
  return { services, signedQuote, unpaidInvoice }
}

const kairat = seed.clients.find((c) => c.name === 'Қайрат Әбілқасымов')!
const quoteInput = {
  type: 'quote' as const,
  clientId: kairat.id,
  vatEnabled: true,
  lines: [{ kind: 'service' as const, title: 'Укладка ламината', unit: 'м²', qtyMilli: 12500, unitPriceTiyn: 1850000 }],
}
const payment = (clientRequestId: string): PaymentInput => ({ amountTiyn: 100, method: 'kaspi', paidOn: '2026-10-20', clientRequestId })

async function refusal(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  return isApiError(error) ? [error.code, error.status, Object.keys(error.fields ?? {})] : error
}
const REFUSED = ['validation_error', 422, ['clientRequestId']]
const NOT_UUIDS = ['used-once', 'pm-mh1x2k-ab12cd34', '', '6d1d1f0e8d0a4f6b9a2e1b2c3d4e5f60']

describe('a clientRequestId that is not a UUID', () => {
  it('is refused by documents.create, and no draft is made', async () => {
    const { services } = await signedIn()
    const before = (await services.documents.list({ limit: 200 })).total
    for (const key of NOT_UUIDS) {
      expect(await refusal(services.documents.create({ ...quoteInput, clientRequestId: key })), key).toEqual(REFUSED)
    }
    expect((await services.documents.list({ limit: 200 })).total).toBe(before)
  })

  it('is refused by documents.convert to an invoice and to an act, and nothing is made', async () => {
    const { services, signedQuote } = await signedIn()
    const before = (await services.documents.get(signedQuote.id)).children.length
    for (const key of NOT_UUIDS) {
      const invoice: ConvertInput = { target: 'invoice', basis: 'full', issue: true, clientRequestId: key }
      expect(await refusal(services.documents.convert(signedQuote.id, invoice)), key).toEqual(REFUSED)
      expect(await refusal(services.documents.convert(signedQuote.id, { target: 'act', clientRequestId: key })), key).toEqual(REFUSED)
    }
    expect((await services.documents.get(signedQuote.id)).children).toHaveLength(before)
  })

  it('is refused by payments.create, and no payment is recorded', async () => {
    const { services, unpaidInvoice } = await signedIn()
    for (const key of NOT_UUIDS) {
      expect(await refusal(services.payments.create(unpaidInvoice.id, payment(key))), key).toEqual(REFUSED)
    }
    expect(await services.payments.list(unpaidInvoice.id)).toEqual([])
  })

  it('is refused when missing where the contract requires it (convert, payments), and allowed on create', async () => {
    const { services, signedQuote, unpaidInvoice } = await signedIn()
    const noKey = { target: 'invoice', basis: 'full' } as unknown as ConvertInput
    expect(await refusal(services.documents.convert(signedQuote.id, noKey))).toEqual(REFUSED)
    expect(await refusal(services.payments.create(unpaidInvoice.id, { ...payment(''), clientRequestId: undefined } as never))).toEqual(REFUSED)
    expect((await services.documents.create(quoteInput)).status).toBe('draft')
  })

  it('carries a Russian message for the field', async () => {
    const { services } = await signedIn()
    const error = await services.documents.create({ ...quoteInput, clientRequestId: 'used-once' }).catch((e: unknown) => e)
    expect(isApiError(error) && error.fields?.clientRequestId).toBe('Запрос не отправлен. Обновите страницу и попробуйте ещё раз.')
  })
})

describe('a UUID clientRequestId', () => {
  it('in either case is taken, and the same key again makes one document', async () => {
    const { services } = await signedIn()
    const key = '6D1D1F0E-8D0A-4F6B-9A2E-1B2C3D4E5F60'
    const first = await services.documents.create({ ...quoteInput, clientRequestId: key })
    const again = await services.documents.create({ ...quoteInput, clientRequestId: key })
    expect(again.id).toBe(first.id)
  })
})
