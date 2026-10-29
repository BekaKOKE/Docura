import { describe, expect, it } from 'vitest'
import type { Services } from '../contracts'
import type { DocumentInput, DocumentLineInput, Id } from '../types'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore, type MockStore } from './store'

const instant = async () => {}

const SEITKALI = { email: 'seitkali@example.kz', password: DEV_PASSWORD }
const NURLANOV = { email: 'nurlanov@example.kz', password: DEV_PASSWORD }

/** 20.10.2026 11:00 in Asia/Almaty. */
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

function setup(start = START) {
  const store = createStore({ storage: null })
  const clock = { time: start }
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(clock.time) })
  return { store, clock, services: createMockServices(() => runtime) }
}

const kairat = seed.clients.find((c) => c.name === 'Қайрат Әбілқасымов')!
const irina = seed.clients.find((c) => c.name === 'Ирина Ёлкина')!
const nurlanovClient = seed.clients.find((c) => c.companyId === seed.companies[1]!.id)!

// 12.5 м² × 18 500 ₸ and 32 п.м. × 1 500 ₸: the reference quote of docs/spec.md (323 930 ₸ with VAT).
const REFERENCE_LINES: DocumentLineInput[] = [
  { kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12500, unitPriceTiyn: 1850000 },
  { kind: 'service', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32000, unitPriceTiyn: 150000 },
]

const quote = (clientId: Id, extra: Partial<DocumentInput> = {}): DocumentInput => ({
  type: 'quote',
  clientId,
  vatEnabled: true,
  lines: REFERENCE_LINES,
  ...extra,
})

async function signInSeitkali(services: Services) {
  await services.auth.login(SEITKALI)
}

/** A company with no documents at all (counters at 0), and its user signed in. */
function freshCompany(store: MockStore, vatPayer = true) {
  const companyId = '11111111-1111-4111-8111-111111111111'
  const userId = '22222222-2222-4222-8222-222222222222'
  const clientId = '33333333-3333-4333-8333-333333333333'
  store.writeAll((data) => {
    data.companies.push({ ...structuredClone(seed.companies[0]!), id: companyId, legalName: 'ИП Свежий Д.', vatPayer })
    data.users.push({
      id: userId,
      email: 'fresh@example.kz',
      fullName: 'Свежий Дархан',
      locale: 'ru',
      companyId,
      role: 'owner',
      password: DEV_PASSWORD,
    })
    data.clients.push({ ...structuredClone(kairat), id: clientId, companyId })
    data.session = { userId, accessToken: 'test' }
  })
  return { companyId, clientId }
}

/** What `public.sign` (#24) will do to a sent quote: mark it signed. */
function markStatus(store: MockStore, id: Id, status: 'signed' | 'declined' | 'cancelled') {
  store.writeAll((data) => {
    const row = data.documents.find((d) => d.id === id)!
    row.status = status
  })
}

describe('creating a draft', () => {
  it('has no number, version 1, status draft and no link', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const doc = await services.documents.create(quote(kairat.id))
    expect(doc).toMatchObject({ type: 'quote', status: 'draft', number: null, version: 1, shareUrl: null, issuedAt: null })
    expect(doc.clientName).toBe('Қайрат Әбілқасымов')
    expect(doc.signature).toBeNull()
    expect(doc.payment).toBeNull()
    expect(doc.isExpired).toBe(false)
  })

  it('takes today in Asia/Almaty as the issue date and 14 days of validity from the company', async () => {
    // 20.10.2026 23:30 in Almaty is still 20.10 there, but 21.10 in a +6 or +7 zone would not be.
    const { services } = setup(Date.UTC(2026, 9, 20, 18, 30, 0))
    await signInSeitkali(services)
    const doc = await services.documents.create(quote(kairat.id))
    expect(doc.issueDate).toBe('2026-10-20')
    expect(doc.validUntil).toBe('2026-11-03')
  })

  it('keeps validUntil null when given null, and the dates when given', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    expect((await services.documents.create(quote(kairat.id, { validUntil: null }))).validUntil).toBeNull()
    const doc = await services.documents.create(quote(kairat.id, { issueDate: '2026-11-01', validUntil: '2026-11-15' }))
    expect([doc.issueDate, doc.validUntil]).toEqual(['2026-11-01', '2026-11-15'])
  })

  it('copies the client and company requisites onto the draft', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const doc = await services.documents.create(quote(kairat.id))
    expect(doc.clientSnapshot).toMatchObject({ name: 'Қайрат Әбілқасымов', phone: '+7 701 123 45 67', binIin: '880715301453' })
    expect(doc.companySnapshot).toMatchObject({ legalName: 'ИП Сейткали Б.', iik: 'KZ75998KZT1001300335', vatPayer: true })
  })

  it('returns the same document for a repeated clientRequestId', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const clientRequestId = '44444444-4444-4444-8444-444444444444'
    const first = await services.documents.create(quote(kairat.id, { clientRequestId }))
    const second = await services.documents.create(quote(kairat.id, { clientRequestId }))
    expect(second.id).toBe(first.id)
    const drafts = await services.documents.list({ status: 'draft' })
    expect(drafts.items.filter((d) => d.id === first.id)).toHaveLength(1)
  })

  it('rejects an invoice or an act here, a missing line field and bad dates, with the field names (422)', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const bad = services.documents.create({
      ...quote(kairat.id, { issueDate: '2026-02-30', validUntil: '2026-01-01' }),
      type: 'invoice',
      lines: [{ kind: 'service', title: ' ', unit: '', qtyMilli: 0, unitPriceTiyn: -1 }],
    })
    const error = await bad.catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'validation_error', status: 422 })
    expect(Object.keys((error as { fields: object }).fields).sort()).toEqual(
      ['issueDate', 'lines.0.qtyMilli', 'lines.0.title', 'lines.0.unit', 'lines.0.unitPriceTiyn', 'type'].sort(),
    )
    await expect(
      services.documents.create(quote(kairat.id, { issueDate: '2026-10-20', validUntil: '2026-10-19' })),
    ).rejects.toMatchObject({ code: 'validation_error', fields: { validUntil: expect.any(String) } })
  })

  it('rejects an unknown catalogue item and an amount that does not fit', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    await expect(
      services.documents.create(quote(kairat.id, { lines: [{ ...REFERENCE_LINES[0]!, articleId: 'no-such-article' }] })),
    ).rejects.toMatchObject({ code: 'validation_error', fields: { 'lines.0.articleId': expect.any(String) } })
    await expect(
      services.documents.create(
        quote(kairat.id, { lines: [{ ...REFERENCE_LINES[0]!, qtyMilli: 9_000_000_000_000, unitPriceTiyn: 9_000_000_000_000 }] }),
      ),
    ).rejects.toMatchObject({ code: 'validation_error', fields: { lines: expect.any(String) } })
  })
})

describe('totals (AC 6, TC-6)', () => {
  it('are recomputed from the lines, whatever the client sent', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const forged = {
      ...quote(kairat.id),
      netTiyn: 1,
      vatTiyn: 1,
      grossTiyn: 1,
      lines: REFERENCE_LINES.map((line) => ({ ...line, netTiyn: 1, vatTiyn: 1, grossTiyn: 1 })),
    }
    const doc = await services.documents.create(forged)
    expect([doc.netTiyn, doc.vatTiyn, doc.grossTiyn]).toEqual([27925000, 4468000, 32393000])
    expect(doc.lines.map((l) => [l.netTiyn, l.vatTiyn, l.grossTiyn])).toEqual([
      [23125000, 3700000, 26825000],
      [4800000, 768000, 5568000],
    ])
    expect(doc).toMatchObject({ vatEnabled: true, vatRateBp: 1600, currency: 'KZT' })
    expect(doc.lines.map((l) => l.position)).toEqual([0, 1])
  })

  it('are recomputed on every save', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const doc = await services.documents.create(quote(kairat.id))
    const saved = await services.documents.update(doc.id, {
      ...quote(kairat.id, { lines: [{ ...REFERENCE_LINES[1]!, qtyMilli: 2500 }] }),
      version: doc.version,
      grossTiyn: 1,
    } as never)
    // 2.5 × 1 500 ₸ = 3 750 ₸, VAT 600 ₸
    expect([saved.netTiyn, saved.vatTiyn, saved.grossTiyn]).toEqual([375000, 60000, 435000])
  })

  it('carry no VAT on a quote with VAT turned off', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const doc = await services.documents.create(quote(kairat.id, { vatEnabled: false }))
    expect([doc.netTiyn, doc.vatTiyn, doc.grossTiyn]).toEqual([27925000, 0, 27925000])
    expect(doc.vatEnabled).toBe(false)
  })

  it('carry no VAT for a company that is not a VAT payer, even if the client asks for it', async () => {
    const { services } = setup()
    await services.auth.login(NURLANOV)
    const doc = await services.documents.create(quote(nurlanovClient.id, { vatEnabled: true }))
    expect(doc).toMatchObject({ vatEnabled: false, vatTiyn: 0, netTiyn: 27925000, grossTiyn: 27925000 })
  })

  it('round half up per line, then sum', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    // 0.333 × 1 ₸ = 0.333 ₸ → 33 tiyn (33.3); VAT 16 % of 33 = 5.28 → 5. Three lines: 99 net, 15 VAT.
    const line: DocumentLineInput = { kind: 'material', title: 'Саморез', unit: 'шт', qtyMilli: 333, unitPriceTiyn: 100 }
    const doc = await services.documents.create(quote(kairat.id, { lines: [line, line, line] }))
    expect([doc.netTiyn, doc.vatTiyn, doc.grossTiyn]).toEqual([99, 15, 114])
  })
})

describe('updating (AC 4, TC-4)', () => {
  it('bumps the version on every save and rejects a stale version with version_conflict (409)', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    const v = draft.version
    const first = await services.documents.update(draft.id, { ...quote(kairat.id, { notes: 'Первый' }), version: v })
    expect(first.version).toBe(v + 1)
    expect(first.notes).toBe('Первый')
    await expect(
      services.documents.update(draft.id, { ...quote(kairat.id, { notes: 'Второй' }), version: v }),
    ).rejects.toMatchObject({ code: 'version_conflict', status: 409 })
    const unchanged = await services.documents.get(draft.id)
    expect([unchanged.version, unchanged.notes]).toEqual([v + 1, 'Первый'])
    const third = await services.documents.update(draft.id, { ...quote(kairat.id), version: v + 1 })
    expect(third.version).toBe(v + 2)
  })

  it('replaces the lines whole', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    const saved = await services.documents.update(draft.id, {
      ...quote(kairat.id, { lines: [REFERENCE_LINES[0]!] }),
      version: 1,
    })
    expect(saved.lines).toHaveLength(1)
    expect(saved.lines[0]!.position).toBe(0)
  })

  it('refreshes the client snapshot while the quote is a draft, and can move it to another client', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    const saved = await services.documents.update(draft.id, { ...quote(irina.id), version: 1 })
    expect(saved.clientId).toBe(irina.id)
    expect(saved.clientSnapshot).toMatchObject({ name: 'Ирина Ёлкина', phone: null })
    expect(saved.clientName).toBe('Ирина Ёлкина')
  })

  it('works on a sent quote too, and bumps its version', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    const sent = await services.documents.issue(draft.id)
    const saved = await services.documents.update(sent.id, { ...quote(kairat.id, { notes: 'Скидка не нужна' }), version: sent.version })
    expect(saved).toMatchObject({ status: 'sent', notes: 'Скидка не нужна', version: sent.version + 1, number: sent.number })
  })

  it('keeps a sent quote on its client and refuses to empty its lines', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const sent = await services.documents.issue((await services.documents.create(quote(kairat.id))).id)
    await expect(services.documents.update(sent.id, { ...quote(irina.id), version: sent.version })).rejects.toMatchObject({
      code: 'validation_error',
      fields: { clientId: expect.any(String) },
    })
    await expect(
      services.documents.update(sent.id, { ...quote(kairat.id, { lines: [] }), version: sent.version }),
    ).rejects.toMatchObject({ code: 'validation_error', fields: { lines: expect.any(String) } })
  })

  it('is refused with document_locked (409) once the quote is signed, declined or cancelled', async () => {
    const { services, store } = setup()
    await signInSeitkali(services)
    for (const status of ['signed', 'declined', 'cancelled'] as const) {
      const sent = await services.documents.issue((await services.documents.create(quote(kairat.id))).id)
      markStatus(store, sent.id, status)
      await expect(
        services.documents.update(sent.id, { ...quote(kairat.id), version: sent.version }),
      ).rejects.toMatchObject({ code: 'document_locked', status: 409 })
    }
  })

  it('is refused on an issued invoice or act (they are editable only as drafts)', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const invoice = seed.documents.find((d) => d.type === 'invoice')!
    await expect(
      services.documents.update(invoice.id, { ...quote(kairat.id), version: invoice.version }),
    ).rejects.toMatchObject({ code: 'document_locked' })
  })
})

describe('state machine (AC 1, TC-1)', () => {
  it('goes draft → sent → signed and rejects every other move', async () => {
    const { services, store } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    expect(draft.status).toBe('draft')

    const sent = await services.documents.issue(draft.id)
    expect(sent.status).toBe('sent')
    // Delete a sent quote, issue twice: refused.
    await expect(services.documents.remove(sent.id)).rejects.toMatchObject({ code: 'document_locked', status: 409 })
    await expect(services.documents.issue(sent.id)).rejects.toMatchObject({ code: 'document_locked', status: 409 })

    markStatus(store, sent.id, 'signed')
    const signed = await services.documents.get(sent.id)
    expect(signed.status).toBe('signed')
    await expect(
      services.documents.update(signed.id, { ...quote(kairat.id), version: signed.version }),
    ).rejects.toMatchObject({ code: 'document_locked', status: 409 })
    await expect(services.documents.remove(signed.id)).rejects.toMatchObject({ code: 'document_locked' })
    await expect(services.documents.issue(signed.id)).rejects.toMatchObject({ code: 'document_locked' })
    // Nothing changed.
    expect(await services.documents.get(signed.id)).toMatchObject({ number: sent.number, version: sent.version, status: 'signed' })
  })

  it('deletes drafts only', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    await services.documents.remove(draft.id)
    await expect(services.documents.get(draft.id)).rejects.toMatchObject({ code: 'not_found', status: 404 })
    const seeded = seed.documents.find((d) => d.status === 'sent' && d.companyId === seed.companies[0]!.id)!
    await expect(services.documents.remove(seeded.id)).rejects.toMatchObject({ code: 'document_locked' })
    await expect(services.documents.get(seeded.id)).resolves.toMatchObject({ id: seeded.id })
  })

  it('does not build the act conversion yet (#31)', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    await expect(
      services.documents.convert(seed.documents[2]!.id, { target: 'act', clientRequestId: '55555555-5555-4555-8555-555555555555' }),
    ).rejects.toThrow('not implemented')
  })
})

describe('issuing (AC 2, AC 3)', () => {
  it('numbers КП-YYYY-NNNN with no gap when drafts are issued in another order or deleted (TC-2)', async () => {
    const { services, store } = setup()
    const { clientId } = freshCompany(store)
    const a = await services.documents.create(quote(clientId))
    const b = await services.documents.create(quote(clientId))
    const c = await services.documents.create(quote(clientId))
    expect([a.number, b.number, c.number]).toEqual([null, null, null])
    await services.documents.remove(b.id)
    const issuedA = await services.documents.issue(a.id)
    const issuedC = await services.documents.issue(c.id)
    expect([issuedA.number, issuedC.number]).toEqual(['КП-2026-0001', 'КП-2026-0002'])
  })

  it('numbers by the order of issue, not of creation', async () => {
    const { services, store } = setup()
    const { clientId } = freshCompany(store)
    const a = await services.documents.create(quote(clientId))
    const b = await services.documents.create(quote(clientId))
    const c = await services.documents.create(quote(clientId))
    expect((await services.documents.issue(c.id)).number).toBe('КП-2026-0001')
    expect((await services.documents.issue(a.id)).number).toBe('КП-2026-0002')
    expect((await services.documents.issue(b.id)).number).toBe('КП-2026-0003')
  })

  it('starts a new year at 0001 by the year of the issue date, and each company counts on its own', async () => {
    const { services, store } = setup()
    const { clientId } = freshCompany(store)
    expect((await services.documents.issue((await services.documents.create(quote(clientId))).id)).number).toBe('КП-2026-0001')
    const next = await services.documents.create(quote(clientId, { issueDate: '2027-01-05' }))
    expect((await services.documents.issue(next.id)).number).toBe('КП-2027-0001')
    expect((await services.documents.issue((await services.documents.create(quote(clientId))).id)).number).toBe('КП-2026-0002')

    // ИП Нурланов А. has КП-2026-0001 in the seed; his next one is 0002, and Сейткали's is unaffected.
    await services.auth.login(NURLANOV)
    const other = await services.documents.issue((await services.documents.create(quote(nurlanovClient.id))).id)
    expect(other.number).toBe('КП-2026-0002')
    await signInSeitkali(services)
    const seitkali = await services.documents.issue((await services.documents.create(quote(kairat.id))).id)
    expect(seitkali.number).toBe('КП-2026-0007')
  })

  it('a failed issue uses no number', async () => {
    const { services, store } = setup()
    const { clientId } = freshCompany(store)
    const empty = await services.documents.create(quote(clientId, { lines: [] }))
    await expect(services.documents.issue(empty.id)).rejects.toMatchObject({
      code: 'validation_error',
      fields: { lines: expect.any(String) },
    })
    const next = await services.documents.issue((await services.documents.create(quote(clientId))).id)
    expect(next.number).toBe('КП-2026-0001')
  })

  it('moves to sent, stamps issuedAt in UTC, bumps the version and creates the share link', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    const sent = await services.documents.issue(draft.id)
    expect(sent).toMatchObject({ status: 'sent', issuedAt: '2026-10-20T06:00:00Z', version: draft.version + 1 })
    expect(sent.shareUrl).toMatch(/\/p\/[A-Za-z0-9_-]{43,}$/)
    expect(await services.documents.get(sent.id)).toMatchObject({ shareUrl: sent.shareUrl, number: sent.number })
  })

  it('gives every quote its own URL-safe token of at least 43 characters (TC-3)', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const one = await services.documents.issue((await services.documents.create(quote(kairat.id))).id)
    const two = await services.documents.issue((await services.documents.create(quote(kairat.id))).id)
    const tokens = [one, two].map((d) => d.shareUrl!.split('/p/')[1]!)
    expect(tokens[0]).not.toBe(tokens[1])
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43,}$/)
  })

  it('freezes the client and company snapshots: editing the client later changes nothing (TC-3)', async () => {
    const { services, store } = setup()
    await signInSeitkali(services)
    const sent = await services.documents.issue((await services.documents.create(quote(kairat.id))).id)
    expect(sent.clientSnapshot.phone).toBe('+7 701 123 45 67')

    store.writeAll((data) => {
      const client = data.clients.find((c) => c.id === kairat.id)!
      client.phone = '+7 701 999 99 99'
      client.name = 'Қайрат Әбілқасымов-Смагулов'
      const company = data.companies.find((c) => c.id === seed.companies[0]!.id)!
      company.phone = '+7 701 000 00 00'
      company.vatPayer = false
    })

    const reread = await services.documents.get(sent.id)
    expect(reread.clientSnapshot).toMatchObject({ phone: '+7 701 123 45 67', name: 'Қайрат Әбілқасымов' })
    expect(reread.clientName).toBe('Қайрат Әбілқасымов')
    expect(reread.companySnapshot).toMatchObject({ phone: '+7 701 555 12 34', vatPayer: true })

    // A second quote issued now takes the new requisites.
    const second = await services.documents.issue((await services.documents.create(quote(kairat.id))).id)
    expect(second.clientSnapshot.phone).toBe('+7 701 999 99 99')
    expect(second).toMatchObject({ vatEnabled: false, vatTiyn: 0 })

    // Saving the first, sent quote again keeps its frozen requisites and its VAT.
    const saved = await services.documents.update(sent.id, { ...quote(kairat.id), version: sent.version })
    expect(saved.clientSnapshot.phone).toBe('+7 701 123 45 67')
    expect(saved).toMatchObject({ vatEnabled: true, vatTiyn: 4468000 })
  })

  it('takes the requisites as they are at the moment of issue, not at the last draft save', async () => {
    const { services, store } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id))
    store.writeAll((data) => {
      data.clients.find((c) => c.id === kairat.id)!.phone = '+7 701 111 11 11'
    })
    expect((await services.documents.get(draft.id)).clientSnapshot.phone).toBe('+7 701 123 45 67')
    expect((await services.documents.issue(draft.id)).clientSnapshot.phone).toBe('+7 701 111 11 11')
  })
})

describe('expired (AC 5, TC-5)', () => {
  it('is derived in Asia/Almaty and never stored', async () => {
    const { services, store, clock } = setup(Date.UTC(2026, 9, 20, 6, 0, 0))
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id, { issueDate: '2026-10-10', validUntil: '2026-10-20' }))
    const sent = await services.documents.issue(draft.id)

    clock.time = Date.UTC(2026, 9, 20, 18, 59, 59) // 23:59:59 on 20.10 in Almaty
    expect((await services.documents.get(sent.id)).isExpired).toBe(false)

    clock.time = Date.UTC(2026, 9, 20, 19, 0, 0) // 00:00 on 21.10 in Almaty
    expect((await services.documents.get(sent.id)).isExpired).toBe(true)
    const listed = (await services.documents.list({ q: sent.number! })).items[0]!
    expect(listed.isExpired).toBe(true)

    expect(store.readAll((data) => data.documents.find((d) => d.id === sent.id)!.status)).toBe('sent')
    expect(await services.documents.get(sent.id)).toMatchObject({ status: 'sent', version: sent.version })
  })

  it('applies to sent quotes only', async () => {
    const { services, store, clock } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(kairat.id, { issueDate: '2026-10-10', validUntil: '2026-10-12' }))
    expect(draft.isExpired).toBe(false)
    const sent = await services.documents.issue(draft.id)
    expect(sent.isExpired).toBe(true)
    markStatus(store, sent.id, 'signed')
    clock.time += 1000
    expect((await services.documents.get(sent.id)).isExpired).toBe(false)
    // A quote without an end date never expires.
    const open = await services.documents.issue((await services.documents.create(quote(kairat.id, { validUntil: null }))).id)
    expect(open.isExpired).toBe(false)
  })

  it('shows the seed quotes: КП-2026-0003 (valid until 10.10.2026) is expired, КП-2026-0001 is not', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const page = await services.documents.list({ type: 'quote', status: 'sent' })
    const byNumber = Object.fromEntries(page.items.map((d) => [d.number, d.isExpired]))
    expect(byNumber['КП-2026-0003']).toBe(true)
    expect(byNumber['КП-2026-0001']).toBe(false)
  })
})

describe('tenant isolation', () => {
  it("answers 404 to another company's document ids for every call, and changes nothing", async () => {
    const { services, store } = setup()
    await services.auth.login(NURLANOV)
    const foreign = await services.documents.create(quote(nurlanovClient.id))
    await signInSeitkali(services)

    await expect(services.documents.get(foreign.id)).rejects.toMatchObject({ code: 'not_found', status: 404 })
    await expect(
      services.documents.update(foreign.id, { ...quote(kairat.id), version: foreign.version }),
    ).rejects.toMatchObject({ code: 'not_found' })
    await expect(services.documents.remove(foreign.id)).rejects.toMatchObject({ code: 'not_found' })
    await expect(services.documents.issue(foreign.id)).rejects.toMatchObject({ code: 'not_found' })
    // Not a client of this company either.
    await expect(services.documents.create(quote(nurlanovClient.id))).rejects.toMatchObject({ code: 'not_found' })
    expect((await services.documents.list()).items.some((d) => d.id === foreign.id)).toBe(false)

    const row = store.readAll((data) => data.documents.find((d) => d.id === foreign.id)!)
    expect(row).toMatchObject({ status: 'draft', number: null, version: 1 })
  })

  it('needs a signed-in user (401)', async () => {
    const { services } = setup()
    await expect(services.documents.list()).rejects.toMatchObject({ code: 'unauthorized', status: 401 })
  })
})

describe('listing and reading', () => {
  it('lists newest first with the total, and pages', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const all = await services.documents.list({ limit: 200 })
    expect(all.total).toBe(12)
    const dates = all.items.map((d) => d.issueDate)
    expect(dates).toEqual([...dates].sort().reverse())
    const page = await services.documents.list({ limit: 5, offset: 10 })
    expect(page.items).toHaveLength(2)
    expect(page.total).toBe(12)
  })

  it('filters by type, status, client, dates and payment state', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    expect((await services.documents.list({ type: 'invoice' })).total).toBe(4)
    expect((await services.documents.list({ type: 'quote', status: 'draft' })).total).toBe(1)
    expect((await services.documents.list({ clientId: kairat.id })).items.every((d) => d.clientId === kairat.id)).toBe(true)
    const range = await services.documents.list({ from: '2026-10-05', to: '2026-10-12' })
    expect(range.items.every((d) => d.issueDate >= '2026-10-05' && d.issueDate <= '2026-10-12')).toBe(true)
    const overdue = await services.documents.list({ paymentState: 'overdue' })
    expect(overdue.items.map((d) => d.number)).toContain('СЧ-2026-0004')
    expect((await services.documents.list({ paymentState: 'paid' })).items.map((d) => d.number)).toEqual(['СЧ-2026-0001'])
  })

  it('searches by number or client name, ё = е, Kazakh letters kept', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const draft = await services.documents.create(quote(irina.id))
    expect((await services.documents.list({ q: 'елкина' })).items.map((d) => d.id)).toContain(draft.id)
    expect((await services.documents.list({ q: 'Ёлкина' })).items.map((d) => d.id)).toContain(draft.id)
    expect((await services.documents.list({ q: 'әбілқасымов' })).items.length).toBeGreaterThan(0)
    expect((await services.documents.list({ q: 'КП-2026-0001' })).items.map((d) => d.number)).toEqual(['КП-2026-0001'])
    expect((await services.documents.list({ q: 'нет такого' })).total).toBe(0)
  })

  it('reads a seed quote with its lines, link and children, without internal fields', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const seeded = seed.documents.find((d) => d.number === 'КП-2026-0001' && d.companyId === seed.companies[0]!.id)!
    const doc = await services.documents.get(seeded.id)
    expect(doc).toMatchObject({ number: 'КП-2026-0001', grossTiyn: 32393000, status: 'sent' })
    expect(doc.lines).toHaveLength(2)
    expect(JSON.stringify(doc)).not.toContain('qtyText')
    expect(JSON.stringify(doc)).not.toContain('clientRequestId')
    expect(doc.shareUrl).toMatch(/\/p\/uup29pDu0HCzmIXXr6O-3ZFc1c_DEFkn-FeW-RxrHvo$/)
  })

  it('gives back copies: changing a result does not change the store', async () => {
    const { services } = setup()
    await signInSeitkali(services)
    const doc = await services.documents.create(quote(kairat.id))
    doc.lines[0]!.title = 'Подменили'
    expect((await services.documents.get(doc.id)).lines[0]!.title).toBe('Укладка ламината')
  })
})
