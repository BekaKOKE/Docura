import { describe, expect, it } from 'vitest'
import { blankLine, draftFromDocument, draftTotals, toDocumentInput, type DraftLine, type QuoteDraft } from '../../screens/quoteEditor/draft'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

// What the quote editor (#19) sends, the mock service accepts, and the figures it saves are the figures the editor
// showed. The editor builds the input with toDocumentInput and shows draftTotals; the service computes its own.

const instant = async () => {}
/** 20.10.2026 11:00 in Asia/Almaty. */
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

async function signedIn() {
  const store = createStore({ storage: null })
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(START) })
  const services = createMockServices(() => runtime)
  await services.auth.login({ email: 'seitkali@example.kz', password: DEV_PASSWORD })
  return services
}

const kairat = seed.clients.find((c) => c.name === 'Қайрат Әбілқасымов')!

const line = (patch: Partial<DraftLine>): DraftLine => ({ ...blankLine(), ...patch })

const referenceDraft = (patch: Partial<QuoteDraft> = {}): QuoteDraft => ({
  clientId: kairat.id,
  lines: [
    line({ title: 'Укладка ламината', unit: 'м²', qty: '12,5', price: '18 500' }),
    line({ title: 'Плинтус, монтаж', unit: 'п.м.', qty: '32', price: '1500' }),
  ],
  vatEnabled: true,
  validity: 14,
  validUntil: '',
  notes: 'Работы начнём в понедельник. Оплата — Kaspi.',
  ...patch,
})

describe('the editor and the mock service agree', () => {
  it('saves the reference quote at 279 250 / 44 680 / 323 930 ₸, as the editor showed', async () => {
    const services = await signedIn()
    const draft = referenceDraft()
    const shown = draftTotals(draft.lines, draft.vatEnabled)

    const saved = await services.documents.create(toDocumentInput(draft, '2026-10-20'))

    expect([saved.netTiyn, saved.vatTiyn, saved.grossTiyn]).toEqual([27_925_000, 4_468_000, 32_393_000])
    expect([saved.netTiyn, saved.vatTiyn, saved.grossTiyn]).toEqual([shown.netTiyn, shown.vatTiyn, shown.grossTiyn])
    expect(saved.lines.map((l) => [l.grossTiyn, l.vatTiyn])).toEqual(shown.lines.map((l) => [l!.grossTiyn, l!.vatTiyn]))
    expect(saved.status).toBe('draft')
    expect(saved.validUntil).toBe('2026-11-03')
    expect(saved.notes).toBe('Работы начнём в понедельник. Оплата — Kaspi.')
  })

  it('saves it at 279 250 ₸ with the VAT switch off', async () => {
    const services = await signedIn()
    const draft = referenceDraft({ vatEnabled: false })
    const saved = await services.documents.create(toDocumentInput(draft, '2026-10-20'))
    expect([saved.vatEnabled, saved.vatTiyn, saved.grossTiyn]).toEqual([false, 0, 27_925_000])
  })

  it.each([
    ['1,5 ч × 1 001,01 ₸', { unit: 'ч', qty: '1,5', price: '1001,01' }, 174_176],
    ['1000 шт × 9 999 999 ₸', { unit: 'шт', qty: '1000', price: '9 999 999' }, 1_159_999_884_000],
  ])('rounds %s the same on both sides', async (_name, fields, gross) => {
    const services = await signedIn()
    const draft = referenceDraft({ lines: [line({ title: 'Работа', ...fields })] })
    const saved = await services.documents.create(toDocumentInput(draft, '2026-10-20'))
    expect(saved.grossTiyn).toBe(gross)
    expect(saved.grossTiyn).toBe(draftTotals(draft.lines, true).grossTiyn)
  })

  it('opens a saved quote unchanged and saves it again (TC-9)', async () => {
    const services = await signedIn()
    const first = await services.documents.create(toDocumentInput(referenceDraft(), '2026-10-20'))

    const reopened = draftFromDocument(await services.documents.get(first.id))
    expect(reopened.lines.map((l) => [l.title, l.qty, l.unit])).toEqual([
      ['Укладка ламината', '12,5', 'м²'],
      ['Плинтус, монтаж', '32', 'п.м.'],
    ])
    expect(reopened).toMatchObject({ vatEnabled: true, validity: 14, clientId: kairat.id })

    const second = await services.documents.update(first.id, {
      ...toDocumentInput(reopened, first.issueDate),
      version: first.version,
    })
    expect(second.version).toBe(first.version + 1)
    expect(second.grossTiyn).toBe(first.grossTiyn)
    expect(second.lines.map((l) => l.title)).toEqual(['Укладка ламината', 'Плинтус, монтаж'])
  })

  it('keeps the order the person arranged', async () => {
    const services = await signedIn()
    const draft = referenceDraft()
    const swapped = { ...draft, lines: [draft.lines[1]!, draft.lines[0]!] }
    const saved = await services.documents.create(toDocumentInput(swapped, '2026-10-20'))
    expect(saved.lines.map((l) => [l.position, l.title])).toEqual([
      [0, 'Плинтус, монтаж'],
      [1, 'Укладка ламината'],
    ])
  })

  it('takes a catalogue line with its article id, and a draft with a date chosen by hand', async () => {
    const services = await signedIn()
    const article = (await services.articles.list({ q: 'ламинат' })).items[0]!
    const draft = referenceDraft({
      lines: [line({ articleId: article.id, title: article.title, unit: article.unit, qty: '1', price: '18 500' })],
      validity: 'date',
      validUntil: '2026-11-02',
    })
    const saved = await services.documents.create(toDocumentInput(draft, '2026-10-20'))
    expect(saved.lines[0]!.articleId).toBe(article.id)
    expect(saved.validUntil).toBe('2026-11-02')
  })
})
