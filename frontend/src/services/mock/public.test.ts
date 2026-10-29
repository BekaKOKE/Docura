import { describe, expect, it } from 'vitest'
import { isApiError } from '../errors'
import type { PublicSignInput } from '../types'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

// public.get and public.sign (#24): the client's side of a shared link, no account.

const instant = async () => {}

/** 20.10.2026 11:00 in Asia/Almaty, the seed's reference date. */
const START = Date.UTC(2026, 9, 20, 6, 0, 0)

const SEITKALI = { email: 'seitkali@example.kz', password: DEV_PASSWORD }
const NURLANOV = { email: 'nurlanov@example.kz', password: DEV_PASSWORD }

// A valid 1x1 PNG.
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function setup() {
  const store = createStore({ storage: null })
  const clock = { time: START }
  const runtime = createMockRuntime({ store, sleep: instant, now: () => new Date(clock.time) })
  return { store, clock, services: createMockServices(() => runtime) }
}

const company = seed.companies[0]!
const quoteOf = (predicate: (d: (typeof seed.documents)[number]) => boolean) => {
  const document = seed.documents.find((d) => d.type === 'quote' && predicate(d))!
  const link = seed.shareLinks.find((l) => l.documentId === document.id)!
  return { document, token: link.token }
}
const sent = quoteOf((d) => d.status === 'sent' && d.companyId === company.id && d.validUntil! >= '2026-10-20')
const signed = quoteOf((d) => d.status === 'signed' && d.companyId === company.id)
const expiredQuote = quoteOf((d) => d.status === 'sent' && d.companyId === company.id && d.validUntil! < '2026-10-20')

const signInput = (version: number, extra: Partial<PublicSignInput> = {}): PublicSignInput => ({
  signerName: '  Асет Нұрланов ',
  signaturePng: PNG_1X1,
  consentAccepted: true,
  personalDataConsent: true,
  version,
  ...extra,
})

const errorOf = (promise: Promise<unknown>) => promise.then(() => undefined, (e: unknown) => e)

async function expectError(promise: Promise<unknown>, code: string) {
  const error = await errorOf(promise)
  expect(isApiError(error) && error.code, `expected ${code}`).toBe(code)
  return error as Exclude<typeof error, undefined> & { fields?: Record<string, string> }
}

describe('public.get', () => {
  it('returns the whitelisted view of a sent quote', async () => {
    const { services } = setup()

    const doc = await services.public.get(sent.token)

    expect(doc).toMatchObject({
      type: 'quote',
      status: 'sent',
      number: sent.document.number,
      validUntil: sent.document.validUntil,
      grossTiyn: sent.document.grossTiyn,
      version: sent.document.version,
      canSign: true,
      isExpired: false,
      signature: null,
      signatureImageUrl: null,
      logoUrl: null,
    })
    expect(doc.lines.length).toBe(sent.document.lines.length)
    expect(doc.clientSnapshot.name).toBe(sent.document.clientSnapshot.name)
    expect(doc.companySnapshot.legalName).toBe(company.legalName)
  })

  it('has no internal ids and no token in the result', async () => {
    const { services } = setup()

    const json = JSON.stringify(await services.public.get(sent.token))

    for (const secret of [company.id, sent.document.clientId, sent.document.id, sent.token]) {
      expect(json).not.toContain(secret)
    }
  })

  it('counts a view for an anonymous caller, and again on the next one', async () => {
    const { services, store, clock } = setup()
    const viewsOf = () => store.readAll((d) => d.shareLinks.find((l) => l.token === sent.token)!)

    await services.public.get(sent.token)
    clock.time += 60_000
    await services.public.get(sent.token)

    const link = viewsOf()
    expect(link.viewCount).toBe(2)
    expect(link.firstViewedAt).toBe('2026-10-20T06:00:00Z')
    expect(link.lastViewedAt).toBe('2026-10-20T06:01:00Z')
  })

  it('does not count a view for a signed-in member of the same company', async () => {
    const { services, store } = setup()
    await services.auth.login(SEITKALI)

    const doc = await services.public.get(sent.token)

    expect(doc.canSign).toBe(true)
    expect(store.readAll((d) => d.shareLinks.find((l) => l.token === sent.token)!.viewCount)).toBe(0)
  })

  it("counts a view for a signed-in member of another company", async () => {
    const { services, store } = setup()
    await services.auth.login(NURLANOV)

    await services.public.get(sent.token)

    expect(store.readAll((d) => d.shareLinks.find((l) => l.token === sent.token)!.viewCount)).toBe(1)
  })

  it('shows a signed quote with its signature and cannot be signed again', async () => {
    const { services } = setup()

    const doc = await services.public.get(signed.token)

    expect(doc.status).toBe('signed')
    expect(doc.canSign).toBe(false)
    expect(doc.isExpired).toBe(false)
    expect(doc.signature).toMatchObject({ method: 'drawn', documentVersion: 1 })
    expect(doc.signature!.signerName).not.toBe('')
    expect(doc.signatureImageUrl?.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('marks an expired sent quote: isExpired true, canSign false', async () => {
    const { services } = setup()

    const doc = await services.public.get(expiredQuote.token)

    expect(doc.status).toBe('sent')
    expect(doc.isExpired).toBe(true)
    expect(doc.canSign).toBe(false)
  })

  it('is not_found for an unknown token', async () => {
    const { services } = setup()
    await expectError(services.public.get('no-such-token'), 'not_found')
  })

  it('is link_revoked (410) for a withdrawn link', async () => {
    const { services, store } = setup()
    store.writeAll((d) => {
      d.shareLinks.find((l) => l.token === sent.token)!.revokedAt = '2026-10-19T06:00:00Z'
    })

    const error = await expectError(services.public.get(sent.token), 'link_revoked')

    expect((error as { status: number }).status).toBe(410)
  })
})

describe('public.sign', () => {
  it('signs a sent quote: the owner sees it signed, with the evidence', async () => {
    const { services, store } = setup()
    const before = await services.public.get(sent.token)

    const result = await services.public.sign(sent.token, signInput(before.version))

    expect(result).toMatchObject({ status: 'signed', canSign: false, version: before.version + 1 })
    expect(result.signature).toMatchObject({
      method: 'drawn',
      signerName: 'Асет Нұрланов',
      signedAt: '2026-10-20T06:00:00Z',
      documentVersion: before.version,
    })
    expect(result.signatureImageUrl).toBe(`data:image/png;base64,${PNG_1X1}`)

    await services.auth.login(SEITKALI)
    const owned = await services.documents.get(sent.document.id)
    expect(owned.status).toBe('signed')
    expect(owned.signedAt).toBe('2026-10-20T06:00:00Z')
    expect(owned.signature).toMatchObject({ method: 'drawn', signerName: 'Асет Нұрланов' })

    const row = store.readAll((d) => d.signatures.find((s) => s.documentId === sent.document.id)!)
    expect(row).toMatchObject({
      method: 'drawn',
      signerRole: 'client',
      imagePngBase64: PNG_1X1,
      documentVersion: before.version,
    })
    expect(row.consentText).toBe(
      `Я ознакомился с коммерческим предложением № ${sent.document.number} на сумму 323 930 ₸ и принимаю его.\n` +
        'Согласен на обработку моих персональных данных (имя, подпись, IP-адрес) для подтверждения подписи.',
    )
    expect(row.imageSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(row.documentSha256).toMatch(/^[0-9a-f]{64}$/)

    const blob = await services.documents.signatureBlob(sent.document.id)
    expect(blob.type).toBe('image/png')
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('gives already_signed on a second signature, and for a seed quote that is signed', async () => {
    const { services } = setup()
    const { version } = await services.public.get(sent.token)
    await services.public.sign(sent.token, signInput(version))

    await expectError(services.public.sign(sent.token, signInput(version)), 'already_signed')
    await expectError(services.public.sign(signed.token, signInput(signed.document.version)), 'already_signed')
  })

  it('gives version_conflict when the owner edited the quote after the client opened it', async () => {
    const { services } = setup()
    const seen = await services.public.get(sent.token)
    await services.auth.login(SEITKALI)
    const doc = await services.documents.get(sent.document.id)
    await services.documents.update(doc.id, {
      type: 'quote',
      clientId: doc.clientId,
      issueDate: doc.issueDate,
      validUntil: doc.validUntil,
      vatEnabled: doc.vatEnabled,
      notes: 'Изменено владельцем',
      version: doc.version,
      lines: doc.lines.map((l) => ({
        kind: l.kind,
        title: l.title,
        unit: l.unit,
        qtyMilli: l.qtyMilli,
        unitPriceTiyn: l.unitPriceTiyn,
        discountBp: l.discountBp,
      })),
    })

    await expectError(services.public.sign(sent.token, signInput(seen.version)), 'version_conflict')

    const fresh = await services.public.get(sent.token)
    expect(fresh.version).toBe(seen.version + 1)
    await expect(services.public.sign(sent.token, signInput(fresh.version))).resolves.toMatchObject({ status: 'signed' })
  })

  it('gives link_expired for an expired quote', async () => {
    const { services } = setup()
    const error = await expectError(
      services.public.sign(expiredQuote.token, signInput(expiredQuote.document.version)),
      'link_expired',
    )
    expect((error as { status: number }).status).toBe(410)
  })

  it('is not_found and link_revoked for a bad token, like get', async () => {
    const { services, store } = setup()
    await expectError(services.public.sign('no-such-token', signInput(1)), 'not_found')
    store.writeAll((d) => {
      d.shareLinks.find((l) => l.token === sent.token)!.revokedAt = '2026-10-19T06:00:00Z'
    })
    await expectError(services.public.sign(sent.token, signInput(1)), 'link_revoked')
  })

  const hugePng = () => {
    const magic = String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    return btoa(magic + ' '.repeat(200 * 1024 + 1 - magic.length))
  }
  const notPng = btoa('this is plain text, not a picture')

  it.each<[string, Partial<PublicSignInput>, string]>([
    ['an empty name', { signerName: '   ' }, 'signerName'],
    ['a name over 200 characters', { signerName: 'А'.repeat(201) }, 'signerName'],
    ['a picture that is not base64', { signaturePng: '%%% not base64 %%%' }, 'signaturePng'],
    ['bytes that are not a PNG', { signaturePng: notPng }, 'signaturePng'],
    ['an empty picture', { signaturePng: '' }, 'signaturePng'],
    ['a picture over 200 KB', { signaturePng: hugePng() }, 'signaturePng'],
    ['no signature consent', { consentAccepted: false as unknown as true }, 'consentAccepted'],
    ['no personal data consent', { personalDataConsent: false as unknown as true }, 'personalDataConsent'],
  ])('is a validation_error for %s', async (_label, extra, field) => {
    const { services, store } = setup()

    const error = await expectError(services.public.sign(sent.token, signInput(sent.document.version, extra)), 'validation_error')

    expect(Object.keys(error.fields ?? {})).toEqual([field])
    expect(error.fields![field]).toMatch(/[А-Яа-яЁё]/)
    // Nothing was written.
    expect(store.readAll((d) => d.signatures.some((s) => s.documentId === sent.document.id))).toBe(false)
    expect(store.readAll((d) => d.documents.find((x) => x.id === sent.document.id)!.status)).toBe('sent')
  })

  it('accepts a signature sent as a data URL and stores it without the prefix', async () => {
    const { services, store } = setup()

    await services.public.sign(sent.token, signInput(sent.document.version, { signaturePng: `data:image/png;base64,${PNG_1X1}` }))

    expect(store.readAll((d) => d.signatures.find((s) => s.documentId === sent.document.id)!.imagePngBase64)).toBe(PNG_1X1)
  })

  it('has no internal ids in the result', async () => {
    const { services } = setup()

    const json = JSON.stringify(await services.public.sign(sent.token, signInput(sent.document.version)))

    for (const secret of [company.id, sent.document.clientId, sent.document.id, sent.token]) {
      expect(json).not.toContain(secret)
    }
  })
})
