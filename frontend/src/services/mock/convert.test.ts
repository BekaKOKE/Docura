import { describe, expect, it } from 'vitest'
import { isApiError } from '../errors'
import { NotImplementedError } from '../notImplemented'
import type { ConvertInput, Document, DocumentInput, Id } from '../types'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

// documents.convert for invoices (#27): a signed quote becomes a full invoice or a prepayment, never more in sum
// than the quote total.

const instant = async () => {}

const SEITKALI = { email: 'seitkali@example.kz', password: DEV_PASSWORD }
const NURLANOV = { email: 'nurlanov@example.kz', password: DEV_PASSWORD }

/** 20.10.2026 11:00 in Asia/Almaty. */
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function setup() {
  const store = createStore({ storage: null })
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(START) })
  return { store, services: createMockServices(() => runtime) }
}
type Services = ReturnType<typeof setup>['services']

const seitkaliCompany = seed.companies[0]!
const kairat = seed.clients.find((c) => c.companyId === seitkaliCompany.id)!
const nurlanovClient = seed.clients.find((c) => c.companyId === seed.companies[1]!.id)!

const seededQuote = (status: string, predicate: (gross: number) => boolean = () => true) =>
  seed.documents.find((d) => d.type === 'quote' && d.companyId === seitkaliCompany.id && d.status === status && predicate(d.grossTiyn))!

// 12.5 м² x 18 500 ₸ and 32 п.м. x 1 500 ₸: net 279 250 ₸, VAT 44 680 ₸, gross 323 930 ₸.
const REFERENCE: DocumentInput = {
  type: 'quote',
  clientId: kairat.id,
  vatEnabled: true,
  lines: [
    { kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12500, unitPriceTiyn: 1850000 },
    { kind: 'material', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32000, unitPriceTiyn: 150000 },
  ],
}

let requestCounter = 0
const requestId = (): Id => `00000000-0000-4000-8000-${String(++requestCounter).padStart(12, '0')}`

/** A new quote of the signed-in company, issued and signed by the client with the finger. */
async function signedQuote(services: Services, clientId: Id = kairat.id): Promise<Document> {
  const draft = await services.documents.create({ ...REFERENCE, clientId })
  const sent = await services.documents.issue(draft.id)
  const token = sent.shareUrl!.split('/p/')[1]!
  await services.public.sign(token, {
    signerName: 'Асет Нұрланов',
    signaturePng: PNG_1X1,
    consentAccepted: true,
    personalDataConsent: true,
    version: sent.version,
  })
  return services.documents.get(sent.id)
}

const invoiceOf = (basis: 'full' | 'remaining', extra: Partial<ConvertInput> = {}): ConvertInput =>
  ({ target: 'invoice', basis, clientRequestId: requestId(), issue: true, ...extra }) as ConvertInput
const percent = (basisValue: number, extra: Partial<ConvertInput> = {}): ConvertInput =>
  ({ target: 'invoice', basis: 'percent', basisValue, clientRequestId: requestId(), issue: true, ...extra }) as ConvertInput
const amount = (basisValue: number, extra: Partial<ConvertInput> = {}): ConvertInput =>
  ({ target: 'invoice', basis: 'amount', basisValue, clientRequestId: requestId(), issue: true, ...extra }) as ConvertInput

const errorOf = (promise: Promise<unknown>) => promise.then(() => undefined, (e: unknown) => e)
async function expectError(promise: Promise<unknown>, code: string) {
  const error = await errorOf(promise)
  expect(isApiError(error) && error.code, `expected ${code}`).toBe(code)
  return error as Exclude<typeof error, undefined> & { fields?: Record<string, string>; message: string; status: number }
}
const plainSpaces = (text: string) => text.replace(/\s/g, ' ')

const TENGE = 100
const figures = (doc: Document) => ({ net: doc.netTiyn, vat: doc.vatTiyn, gross: doc.grossTiyn })

describe('convert to a full invoice', () => {
  it('copies both lines and the totals of the quote, numbered СЧ-2026-NNNN', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const invoice = await services.documents.convert(quote.id, invoiceOf('full'))

    expect(figures(invoice)).toEqual({ net: 279250 * TENGE, vat: 44680 * TENGE, gross: 323930 * TENGE })
    expect(invoice.number).toMatch(/^СЧ-2026-\d{4}$/)
    expect(invoice).toMatchObject({
      type: 'invoice',
      status: 'issued',
      sourceDocumentId: quote.id,
      clientId: quote.clientId,
      basis: 'full',
      basisValue: null,
      vatEnabled: true,
      vatRateBp: 1600,
      currency: 'KZT',
      issueDate: '2026-10-20',
      dueDate: '2026-10-25',
      issuedAt: '2026-10-20T06:00:00Z',
      contractRef: `КП № ${quote.number} от 20.10.2026`,
      notes: null,
      terms: null,
    })
    expect(invoice.clientSnapshot).toEqual(quote.clientSnapshot)
    expect(invoice.lines.map(({ id: _id, ...line }) => line)).toEqual(quote.lines.map(({ id: _id, ...line }) => line))
    expect(invoice.lines.map((l) => l.id)).not.toContain(quote.lines[0]!.id)
    expect(invoice.shareUrl).toMatch(/\/p\/.+/)
  })

  it('is refused once another invoice exists', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)
    await services.documents.convert(quote.id, percent(5000))

    const error = await expectError(services.documents.convert(quote.id, invoiceOf('full')), 'exceeds_quote_total')

    expect(plainSpaces(error.message)).toContain('Можно выставить ещё: 161 965 ₸')
  })

  it('works on a seeded signed quote that has no invoice yet, and is refused on one that has', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const invoiced = new Set(seed.documents.filter((d) => d.type === 'invoice').map((d) => d.sourceDocumentId))
    const withInvoice = seed.documents.find((d) => d.type === 'quote' && d.status === 'signed' && d.companyId === seitkaliCompany.id && invoiced.has(d.id))!

    await expectError(services.documents.convert(withInvoice.id, invoiceOf('full')), 'exceeds_quote_total')
  })
})

describe('convert to a prepayment', () => {
  it('50 % makes one titled line: gross 161 965, VAT 22 340, net 139 625', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const invoice = await services.documents.convert(quote.id, percent(5000))

    expect(figures(invoice)).toEqual({ net: 139625 * TENGE, vat: 22340 * TENGE, gross: 161965 * TENGE })
    expect(invoice).toMatchObject({ basis: 'percent', basisValue: 5000, status: 'issued' })
    expect(invoice.lines).toHaveLength(1)
    expect(invoice.lines[0]).toMatchObject({
      title: `Предоплата 50% по КП № ${quote.number} от 20.10.2026`,
      kind: 'service',
      unit: 'услуга',
      qtyMilli: 1000,
      articleId: null,
      netTiyn: 139625 * TENGE,
      vatTiyn: 22340 * TENGE,
      grossTiyn: 161965 * TENGE,
    })
    // The stored line adds up to the document.
    const sum = invoice.lines.reduce((acc, l) => ({ net: acc.net + l.netTiyn, vat: acc.vat + l.vatTiyn }), { net: 0, vat: 0 })
    expect(sum).toEqual({ net: invoice.netTiyn, vat: invoice.vatTiyn })
    expect(invoice.netTiyn + invoice.vatTiyn).toBe(invoice.grossTiyn)
  })

  it('then "remaining" takes the other 161 965 ₸, and nothing more can be invoiced', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)
    await services.documents.convert(quote.id, percent(5000))

    const rest = await services.documents.convert(quote.id, invoiceOf('remaining'))

    expect(figures(rest)).toEqual({ net: 139625 * TENGE, vat: 22340 * TENGE, gross: 161965 * TENGE })
    expect(rest).toMatchObject({ basis: 'remaining', basisValue: null })
    expect(rest.lines[0]!.title).toBe(`Остаток по КП № ${quote.number} от 20.10.2026`)

    for (const input of [invoiceOf('remaining'), percent(100), amount(100), invoiceOf('full')]) {
      const error = await expectError(services.documents.convert(quote.id, input), 'exceeds_quote_total')
      expect(plainSpaces(error.message)).toBe('Сумма счетов не может быть больше суммы КП. Можно выставить ещё: 0 ₸')
      expect(error.status).toBe(409)
    }
  })

  it('an amount of 100 000 ₸ has VAT 13 793,10 and net 86 206,90', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const invoice = await services.documents.convert(quote.id, amount(100000 * TENGE))

    expect(figures(invoice)).toEqual({ net: 8620690, vat: 1379310, gross: 10000000 })
    expect(invoice).toMatchObject({ basis: 'amount', basisValue: 10000000 })
    expect(invoice.lines[0]!.title).toBe(`Предоплата по КП № ${quote.number} от 20.10.2026`)
  })

  it('30 % is 97 179 ₸ with VAT 13 404 ₸', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const invoice = await services.documents.convert(quote.id, percent(3000))

    expect(invoice.grossTiyn).toBe(97179 * TENGE)
    expect(invoice.vatTiyn).toBe(13404 * TENGE)
    expect(invoice.netTiyn).toBe(97179 * TENGE - 13404 * TENGE)
  })

  it('writes a fractional percent with a comma, and rounds the gross half up', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const invoice = await services.documents.convert(quote.id, percent(1250))

    expect(invoice.lines[0]!.title).toBe(`Предоплата 12,5% по КП № ${quote.number} от 20.10.2026`)
    expect(invoice.grossTiyn).toBe(4049125)
  })

  it('refuses more than is left, naming the amount still available', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)
    await services.documents.convert(quote.id, percent(5000))

    const tooMuchAmount = await expectError(services.documents.convert(quote.id, amount(200000 * TENGE)), 'exceeds_quote_total')
    const tooMuchPercent = await expectError(services.documents.convert(quote.id, percent(6000)), 'exceeds_quote_total')

    expect(plainSpaces(tooMuchAmount.message)).toContain('Можно выставить ещё: 161 965 ₸')
    expect(plainSpaces(tooMuchPercent.message)).toContain('Можно выставить ещё: 161 965 ₸')
    expect(tooMuchAmount.message).toContain('Сумма счетов не может быть больше суммы КП.')
  })

  it('uses the seeded invoices too: the remainder of a seeded quote is what the seed left', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = seed.documents.find((d) => d.type === 'quote' && d.number === 'КП-2026-0002')!
    const invoiced = seed.documents.filter((d) => d.sourceDocumentId === quote.id).reduce((sum, d) => sum + d.grossTiyn, 0)

    const rest = await services.documents.convert(quote.id, invoiceOf('remaining'))

    expect(rest.grossTiyn).toBe(quote.grossTiyn - invoiced)
    expect(rest.netTiyn + rest.vatTiyn).toBe(rest.grossTiyn)
  })

  it('has no VAT for a company that is not a VAT payer', async () => {
    const { services } = setup()
    await services.auth.login(NURLANOV)
    const quote = await signedQuote(services, nurlanovClient.id)
    expect(quote.vatTiyn).toBe(0)

    const invoice = await services.documents.convert(quote.id, percent(5000))

    expect(invoice).toMatchObject({ vatEnabled: false, vatTiyn: 0, netTiyn: 139625 * TENGE, grossTiyn: 139625 * TENGE })
    expect(invoice.lines[0]).toMatchObject({ vatTiyn: 0, netTiyn: 139625 * TENGE, grossTiyn: 139625 * TENGE })
  })
})

describe('checks before anything is written', () => {
  it.each([
    ['0 %', percent(0)],
    ['101 %', percent(10100)],
    ['a fraction of a basis point', percent(12.5)],
    ['amount 0', amount(0)],
    ['a negative amount', amount(-100)],
    ['a fractional amount', amount(100.5)],
  ])('%s is a validation_error on basisValue', async (_name, input) => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const error = await expectError(services.documents.convert(quote.id, input), 'validation_error')

    expect(error.fields).toHaveProperty('basisValue')
    expect(error.fields!.basisValue).not.toBe('')
    expect(error.status).toBe(422)
  })

  it('refuses an unknown basis on the field basis', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const error = await expectError(
      services.documents.convert(quote.id, { target: 'invoice', basis: 'half', clientRequestId: requestId() } as never),
      'validation_error',
    )

    expect(error.fields).toHaveProperty('basis')
  })

  it('takes no number for a refused conversion: СЧ numbers stay consecutive', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)
    const first = await services.documents.convert(quote.id, percent(5000))
    await expectError(services.documents.convert(quote.id, percent(6000)), 'exceeds_quote_total')
    await expectError(services.documents.convert(quote.id, percent(0)), 'validation_error')
    const second = await services.documents.convert(quote.id, invoiceOf('remaining'))

    const sequence = (doc: Document) => Number(doc.number!.slice(-4))
    expect(sequence(second)).toBe(sequence(first) + 1)
    expect(second.number!.slice(0, -4)).toBe(first.number!.slice(0, -4))
  })

  it('a draft quote and a sent (unsigned) quote are document_locked', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const draft = seededQuote('draft')
    const sent = seededQuote('sent')

    const lockedDraft = await expectError(services.documents.convert(draft.id, percent(5000)), 'document_locked')
    await expectError(services.documents.convert(sent.id, invoiceOf('full')), 'document_locked')

    expect(lockedDraft.status).toBe(409)
    expect((await services.documents.list({ type: 'invoice' })).total).toBe(seed.documents.filter((d) => d.type === 'invoice' && d.companyId === seitkaliCompany.id).length)
  })

  it('another company\'s signed quote is not_found', async () => {
    const { services } = setup()
    await services.auth.login(NURLANOV)
    const foreign = seededQuote('signed')

    await expectError(services.documents.convert(foreign.id, percent(5000)), 'not_found')
    await expectError(services.documents.convert('99999999-9999-4999-8999-999999999999', percent(5000)), 'not_found')
  })

  it('an invoice is not a quote to convert from', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const invoice = seed.documents.find((d) => d.type === 'invoice' && d.companyId === seitkaliCompany.id)!

    await expectError(services.documents.convert(invoice.id, percent(5000)), 'document_locked')
  })
})

describe('idempotency', () => {
  it('the same clientRequestId returns the same invoice, with one number used', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)
    const input = percent(5000)

    const first = await services.documents.convert(quote.id, input)
    const replay = await services.documents.convert(quote.id, input)
    const next = await services.documents.convert(quote.id, invoiceOf('remaining'))

    expect(replay.id).toBe(first.id)
    expect(replay.number).toBe(first.number)
    expect(Number(next.number!.slice(-4))).toBe(Number(first.number!.slice(-4)) + 1)
    const children = (await services.documents.get(quote.id)).children.filter((c) => c.type === 'invoice')
    expect(children).toHaveLength(2)
  })

  it('a different clientRequestId makes a second invoice', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const a = await services.documents.convert(quote.id, percent(1000))
    const b = await services.documents.convert(quote.id, percent(1000))

    expect(b.id).not.toBe(a.id)
    expect(b.number).not.toBe(a.number)
  })
})

describe('what the invoice looks like afterwards', () => {
  it('the quote lists it among its children, and the invoice list shows it unpaid', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const invoice = await services.documents.convert(quote.id, percent(5000))

    const reread = await services.documents.get(quote.id)
    expect(reread.children).toEqual([expect.objectContaining({ id: invoice.id, type: 'invoice', number: invoice.number, grossTiyn: 161965 * TENGE })])
    const listed = await services.documents.list({ type: 'invoice' })
    expect(listed.items.find((d) => d.id === invoice.id)).toMatchObject({
      status: 'issued',
      clientName: kairat.name,
      payment: { state: 'unpaid', paidTiyn: 0, balanceTiyn: 161965 * TENGE },
    })
    expect(await services.documents.get(invoice.id)).toMatchObject({ id: invoice.id, lines: invoice.lines, sourceDocumentId: quote.id })
  })

  it('the quote itself stays signed and unchanged', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    await services.documents.convert(quote.id, percent(5000))

    const after = await services.documents.get(quote.id)
    expect({ ...after, children: [] }).toEqual({ ...quote, children: [] })
  })

  it('issue: false leaves a draft with no number, and no number is used up', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    const draft = await services.documents.convert(quote.id, percent(5000, { issue: false }))
    const issued = await services.documents.convert(quote.id, percent(1000))

    expect(draft).toMatchObject({ status: 'draft', number: null, issuedAt: null, shareUrl: null, basis: 'percent', grossTiyn: 161965 * TENGE })
    expect(issued.number).toMatch(/^СЧ-2026-\d{4}$/)
    const count = (await services.documents.list({ type: 'invoice' })).items.filter((d) => d.number !== null).length
    expect(issued.number!.endsWith(String(count).padStart(4, '0'))).toBe(true)
    // A draft counts against the quote total as well as an issued invoice.
    const error = await expectError(services.documents.convert(quote.id, percent(5000)), 'exceeds_quote_total')
    expect(plainSpaces(error.message)).toContain('Можно выставить ещё: 129 572 ₸')
  })

  it('without the issue flag it is a draft too', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)
    const { issue: _issue, ...input } = percent(5000)

    const invoice = await services.documents.convert(quote.id, input as ConvertInput)

    expect(invoice).toMatchObject({ status: 'draft', number: null })
  })

  it('a cancelled invoice frees its share of the quote', async () => {
    const { services, store } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)
    const invoice = await services.documents.convert(quote.id, invoiceOf('full'))
    store.writeAll((data) => {
      data.documents.find((d) => d.id === invoice.id)!.status = 'cancelled'
    })

    const again = await services.documents.convert(quote.id, invoiceOf('full'))

    expect(again.grossTiyn).toBe(323930 * TENGE)
  })
})

describe('the act is not built yet', () => {
  it('target act still rejects with NotImplementedError', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const quote = await signedQuote(services)

    await expect(services.documents.convert(quote.id, { target: 'act', clientRequestId: requestId() })).rejects.toBeInstanceOf(
      NotImplementedError,
    )
  })
})
