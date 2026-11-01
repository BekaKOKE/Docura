import { describe, expect, it } from 'vitest'
import { isApiError } from '../errors'
import type { CompanyInput, Dashboard, Document, DocumentInput, Id } from '../types'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

// dashboard.get (#32): the numbers of the Главная screen, worked out from the store. The seed's figures are computed here
// from contracts/fixtures/seed.json, not typed in from the screen, and the TC-1 account of the issue is rebuilt by hand.

const instant = async () => {}

const SEITKALI = { email: 'seitkali@example.kz', password: DEV_PASSWORD }
const NURLANOV = { email: 'nurlanov@example.kz', password: DEV_PASSWORD }

/** 20.10.2026 11:00 in Asia/Almaty. */
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

function setup(now: number = START) {
  const store = createStore({ storage: null })
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(now) })
  return { store, services: createMockServices(() => runtime) }
}
type Setup = ReturnType<typeof setup>

const company = seed.companies[0]!
const otherCompany = seed.companies[1]!
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

// ---------------------------------------------------------------- what the seed says, for one company and one month

/** The figures of a month worked out straight from the seed rows: the check the mock must agree with. */
function expectedFromSeed(companyId: Id, from: string, to: string, today: string) {
  const docs = seed.documents.filter((d) => d.companyId === companyId)
  const payments = seed.payments.filter((p) => p.companyId === companyId)
  const inMonth = (day: string) => day >= from && day <= to
  const issuedInvoices = docs.filter((d) => d.type === 'invoice' && d.status === 'issued')
  const balance = (id: string, gross: number) => gross - sum(payments.filter((p) => p.documentId === id).map((p) => p.amountTiyn))
  const owed = issuedInvoices.map((d) => ({ d, balance: balance(d.id, d.grossTiyn) })).filter((x) => x.balance > 0)
  const quotes = docs.filter((d) => d.type === 'quote')
  const signed = quotes.filter((d) => d.status === 'signed' && inMonth(d.signedAt!.slice(0, 10)))
  return {
    cashed: sum(payments.filter((p) => inMonth(p.paidOn)).map((p) => p.amountTiyn)),
    invoiced: sum(issuedInvoices.filter((d) => inMonth(d.issueDate)).map((d) => d.grossTiyn)),
    waiting: sum(owed.map((x) => x.balance)),
    overdue: sum(owed.filter((x) => x.d.dueDate! < today).map((x) => x.balance)),
    signed: signed.length,
    awaiting: quotes.filter((d) => d.status === 'sent' && inMonth(d.issueDate)).length,
    toInvoice: quotes
      .filter((q) => q.status === 'signed')
      .filter((q) => sum(docs.filter((d) => d.sourceDocumentId === q.id && d.status !== 'cancelled').map((d) => d.grossTiyn)) < q.grossTiyn)
      .map((q) => q.number),
  }
}

describe('dashboard.get on the seed (AC 2)', () => {
  it("equals the sums worked out from the seed file for October 2026 on 20.10.2026", async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const dashboard = await services.dashboard.get()
    const expected = expectedFromSeed(company.id, '2026-10-01', '2026-10-31', '2026-10-20')

    expect(dashboard.from).toBe('2026-10-01')
    expect(dashboard.to).toBe('2026-10-31')
    expect(dashboard.cashedTiyn).toBe(expected.cashed)
    expect(dashboard.invoicedTiyn).toBe(expected.invoiced)
    expect(dashboard.outstanding.balanceTiyn).toBe(expected.waiting)
    expect(dashboard.outstanding.overdue.balanceTiyn).toBe(expected.overdue)
    expect(dashboard.signed.count).toBe(expected.signed)
    expect(dashboard.awaitingSignature.count).toBe(expected.awaiting)
    expect(dashboard.toInvoice.map((q) => q.number)).toEqual(expected.toInvoice.reverse())
  })

  it('gives the figures written out in the issue notes: 313 664 ₸ in, 721 752 ₸ owed (226 200 ₸ late), 809 216 ₸ invoiced, 3 of 4', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const dashboard = await services.dashboard.get()

    expect(dashboard.cashedTiyn).toBe(31_366_400) // СЧ-2026-0001 45 240 ₸ + СЧ-2026-0002 268 424 ₸
    expect(dashboard.outstanding.balanceTiyn).toBe(72_175_200) // СЧ-0002 402 636 + СЧ-0003 92 916 + СЧ-0004 226 200
    expect(dashboard.outstanding.count).toBe(3)
    expect(dashboard.outstanding.overdue).toEqual({ count: 1, balanceTiyn: 22_620_000 }) // СЧ-0004, due 13.10
    expect(dashboard.invoicedTiyn).toBe(80_921_600) // СЧ-0001 + СЧ-0002 + СЧ-0003; СЧ-0004 is from September
    expect(dashboard.signed.count).toBe(3) // КП-0002, 0004, 0005; КП-0006 was signed on 29.09
    expect(dashboard.awaitingSignature.count).toBe(1) // КП-0001; КП-0003 was sent in September
    expect(dashboard.acceptanceRate).toBe(1) // nothing declined
    expect(dashboard.recentEvents).toEqual([])
  })

  it('lists the signed quotes that still have money to invoice, newest first: КП-0005 and КП-0002', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const { toInvoice } = await services.dashboard.get()

    // КП-0004 and КП-0006 are invoiced in full; КП-0002 and КП-0005 have a prepayment invoice only.
    expect(toInvoice.map((q) => q.number)).toEqual(['КП-2026-0005', 'КП-2026-0002'])
    expect(toInvoice.every((q) => q.type === 'quote' && q.status === 'signed' && q.payment === null)).toBe(true)
    expect(toInvoice.map((q) => q.grossTiyn)).toEqual([30_972_000, 134_212_000])
  })

  it('keeps money as integer tiyn', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const d = await services.dashboard.get()
    for (const value of [d.cashedTiyn, d.invoicedTiyn, d.outstanding.balanceTiyn, d.outstanding.overdue.balanceTiyn, d.signed.grossTiyn, d.awaitingSignature.grossTiyn]) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })
})

describe('the period', () => {
  it('can be given: September holds the late invoice, the quote signed on 29.09 and no payment', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const september = await services.dashboard.get({ from: '2026-09-01', to: '2026-09-30' })
    const expected = expectedFromSeed(company.id, '2026-09-01', '2026-09-30', '2026-10-20')

    expect(september.from).toBe('2026-09-01')
    expect(september.cashedTiyn).toBe(expected.cashed)
    expect(september.cashedTiyn).toBe(0)
    expect(september.invoicedTiyn).toBe(22_620_000)
    expect(september.signed.count).toBe(1)
    expect(september.awaitingSignature.count).toBe(1) // КП-0003
    // What is owed does not depend on the period.
    expect(september.outstanding.balanceTiyn).toBe(72_175_200)
    expect(september.toInvoice).toHaveLength(2)
  })

  it('takes the edges of the month of the end that is missing', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    const fromOnly = await services.dashboard.get({ from: '2026-02-10' })
    expect([fromOnly.from, fromOnly.to]).toEqual(['2026-02-10', '2026-02-28'])
    const toOnly = await services.dashboard.get({ to: '2024-02-12' })
    expect([toOnly.from, toOnly.to]).toEqual(['2024-02-01', '2024-02-12'])
  })

  it('defaults to the current month in the company zone: 31.10 at 19:30 UTC is already 1 November in Almaty (TC-5)', async () => {
    const { store, services } = setup(Date.UTC(2026, 9, 31, 19, 30, 0))
    await services.auth.login(SEITKALI)
    const invoice = seed.documents.find((d) => d.companyId === company.id && d.number === 'СЧ-2026-0003')!
    store.write((db) =>
      db.insert('payments', { id: 'p-late-october', documentId: invoice.id, amountTiyn: 500_000, currency: 'KZT', method: 'cash', paidOn: '2026-10-31', note: null }),
    )

    const november = await services.dashboard.get()
    expect([november.from, november.to]).toEqual(['2026-11-01', '2026-11-30'])
    expect(november.cashedTiyn).toBe(0)

    const october = await services.dashboard.get({ from: '2026-10-01', to: '2026-10-31' })
    expect(october.cashedTiyn).toBe(31_366_400 + 500_000)
  })

  it('counts a quote signed late in the evening UTC on the next day in Almaty', async () => {
    const { store, services } = setup()
    await services.auth.login(SEITKALI)
    // КП-0006 was signed 2026-09-29T10:00Z; moved to 2026-09-30T20:00Z it is 01.10 01:00 in Almaty (UTC+5).
    const quote = seed.documents.find((d) => d.companyId === company.id && d.number === 'КП-2026-0006')!
    store.write((db) => db.patch('documents', quote.id, { signedAt: '2026-09-30T20:00:00Z' }))

    const october = await services.dashboard.get()
    const september = await services.dashboard.get({ from: '2026-09-01', to: '2026-09-30' })
    expect(october.signed.count).toBe(4)
    expect(september.signed.count).toBe(0)
  })

  it('refuses a date that is not a day and an end before the start', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    for (const params of [{ from: '2026-02-30' }, { to: 'октябрь' }, { from: '2026-10-31', to: '2026-10-01' }]) {
      const error = await services.dashboard.get(params).then(() => undefined, (e: unknown) => e)
      expect(isApiError(error) && error.code, JSON.stringify(params)).toBe('validation_error')
    }
  })
})

describe('the company scope', () => {
  it("shows another company's own numbers and none of the first company's", async () => {
    const { services } = setup()
    await services.auth.login(NURLANOV)
    const dashboard = await services.dashboard.get()
    const expected = expectedFromSeed(otherCompany.id, '2026-10-01', '2026-10-31', '2026-10-20')

    expect(expected.cashed).toBe(0)
    expect(dashboard.cashedTiyn).toBe(0)
    expect(dashboard.invoicedTiyn).toBe(0)
    expect(dashboard.outstanding).toEqual({ count: 0, balanceTiyn: 0, overdue: { count: 0, balanceTiyn: 0 } })
    expect(dashboard.signed).toEqual({ count: 0, grossTiyn: 0 })
    expect(dashboard.awaitingSignature).toEqual({ count: 1, grossTiyn: 25_000_000 })
    expect(dashboard.acceptanceRate).toBeNull()
    expect(dashboard.toInvoice).toEqual([])
  })

  it('does not count a payment of another company on its own invoice', async () => {
    const { store, services } = setup()
    await services.auth.login(NURLANOV)
    const foreign = seed.documents.find((d) => d.companyId === company.id && d.number === 'СЧ-2026-0003')!
    // A row that points at the first company's invoice but sits under the other company: it must not count as a debt or a receipt of either.
    store.writeAll((data) => {
      data.payments.push({ id: 'p-foreign', companyId: company.id, documentId: foreign.id, amountTiyn: 100, currency: 'KZT', method: 'cash', paidOn: '2026-10-20', note: null })
    })
    expect((await services.dashboard.get()).cashedTiyn).toBe(0)
  })

  it('is unauthorized when nobody is signed in', async () => {
    const { services } = setup()
    const error = await services.dashboard.get().then(() => undefined, (e: unknown) => e)
    expect(isApiError(error) && error.code).toBe('unauthorized')
  })
})

// ---------------------------------------------------------------- an account of its own

const COMPANY: CompanyInput = {
  legalForm: 'ip',
  legalName: 'ИП Сейткали Б.',
  binIin: '850312300121',
  address: 'г. Алматы, ул. Сәтбаев, 22',
  phone: '+7 701 123 45 67',
  directorName: 'Сейткали Бекзат',
  directorPosition: 'Индивидуальный предприниматель',
  vatPayer: true,
  bankName: 'АО Тест Банк',
  iik: 'KZ75998KZT1001300335',
  bik: 'DCRAKZKA',
  kbe: '17',
  defaultKnp: '859',
  quoteValidityDays: 14,
}

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

// 12.5 м² x 18 500 ₸ and 32 п.м. x 1 500 ₸: net 279 250 ₸, VAT 44 680 ₸, gross 323 930 ₸.
const reference = (clientId: Id, title = 'Укладка ламината'): DocumentInput => ({
  type: 'quote',
  clientId,
  vatEnabled: true,
  lines: [
    { kind: 'service', title, unit: 'м²', qtyMilli: 12500, unitPriceTiyn: 1850000 },
    { kind: 'material', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32000, unitPriceTiyn: 150000 },
  ],
})

async function newAccount(): Promise<Setup & { clientId: Id }> {
  const made = setup()
  await made.services.auth.register({ email: 'aliya@example.kz', password: 'Тест-Пароль-2026', fullName: 'Әлия Сейткали' })
  await made.services.company.create(COMPANY)
  const client = await made.services.clients.create({ kind: 'person', name: 'Қайрат Әбілқасымов' })
  return { ...made, clientId: client.id }
}

async function signedQuote(services: Setup['services'], clientId: Id): Promise<Document> {
  const sent = await services.documents.issue((await services.documents.create(reference(clientId))).id)
  await services.public.sign(sent.shareUrl!.split('/p/')[1]!, {
    signerName: 'Қайрат Әбілқасымов',
    signaturePng: PNG_1X1,
    consentAccepted: true,
    personalDataConsent: true,
    version: sent.version,
  })
  return services.documents.get(sent.id)
}

describe('an account with nothing (AC 4)', () => {
  it('is all zeros for the current month, with nothing to invoice', async () => {
    const { services } = await newAccount()
    const dashboard = await services.dashboard.get()
    expect(dashboard).toEqual<Dashboard>({
      from: '2026-10-01',
      to: '2026-10-31',
      awaitingSignature: { count: 0, grossTiyn: 0 },
      signed: { count: 0, grossTiyn: 0 },
      acceptanceRate: null,
      invoicedTiyn: 0,
      cashedTiyn: 0,
      outstanding: { count: 0, balanceTiyn: 0, overdue: { count: 0, balanceTiyn: 0 } },
      toInvoice: [],
      recentEvents: [],
    })
  })
})

describe('the account of TC-1 (AC 1, 3)', () => {
  it('shows 64 786 ₸ in, 97 179 ₸ owed with 0 ₸ late, 161 965 ₸ invoiced, 1 of 2 quotes signed, and quote A to invoice', async () => {
    const { store, services, clientId } = await newAccount()
    const quoteA = await signedQuote(services, clientId)
    // Quote B: a sent one, not signed.
    const draftB = await services.documents.create({
      type: 'quote',
      clientId,
      vatEnabled: true,
      lines: [{ kind: 'service', title: 'Замена смесителя', unit: 'шт', qtyMilli: 1000, unitPriceTiyn: 1200000 }],
    })
    const quoteB = await services.documents.issue(draftB.id)
    expect(quoteB.grossTiyn).toBe(1_392_000)

    // Before any invoice the signed quote A is the thing to do next.
    expect((await services.dashboard.get()).toInvoice.map((q) => q.id)).toEqual([quoteA.id])

    // A prepayment of 50 %, then a payment of 64 786 ₸ today.
    const invoice = await services.documents.convert(quoteA.id, { target: 'invoice', basis: 'percent', basisValue: 5000, issue: true, clientRequestId: '00000000-0000-4000-8000-000000000001' })
    expect(invoice.grossTiyn).toBe(16_196_500)
    store.write((db) =>
      db.insert('payments', { id: 'p-1', documentId: invoice.id, amountTiyn: 6_478_600, currency: 'KZT', method: 'cash', paidOn: '2026-10-20', note: null }),
    )

    const dashboard = await services.dashboard.get()
    expect(dashboard.cashedTiyn).toBe(6_478_600)
    expect(dashboard.outstanding).toEqual({ count: 1, balanceTiyn: 9_717_900, overdue: { count: 0, balanceTiyn: 0 } })
    expect(dashboard.invoicedTiyn).toBe(16_196_500)
    expect([dashboard.signed.count, dashboard.awaitingSignature.count]).toEqual([1, 1])
    expect(dashboard.signed.grossTiyn).toBe(32_393_000)
    // A is still listed: 161 965 ₸ of it is not invoiced yet.
    expect(dashboard.toInvoice.map((q) => q.id)).toEqual([quoteA.id])
  })

  it('stops listing a quote once an invoice covers all of it, and lists only 5 of 7', async () => {
    const { services, clientId } = await newAccount()
    const quotes: Document[] = []
    for (let i = 0; i < 7; i++) quotes.push(await signedQuote(services, clientId))

    const seven = await services.dashboard.get()
    expect(seven.signed.count).toBe(7)
    expect(seven.toInvoice).toHaveLength(5)
    // Newest first: the last quotes made come first.
    expect(seven.toInvoice.map((q) => q.id)).toEqual(quotes.slice(2).reverse().map((q) => q.id))

    await services.documents.convert(quotes[6]!.id, { target: 'invoice', basis: 'full', issue: false, clientRequestId: '00000000-0000-4000-8000-000000000002' })
    const six = await services.dashboard.get()
    expect(six.toInvoice.map((q) => q.id)).toEqual(quotes.slice(1, 6).reverse().map((q) => q.id))
  })
})
