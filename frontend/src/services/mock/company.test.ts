import { describe, expect, it } from 'vitest'
import { ApiError } from '../errors'
import type { CompanyInput } from '../types'
import { createErrorInjector } from './errorInjection'
import { createMockServices } from './index'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD } from './seed'
import { createStore } from './store'

const instant = async () => {}

function setup() {
  const store = createStore({ storage: null })
  const injector = createErrorInjector()
  const runtime = createMockRuntime({ store, injector, sleep: instant })
  return { store, injector, services: createMockServices(() => runtime) }
}

const TC3: CompanyInput = {
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

async function register(services: ReturnType<typeof setup>['services']) {
  await services.auth.register({ email: 'aliya@example.kz', password: 'Тест-Пароль-2026', fullName: 'Әлия Сейткали' })
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the call to fail')
}

const blob = (bytes: number[], size = bytes.length) => {
  const padded = new Uint8Array(size)
  padded.set(bytes)
  return new Blob([padded])
}
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('company.create and get (AC 1, 3)', () => {
  it('saves the TC-3 data and returns it as entered, Kazakh letters intact', async () => {
    const { services } = setup()
    await register(services)
    const created = await services.company.create(TC3)
    expect(created).toMatchObject({ ...TC3, currency: 'KZT', timezone: 'Asia/Almaty', invoiceDueDays: 5, hasLogo: false })
    const again = await services.company.get()
    expect(again).toEqual(created)
    expect(again.address).toBe('г. Алматы, ул. Сәтбаев, 22')
    const me = await services.auth.me()
    expect(me.companies.map((c) => c.id)).toEqual([created.id])
  })

  it('starts with no company: get is not_found until onboarding is done', async () => {
    const { services } = setup()
    await register(services)
    expect((await failure(services.company.get())).code).toBe('not_found')
    expect((await services.auth.me()).companies).toEqual([])
  })

  it('leaves the optional fields empty as null and defaults the validity to 14 days', async () => {
    const { services } = setup()
    await register(services)
    const { phone, bankName, iik, bik, kbe, defaultKnp, quoteValidityDays, ...required } = TC3
    void [phone, bankName, iik, bik, kbe, defaultKnp, quoteValidityDays]
    const company = await services.company.create(required)
    expect(company).toMatchObject({ phone: null, bankName: null, iik: null, bik: null, kbe: null, defaultKnp: null, quoteValidityDays: 14 })
  })

  it('cleans what it stores: ИИК in capitals, a canonical phone', async () => {
    const { services } = setup()
    await register(services)
    const company = await services.company.create({ ...TC3, iik: 'kz75 998kzt 1001300335', phone: '87011234567' })
    expect(company).toMatchObject({ iik: 'KZ75998KZT1001300335', phone: '+7 701 123 45 67' })
  })

  it('refuses bad values with a message per field, in words', async () => {
    const { services } = setup()
    await register(services)
    const error = await failure(
      services.company.create({ ...TC3, binIin: '850312300122', iik: 'KZ75998KZT100130033', defaultKnp: '85', kbe: '7', phone: '123', legalName: '' }),
    )
    expect(error).toMatchObject({ code: 'validation_error', status: 422 })
    expect(Object.keys(error.fields ?? {}).sort()).toEqual(['binIin', 'defaultKnp', 'iik', 'kbe', 'legalName', 'phone'])
    for (const message of Object.values(error.fields ?? {})) expect(message).toMatch(/[А-Яа-я]/)
    expect((await services.auth.me()).companies).toEqual([])
  })

  it('allows one company per account', async () => {
    const { services } = setup()
    await register(services)
    await services.company.create(TC3)
    expect((await failure(services.company.create(TC3))).code).toBe('validation_error')
  })

  it('needs a signed-in user', async () => {
    const { services } = setup()
    expect((await failure(services.company.create(TC3))).code).toBe('unauthorized')
    expect((await failure(services.company.get())).code).toBe('unauthorized')
  })
})

describe('company.update', () => {
  it('changes only what is in the patch and keeps the rest', async () => {
    const { services } = setup()
    await register(services)
    await services.company.create(TC3)
    const updated = await services.company.update({ vatPayer: false, quoteValidityDays: 30, phone: null })
    expect(updated).toMatchObject({ ...TC3, vatPayer: false, quoteValidityDays: 30, phone: null })
    expect(await services.company.get()).toEqual(updated)
  })

  it('refuses an invalid patch and keeps the saved data', async () => {
    const { services } = setup()
    await register(services)
    const saved = await services.company.create(TC3)
    const error = await failure(services.company.update({ binIin: '850312300122' }))
    expect(error.fields).toHaveProperty('binIin')
    expect(await services.company.get()).toEqual(saved)
  })

  it("only reaches the signed-in user's own company", async () => {
    const { services } = setup()
    await services.auth.login({ email: 'nurlanov@example.kz', password: DEV_PASSWORD })
    await services.company.update({ legalName: 'ИП Нурланов А. (новое)' })
    await services.auth.login({ email: 'seitkali@example.kz', password: DEV_PASSWORD })
    expect((await services.company.get()).legalName).toBe('ИП Сейткали Б.')
  })

  it('takes a forced error from the dev panel like every call', async () => {
    const { services, injector } = setup()
    await register(services)
    await services.company.create(TC3)
    injector.force('rate_limited')
    expect((await failure(services.company.get())).code).toBe('rate_limited')
    expect((await services.company.get()).legalName).toBe(TC3.legalName)
  })
})

describe('company logo (AC 5)', () => {
  it('stores a PNG of 120 KB and a JPEG of 299 KB as a data URL', async () => {
    const { services } = setup()
    await register(services)
    await services.company.create(TC3)
    expect(await services.company.logoUrl()).toBeNull()
    await services.company.uploadLogo(blob(PNG_HEAD, 120 * 1024))
    expect((await services.company.logoUrl())?.startsWith('data:image/png;base64,')).toBe(true)
    expect((await services.company.get()).hasLogo).toBe(true)
    await services.company.uploadLogo(blob([0xff, 0xd8, 0xff, 0xe0], 299 * 1024))
    expect((await services.company.logoUrl())?.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('refuses 301 KB, a GIF and a text file named logo.png, and keeps the logo it had', async () => {
    const { services } = setup()
    await register(services)
    await services.company.create(TC3)
    await services.company.uploadLogo(blob(PNG_HEAD, 1000))
    const before = await services.company.logoUrl()
    const tooBig = await failure(services.company.uploadLogo(blob(PNG_HEAD, 301 * 1024)))
    expect(tooBig).toMatchObject({ code: 'validation_error' })
    expect(tooBig.fields?.logo).toMatch(/300/)
    const gif = await failure(services.company.uploadLogo(blob([...new TextEncoder().encode('GIF89a')], 50 * 1024)))
    expect(gif.fields?.logo).toMatch(/PNG/)
    const renamed = await failure(
      services.company.uploadLogo(new File([new TextEncoder().encode('not an image at all')], 'logo.png', { type: 'image/png' })),
    )
    expect(renamed.fields?.logo).toMatch(/PNG/)
    expect(await services.company.logoUrl()).toBe(before)
  })

  it('does not carry the data URL on the company', async () => {
    const { services } = setup()
    await register(services)
    await services.company.create(TC3)
    await services.company.uploadLogo(blob(PNG_HEAD, 2000))
    expect(JSON.stringify(await services.company.get())).not.toContain('data:image')
    expect(JSON.stringify(await services.auth.me())).not.toContain('data:image')
  })
})
