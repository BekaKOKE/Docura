import { describe, expect, it } from 'vitest'
import { isApiError } from '../errors'
import { NotImplementedError } from '../notImplemented'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD } from './seed'
import { createStore } from './store'

// payments.list (#28): the payments of an invoice for its card, oldest first. Recording one is #30.

const instant = async () => {}
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

async function signedIn(email = 'seitkali@example.kz') {
  const store = createStore({ storage: null })
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(START) })
  const services = createMockServices(() => runtime)
  await services.auth.login({ email, password: DEV_PASSWORD })
  return services
}

describe('payments.list', () => {
  it('lists the payments of a partly paid invoice, and their sum is what the invoice says is paid', async () => {
    const services = await signedIn()
    const invoices = (await services.documents.list({ type: 'invoice', limit: 200 })).items
    const paid = invoices.find((invoice) => (invoice.payment?.paidTiyn ?? 0) > 0)
    expect(paid, 'the seed has an invoice with a payment').toBeDefined()

    const payments = await services.payments.list(paid!.id)

    expect(payments.length).toBeGreaterThan(0)
    expect(payments.every((payment) => payment.documentId === paid!.id)).toBe(true)
    expect(payments.reduce((sum, payment) => sum + payment.amountTiyn, 0)).toBe(paid!.payment!.paidTiyn)
    for (const payment of payments) {
      expect(payment.method).toMatch(/^(cash|kaspi|transfer|card|other)$/)
      expect(payment.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('is oldest first', async () => {
    const services = await signedIn()
    const invoices = (await services.documents.list({ type: 'invoice', limit: 200 })).items
    for (const invoice of invoices) {
      const dates = (await services.payments.list(invoice.id)).map((payment) => payment.paidOn)
      expect(dates, invoice.number ?? invoice.id).toEqual([...dates].sort())
    }
  })

  it('is empty for an invoice with no payment', async () => {
    const services = await signedIn()
    const invoices = (await services.documents.list({ type: 'invoice', limit: 200 })).items
    const unpaid = invoices.find((invoice) => invoice.payment?.paidTiyn === 0)
    expect(unpaid, 'the seed has an unpaid invoice').toBeDefined()
    expect(await services.payments.list(unpaid!.id)).toEqual([])
  })

  it("is a 404 for an unknown id and for another company's invoice", async () => {
    const services = await signedIn()
    const invoice = (await services.documents.list({ type: 'invoice', limit: 200 })).items[0]!
    const unknown = await services.payments.list('00000000-0000-4000-8000-000000000000').catch((e: unknown) => e)
    expect(isApiError(unknown) && unknown.code).toBe('not_found')

    await services.auth.logout()
    await services.auth.login({ email: 'nurlanov@example.kz', password: DEV_PASSWORD })
    const foreign = await services.payments.list(invoice.id).catch((e: unknown) => e)
    expect(isApiError(foreign) && foreign.code).toBe('not_found')
  })

  it('recording and removing a payment are not built yet (#30)', async () => {
    const services = await signedIn()
    await expect(services.payments.create('x', { amountTiyn: 100, method: 'cash', paidOn: '2026-10-20', clientRequestId: 'k' })).rejects.toBeInstanceOf(NotImplementedError)
    await expect(services.payments.remove('x')).rejects.toBeInstanceOf(NotImplementedError)
  })
})
