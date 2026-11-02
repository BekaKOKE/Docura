import { describe, expect, it } from 'vitest'
import { formatMoney } from '../../domain'
import { isApiError } from '../errors'
import type { PaymentInput } from '../types'
import { newRequestId } from '../uuid'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD } from './seed'
import { createStore } from './store'

// payments.list (#28): the payments of an invoice for its card, oldest first. payments.create and payments.remove: #30.

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
})

// ---------------------------------------------------------------- create and remove (#30)

type Services = Awaited<ReturnType<typeof signedIn>>

const input = (amountTiyn: number, patch: Partial<PaymentInput> = {}): PaymentInput => ({
  amountTiyn,
  method: 'kaspi',
  paidOn: '2026-10-20',
  clientRequestId: newRequestId(),
  ...patch,
})

async function invoiceIn(services: Services, state: 'unpaid' | 'partial' | 'overdue') {
  const invoices = (await services.documents.list({ type: 'invoice', limit: 200 })).items
  const found = invoices.find((invoice) => invoice.status === 'issued' && invoice.payment?.state === state)
  expect(found, `the seed has an issued ${state} invoice`).toBeDefined()
  return found!
}

const caught = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  )

describe('payments.create', () => {
  it('pays the whole balance: the invoice becomes paid and the balance is zero (AC 1, 5)', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')

    const result = await services.payments.create(invoice.id, input(invoice.payment!.balanceTiyn, { note: '  Перевод на Kaspi  ' }))

    expect(result.paymentState).toBe('paid')
    expect(result.balanceTiyn).toBe(0)
    expect(result.payment).toMatchObject({ documentId: invoice.id, amountTiyn: invoice.grossTiyn, method: 'kaspi', paidOn: '2026-10-20', note: 'Перевод на Kaspi', currency: 'KZT' })
    expect(Object.keys(result.payment)).not.toContain('clientRequestId')
    // The card and the list now say so (AC 5).
    expect((await services.documents.get(invoice.id)).payment).toEqual({ state: 'paid', paidTiyn: invoice.grossTiyn, balanceTiyn: 0 })
    const listed = (await services.documents.list({ type: 'invoice', limit: 200 })).items.find((row) => row.id === invoice.id)
    expect(listed?.payment?.state).toBe('paid')
    expect(await services.payments.list(invoice.id)).toEqual([result.payment])
  })

  it('a part makes it partly paid, the rest makes it paid (TC-5)', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const part = Math.floor(invoice.grossTiyn * 0.4)

    const first = await services.payments.create(invoice.id, input(part))
    expect(first.paymentState).toBe('partial')
    expect(first.balanceTiyn).toBe(invoice.grossTiyn - part)
    expect((await services.documents.get(invoice.id)).payment).toEqual({ state: 'partial', paidTiyn: part, balanceTiyn: invoice.grossTiyn - part })

    const second = await services.payments.create(invoice.id, input(first.balanceTiyn, { method: 'cash' }))
    expect(second.paymentState).toBe('paid')
    expect((await services.payments.list(invoice.id)).map((p) => p.method)).toEqual(['kaspi', 'cash'])
  })

  it('an invoice past its due date stays overdue after half and is paid after the rest (TC-5)', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'overdue')
    const balance = invoice.payment!.balanceTiyn
    const half = Math.floor(balance / 2)

    const first = await services.payments.create(invoice.id, input(half))
    expect(first.paymentState).toBe('overdue')
    expect((await services.documents.get(invoice.id)).payment?.state).toBe('overdue')

    const second = await services.payments.create(invoice.id, input(balance - half))
    expect(second.paymentState).toBe('paid')
    expect(second.balanceTiyn).toBe(0)
  })

  it('takes one tiyn and keeps the balance to the tiyn (TC-7)', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const result = await services.payments.create(invoice.id, input(1))
    expect(result.balanceTiyn).toBe(invoice.grossTiyn - 1)
    expect(result.paymentState).toBe('partial')
  })

  it('refuses more than the balance, 409 overpayment, and says by how much (AC 3, TC-3)', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const balance = invoice.payment!.balanceTiyn

    const error = await caught(services.payments.create(invoice.id, input(balance + 1_200_000)))

    expect(isApiError(error) && [error.code, error.status]).toEqual(['overpayment', 409])
    expect((error as Error).message).toBe(`Больше остатка на ${formatMoney(1_200_000)}. Проверьте сумму.`)
    expect((error as Error).message.replace(/\s/g, ' ')).toContain('Больше остатка на 12 000 ₸. Проверьте сумму.')
    // Nothing was saved.
    expect(await services.payments.list(invoice.id)).toEqual([])
    expect((await services.documents.get(invoice.id)).payment?.paidTiyn).toBe(0)
  })

  it('counts earlier payments: after a part, the rest plus one tiyn is over by one tiyn', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const first = await services.payments.create(invoice.id, input(6_478_600))
    const error = await caught(services.payments.create(invoice.id, input(first.balanceTiyn + 1)))
    expect(isApiError(error) && error.code).toBe('overpayment')
    expect((error as Error).message).toBe(`Больше остатка на ${formatMoney(1)}. Проверьте сумму.`)
  })

  it('a paid invoice takes nothing more', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    await services.payments.create(invoice.id, input(invoice.payment!.balanceTiyn))
    const error = await caught(services.payments.create(invoice.id, input(100)))
    expect(isApiError(error) && error.code).toBe('overpayment')
  })

  it('a repeated clientRequestId is one payment, also after the invoice is paid (AC 6, TC-6)', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const request = input(invoice.payment!.balanceTiyn, { clientRequestId: '0b7c3e8a-1d2f-4a5b-9c6d-7e8f9a0b1c2d' })

    const [a, b] = await Promise.all([services.payments.create(invoice.id, request), services.payments.create(invoice.id, request)])
    const again = await services.payments.create(invoice.id, request)

    expect(b.payment.id).toBe(a.payment.id)
    expect(again.payment.id).toBe(a.payment.id)
    expect(again.paymentState).toBe('paid')
    expect(await services.payments.list(invoice.id)).toHaveLength(1)
    expect((await services.documents.get(invoice.id)).payment?.paidTiyn).toBe(invoice.grossTiyn)
  })

  it('a key is unique per company: reused on another invoice it records nothing and answers with the first payment', async () => {
    const services = await signedIn()
    const first = await invoiceIn(services, 'unpaid')
    const other = await invoiceIn(services, 'overdue')
    const before = (await services.payments.list(other.id)).length
    const request = input(100, { clientRequestId: '5f4e3d2c-1b0a-4987-a654-3210fedcba98' })

    const made = await services.payments.create(first.id, request)
    const reused = await services.payments.create(other.id, request)

    expect(reused.payment).toEqual(made.payment)
    expect(reused.payment.documentId).toBe(first.id)
    expect(reused.balanceTiyn).toBe(made.balanceTiyn)
    expect(await services.payments.list(other.id)).toHaveLength(before)
  })

  it('refuses a bad amount, method or date with a message under its own field', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const cases: [Partial<PaymentInput>, string][] = [
      [{ amountTiyn: 0 }, 'amountTiyn'],
      [{ amountTiyn: -100 }, 'amountTiyn'],
      [{ amountTiyn: 10.5 }, 'amountTiyn'],
      [{ amountTiyn: Number.NaN }, 'amountTiyn'],
      [{ method: 'bitcoin' as never }, 'method'],
      [{ paidOn: '2026-02-30' }, 'paidOn'],
      [{ paidOn: '' }, 'paidOn'],
      [{ note: 'я'.repeat(501) }, 'note'],
    ]
    for (const [patch, field] of cases) {
      const error = await caught(services.payments.create(invoice.id, input(100, patch)))
      expect(isApiError(error) && [error.code, error.status, Object.keys(error.fields ?? {})], JSON.stringify(patch)).toEqual(['validation_error', 422, [field]])
    }
    const zero = await caught(services.payments.create(invoice.id, input(0)))
    expect(isApiError(zero) && zero.fields?.amountTiyn).toBe('Укажите сумму')
    expect(await services.payments.list(invoice.id)).toEqual([])
  })

  it('keeps an empty note as null', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    expect((await services.payments.create(invoice.id, input(100, { note: '   ' }))).payment.note).toBeNull()
    expect((await services.payments.create(invoice.id, input(100, { note: null }))).payment.note).toBeNull()
  })

  it('takes payments only on an issued invoice: a quote is document_locked', async () => {
    const services = await signedIn()
    const quote = (await services.documents.list({ type: 'quote', limit: 200 })).items.find((q) => q.status === 'signed')
    expect(quote, 'the seed has a signed quote').toBeDefined()
    const error = await caught(services.payments.create(quote!.id, input(100)))
    expect(isApiError(error) && [error.code, error.status]).toEqual(['document_locked', 409])
    expect((error as Error).message).toBe('Оплату можно записать только по выставленному счёту.')
  })

  it('is a draft invoice document_locked too', async () => {
    const services = await signedIn()
    const quote = (await services.documents.list({ type: 'quote', limit: 200 })).items.find((q) => q.status === 'signed')!
    const draft = await services.documents.convert(quote.id, { target: 'invoice', basis: 'amount', basisValue: 100_000, clientRequestId: 'd7a1c9e2-3b4f-4c5d-8e6f-0a1b2c3d4e5f' })
    expect(draft.status).toBe('draft')
    const error = await caught(services.payments.create(draft.id, input(100)))
    expect(isApiError(error) && error.code).toBe('document_locked')
  })

  it("is a 404 for an unknown invoice and for another company's invoice", async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const unknown = await caught(services.payments.create('00000000-0000-4000-8000-000000000000', input(100)))
    expect(isApiError(unknown) && unknown.code).toBe('not_found')

    await services.auth.logout()
    await services.auth.login({ email: 'nurlanov@example.kz', password: DEV_PASSWORD })
    const foreign = await caught(services.payments.create(invoice.id, input(100)))
    expect(isApiError(foreign) && [foreign.code, foreign.status]).toEqual(['not_found', 404])
  })
})

describe('payments.remove', () => {
  it('deletes the payment and gives the balance back (AC 4, TC-4)', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const { payment } = await services.payments.create(invoice.id, input(invoice.payment!.balanceTiyn))
    expect((await services.documents.get(invoice.id)).payment?.state).toBe('paid')

    await services.payments.remove(payment.id)

    expect(await services.payments.list(invoice.id)).toEqual([])
    expect((await services.documents.get(invoice.id)).payment).toEqual({ state: 'unpaid', paidTiyn: 0, balanceTiyn: invoice.grossTiyn })
  })

  it('takes back the last of two payments only', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const first = await services.payments.create(invoice.id, input(1_000_000))
    const second = await services.payments.create(invoice.id, input(2_000_000))
    await services.payments.remove(second.payment.id)
    expect((await services.payments.list(invoice.id)).map((p) => p.id)).toEqual([first.payment.id])
    expect((await services.documents.get(invoice.id)).payment).toMatchObject({ state: 'partial', paidTiyn: 1_000_000 })
  })

  it('is a 404 the second time and for an unknown id', async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const { payment } = await services.payments.create(invoice.id, input(100))
    await services.payments.remove(payment.id)
    const again = await caught(services.payments.remove(payment.id))
    expect(isApiError(again) && again.code).toBe('not_found')
    const unknown = await caught(services.payments.remove('00000000-0000-4000-8000-000000000000'))
    expect(isApiError(unknown) && unknown.code).toBe('not_found')
  })

  it("is a 404 for another company's payment, which stays where it was", async () => {
    const services = await signedIn()
    const invoice = await invoiceIn(services, 'unpaid')
    const { payment } = await services.payments.create(invoice.id, input(100))

    await services.auth.logout()
    await services.auth.login({ email: 'nurlanov@example.kz', password: DEV_PASSWORD })
    const foreign = await caught(services.payments.remove(payment.id))
    expect(isApiError(foreign) && [foreign.code, foreign.status]).toEqual(['not_found', 404])

    await services.auth.logout()
    await services.auth.login({ email: 'seitkali@example.kz', password: DEV_PASSWORD })
    expect(await services.payments.list(invoice.id)).toHaveLength(1)
  })
})
