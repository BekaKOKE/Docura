import { describe, expect, it } from 'vitest'
import { isApiError } from '../errors'
import type { Document, DocumentInput, DocumentUpdateInput, Id } from '../types'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

// The completion act (АВР, #31): documents.convert({target: 'act'}) makes the draft, documents.update edits its work
// dates, period and contract reference, documents.issue gives it the number АВР-YYYY-NNNN.

const instant = async () => {}

const SEITKALI = { email: 'seitkali@example.kz', password: DEV_PASSWORD }
const NURLANOV = { email: 'nurlanov@example.kz', password: DEV_PASSWORD }

/** 20.10.2026 11:00 in Asia/Almaty. */
const START = Date.UTC(2026, 9, 20, 6, 0, 0)
const TODAY = '2026-10-20'

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function setup() {
  const store = createStore({ storage: null })
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(START) })
  return { store, services: createMockServices(() => runtime) }
}
type Services = ReturnType<typeof setup>['services']

const seitkaliCompany = seed.companies[0]!
const nurlanovCompany = seed.companies[1]!
const kairat = seed.clients.find((c) => c.companyId === seitkaliCompany.id)!
const nurlanovClient = seed.clients.find((c) => c.companyId === nurlanovCompany.id)!

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
const actOf = (extra: { issue?: boolean; clientRequestId?: Id } = {}) =>
  ({ target: 'act', clientRequestId: requestId(), ...extra }) as const

/** A sent quote, not yet signed. */
async function sentQuote(services: Services, clientId: Id = kairat.id): Promise<Document> {
  const draft = await services.documents.create({ ...REFERENCE, clientId })
  return services.documents.issue(draft.id)
}

/** A new quote of the signed-in company, issued and signed by the client with the finger. */
async function signedQuote(services: Services, clientId: Id = kairat.id): Promise<Document> {
  const sent = await sentQuote(services, clientId)
  await services.public.sign(sent.shareUrl!.split('/p/')[1]!, {
    signerName: 'Асет Нұрланов',
    signaturePng: PNG_1X1,
    consentAccepted: true,
    personalDataConsent: true,
    version: sent.version,
  })
  return services.documents.get(sent.id)
}

const errorOf = (promise: Promise<unknown>) => promise.then(() => undefined, (e: unknown) => e)
async function expectError(promise: Promise<unknown>, code: string) {
  const error = await errorOf(promise)
  expect(isApiError(error) && error.code, `expected ${code}`).toBe(code)
  return error as Exclude<typeof error, undefined> & { fields?: Record<string, string>; message: string; status: number }
}

/** The save request of an act as the card sends it: its own lines with the dates given. */
function saveOf(act: Document, patch: Partial<DocumentUpdateInput> & { workDates?: (string | null)[] } = {}): DocumentUpdateInput {
  const { workDates, ...rest } = patch
  return {
    type: 'act',
    clientId: act.clientId,
    vatEnabled: act.vatEnabled,
    periodFrom: act.periodFrom,
    periodTo: act.periodTo,
    contractRef: act.contractRef,
    version: act.version,
    lines: act.lines.map((line, index) => ({
      kind: line.kind,
      title: line.title,
      unit: line.unit,
      qtyMilli: line.qtyMilli,
      unitPriceTiyn: line.unitPriceTiyn,
      workDate: workDates ? workDates[index] : line.workDate,
    })),
    ...rest,
  }
}

async function ready() {
  const env = setup()
  await env.services.auth.login(SEITKALI)
  const quote = await signedQuote(env.services)
  return { ...env, quote }
}

describe('convert to an act (AC 1, TC-1)', () => {
  it('makes a draft with the lines of the quote, a work date per line, the period and the contract reference', async () => {
    const { services, quote } = await ready()

    const act = await services.documents.convert(quote.id, actOf())

    expect(act).toMatchObject({
      type: 'act',
      status: 'draft',
      number: null,
      sourceDocumentId: quote.id,
      clientId: quote.clientId,
      issueDate: TODAY,
      periodFrom: TODAY,
      periodTo: TODAY,
      contractRef: `КП № ${quote.number} от 20.10.2026`,
      version: 1,
      shareUrl: null,
      vatEnabled: true,
      vatRateBp: 1600,
      netTiyn: 27925000,
      vatTiyn: 4468000,
      grossTiyn: 32393000,
    })
    expect(act.lines.map(({ kind, title, unit, qtyMilli, unitPriceTiyn, workDate, position }) => ({ kind, title, unit, qtyMilli, unitPriceTiyn, workDate, position }))).toEqual([
      { kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12500, unitPriceTiyn: 1850000, workDate: TODAY, position: 0 },
      { kind: 'material', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32000, unitPriceTiyn: 150000, workDate: TODAY, position: 1 },
    ])
    // The lines are the act's own copies.
    expect(act.lines.map((l) => l.id)).not.toEqual(quote.lines.map((l) => l.id))
    expect(act.lines.map((l) => l.grossTiyn)).toEqual(quote.lines.map((l) => l.grossTiyn))
  })

  it('shows the act under the quote and in the list of acts', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())

    const reread = await services.documents.get(quote.id)
    expect(reread.children.map((c) => [c.id, c.type, c.status])).toEqual([[act.id, 'act', 'draft']])

    const list = await services.documents.list({ type: 'act' })
    expect(list.items.map((d) => d.id)).toContain(act.id)
    // The seed's own act (АВР-2026-0001) is there too, newest first.
    expect(list.items.map((d) => d.number)).toContain('АВР-2026-0001')
    expect(list.items[0]!.id).toBe(act.id)
    expect(list.items.every((d) => d.type === 'act')).toBe(true)
  })

  it('is idempotent: the same clientRequestId returns the act it made', async () => {
    const { services, quote } = await ready()
    const input = actOf()

    const first = await services.documents.convert(quote.id, input)
    const again = await services.documents.convert(quote.id, input)

    expect(again.id).toBe(first.id)
    expect((await services.documents.list({ type: 'act' })).items.filter((d) => d.sourceDocumentId === quote.id)).toHaveLength(1)
  })

  it('refuses a second active act for the quote (409 document_locked) and takes no number', async () => {
    const { services, quote } = await ready()
    const first = await services.documents.convert(quote.id, actOf({ issue: true }))

    const error = await expectError(services.documents.convert(quote.id, actOf()), 'document_locked')
    expect(error.status).toBe(409)
    expect(error.message).toBe('По этому КП уже есть акт. Откройте его.')

    // The refusal left no gap: the next act of another quote gets the next number.
    const other = await signedQuote(services)
    const next = await services.documents.convert(other.id, actOf({ issue: true }))
    expect(Number(next.number!.slice(-4))).toBe(Number(first.number!.slice(-4)) + 1)
  })

  it('allows a new act once the earlier one is cancelled', async () => {
    const { services, store, quote } = await ready()
    const first = await services.documents.convert(quote.id, actOf())
    store.writeAll((data) => {
      data.documents.find((d) => d.id === first.id)!.status = 'cancelled'
    })

    const second = await services.documents.convert(quote.id, actOf())

    expect(second.id).not.toBe(first.id)
    expect(second.status).toBe('draft')
  })

  it('needs a signed quote: a draft, a sent or an invoice is document_locked, a stranger is 404', async () => {
    const { services, quote } = await ready()
    const sent = await sentQuote(services)
    const draft = await services.documents.create(REFERENCE)
    const invoice = await services.documents.convert(quote.id, { target: 'invoice', basis: 'full', clientRequestId: requestId(), issue: true })

    for (const id of [sent.id, draft.id, invoice.id]) {
      const error = await expectError(services.documents.convert(id, actOf()), 'document_locked')
      expect(error.status).toBe(409)
    }
    const stranger = seed.documents.find((d) => d.companyId === nurlanovCompany.id && d.type === 'quote')!
    const notFound = await expectError(services.documents.convert(stranger.id, actOf()), 'not_found')
    expect(notFound.status).toBe(404)
  })

  it('works for a non-VAT company: the act says no VAT and carries the quote totals', async () => {
    const { services } = setup()
    await services.auth.login(NURLANOV)
    const quote = await signedQuote(services, nurlanovClient.id)
    expect(quote.vatEnabled).toBe(false)

    const act = await services.documents.convert(quote.id, actOf())

    expect(act).toMatchObject({ vatEnabled: false, vatTiyn: 0, grossTiyn: 27925000, netTiyn: 27925000 })
    expect(act.companySnapshot.vatPayer).toBe(false)
  })

  it('does not show one company the acts of another', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())
    await services.auth.logout()
    await services.auth.login(NURLANOV)

    await expectError(services.documents.get(act.id), 'not_found')
    expect((await services.documents.list({ type: 'act' })).items.map((d) => d.id)).not.toContain(act.id)
  })
})

describe('editing an act draft (AC 2)', () => {
  it('saves the work dates, the period and the contract reference, and bumps the version', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())

    const saved = await services.documents.update(
      act.id,
      saveOf(act, {
        workDates: ['2026-10-15', '2026-10-18'],
        periodFrom: '2026-10-15',
        periodTo: '2026-10-18',
        contractRef: '  Договор № 15 от 01.10.2026  ',
      }),
    )

    expect(saved).toMatchObject({
      version: act.version + 1,
      status: 'draft',
      number: null,
      periodFrom: '2026-10-15',
      periodTo: '2026-10-18',
      contractRef: 'Договор № 15 от 01.10.2026',
      grossTiyn: act.grossTiyn,
    })
    expect(saved.lines.map((l) => l.workDate)).toEqual(['2026-10-15', '2026-10-18'])
    // What was copied from the quote is untouched.
    expect(saved.lines.map((l) => [l.id, l.title, l.qtyMilli, l.unitPriceTiyn, l.grossTiyn])).toEqual(
      act.lines.map((l) => [l.id, l.title, l.qtyMilli, l.unitPriceTiyn, l.grossTiyn]),
    )
    expect((await services.documents.get(act.id)).contractRef).toBe('Договор № 15 от 01.10.2026')
  })

  it('refuses a stale version with version_conflict (409)', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())
    await services.documents.update(act.id, saveOf(act, { contractRef: 'Договор № 1' }))

    const error = await expectError(services.documents.update(act.id, saveOf(act)), 'version_conflict')
    expect(error.status).toBe(409)
  })

  it('names the field of a wrong date, a period that ends before it starts and a line count that changed (422)', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())

    const dates = await expectError(
      services.documents.update(act.id, saveOf(act, { periodFrom: '2026-02-30', workDates: ['2026-10-15', '15.10.2026'] })),
      'validation_error',
    )
    expect(Object.keys(dates.fields!).sort()).toEqual(['lines.1.workDate', 'periodFrom'])

    const order = await expectError(
      services.documents.update(act.id, saveOf(act, { periodFrom: '2026-10-18', periodTo: '2026-10-15' })),
      'validation_error',
    )
    expect(order.fields).toEqual({ periodTo: 'Конец периода не может быть раньше начала.' })

    const fewer = saveOf(act)
    fewer.lines = fewer.lines.slice(0, 1)
    expect(Object.keys((await expectError(services.documents.update(act.id, fewer), 'validation_error')).fields!)).toEqual(['lines'])

    const wrongType = await expectError(services.documents.update(act.id, saveOf(act, { type: 'quote' })), 'validation_error')
    expect(Object.keys(wrongType.fields!)).toEqual(['type'])

    // Nothing was saved.
    expect((await services.documents.get(act.id)).version).toBe(act.version)
  })
})

describe('issuing an act (AC 2, TC-2)', () => {
  it('gives it АВР-YYYY-NNNN, the link and the date of the day, and makes it read-only', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())
    const dated = await services.documents.update(
      act.id,
      saveOf(act, { workDates: ['2026-10-15', '2026-10-18'], periodFrom: '2026-10-15', periodTo: '2026-10-18' }),
    )

    const issued = await services.documents.issue(act.id)

    // The seed already holds АВР-2026-0001.
    expect(issued).toMatchObject({ status: 'issued', number: 'АВР-2026-0002', issueDate: TODAY, version: dated.version + 1 })
    expect(issued.issuedAt).toBe('2026-10-20T06:00:00Z')
    expect(issued.shareUrl).toMatch(/\/p\/[A-Za-z0-9_-]{43}$/)
    expect(issued.lines.map((l) => l.workDate)).toEqual(['2026-10-15', '2026-10-18'])

    await expectError(services.documents.update(act.id, saveOf(issued)), 'document_locked')
    await expectError(services.documents.issue(act.id), 'document_locked')
    await expectError(services.documents.remove(act.id), 'document_locked')
  })

  it('numbers in order with no gap, also after an issue that was refused', async () => {
    const { services, quote } = await ready()
    const other = await signedQuote(services)
    const first = await services.documents.convert(quote.id, actOf())
    const second = await services.documents.convert(other.id, actOf())
    // A missing work date refuses the issue.
    await services.documents.update(first.id, saveOf(first, { workDates: [null, null] }))
    await expectError(services.documents.issue(first.id), 'validation_error')

    const issuedSecond = await services.documents.issue(second.id)
    await services.documents.update(first.id, saveOf(await services.documents.get(first.id), { workDates: [TODAY, TODAY] }))
    const issuedFirst = await services.documents.issue(first.id)

    expect(issuedSecond.number).toBe('АВР-2026-0002')
    expect(issuedFirst.number).toBe('АВР-2026-0003')
  })

  it('refuses a missing work date or period with the field names, and stays a draft', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())
    await services.documents.update(act.id, saveOf(act, { workDates: [TODAY, null], periodFrom: null, periodTo: null }))

    const error = await expectError(services.documents.issue(act.id), 'validation_error')

    expect(error.status).toBe(422)
    expect(error.fields).toEqual({
      'lines.1.workDate': 'Укажите дату выполнения.',
      periodFrom: 'Укажите отчётный период.',
      periodTo: 'Укажите отчётный период.',
    })
    expect(await services.documents.get(act.id)).toMatchObject({ status: 'draft', number: null, shareUrl: null })
  })

  it('freezes the client as it is at issue: a later rename leaves the issued act alone', async () => {
    const { services, quote } = await ready()
    const act = await services.documents.convert(quote.id, actOf())
    await services.clients.update(kairat.id, { name: 'Қайрат Әбілқасымов (новое имя)' })

    const issued = await services.documents.issue(act.id)
    expect(issued.clientSnapshot.name).toBe('Қайрат Әбілқасымов (новое имя)')

    await services.clients.update(kairat.id, { name: 'Совсем другое имя' })
    const reread = await services.documents.get(act.id)
    expect(reread.clientSnapshot.name).toBe('Қайрат Әбілқасымов (новое имя)')
    expect((await services.documents.list({ type: 'act' })).items.find((d) => d.id === act.id)!.clientName).toBe('Қайрат Әбілқасымов (новое имя)')
  })

  it('with issue: true on convert, numbers the act at once and a replay takes no second number', async () => {
    const { services, quote } = await ready()
    const input = actOf({ issue: true })

    const act = await services.documents.convert(quote.id, input)
    const again = await services.documents.convert(quote.id, input)

    expect(act).toMatchObject({ status: 'issued', number: 'АВР-2026-0002' })
    expect(act.shareUrl).not.toBeNull()
    expect(again.id).toBe(act.id)
    const other = await signedQuote(services)
    expect((await services.documents.convert(other.id, actOf({ issue: true }))).number).toBe('АВР-2026-0003')
  })
})
