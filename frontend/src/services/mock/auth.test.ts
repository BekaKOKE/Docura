import { describe, expect, it } from 'vitest'
import readme from '../../../../contracts/README.md?raw'
import { ApiError } from '../errors'
import { createMockServices } from './index'
import { createErrorInjector } from './errorInjection'
import { LOGIN_LIMIT, LOGIN_WINDOW_MS } from './auth'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD } from './seed'
import { createStore, STORAGE_KEY, type StorageLike } from './store'

const instant = async () => {}

function setup(options: { storage?: StorageLike | null; start?: number } = {}) {
  const store = createStore({ storage: options.storage === undefined ? null : options.storage })
  const injector = createErrorInjector()
  const clock = { time: options.start ?? Date.UTC(2026, 9, 20, 6, 0, 0) }
  const runtime = createMockRuntime({ store, injector, sleep: instant, now: () => new Date(clock.time) })
  return { store, injector, clock, services: createMockServices(() => runtime) }
}

function mapStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

const SEITKALI = { email: 'seitkali@example.kz', password: DEV_PASSWORD }
const NURLANOV = { email: 'nurlanov@example.kz', password: DEV_PASSWORD }

describe('dev logins (AC 1)', () => {
  it('are the ones listed in contracts/README.md', () => {
    const rows = [...readme.matchAll(/^\| (\S+@\S+) \| (.+?) \| `([^`]+)` \|$/gm)]
    expect(rows.map((r) => [r[1], r[3]])).toEqual([
      [SEITKALI.email, DEV_PASSWORD],
      [NURLANOV.email, DEV_PASSWORD],
    ])
  })

  it('sign seitkali@example.kz in to ИП Сейткали Б.', async () => {
    const { services } = setup()
    const session = await services.auth.login(SEITKALI)
    expect(session.user).toMatchObject({ email: 'seitkali@example.kz', fullName: 'Сейткали Бекзат', locale: 'ru' })
    expect(session.accessToken).toMatch(/^mock\./)
    const me = await services.auth.me()
    expect(me.user.email).toBe('seitkali@example.kz')
    expect(me.companies.map((c) => c.legalName)).toEqual(['ИП Сейткали Б.'])
    expect(me.companies[0]).toMatchObject({ vatPayer: true, hasLogo: false, currency: 'KZT' })
  })

  it('sign nurlanov@example.kz in to ИП Нурланов А.', async () => {
    const { services } = setup()
    await services.auth.login(NURLANOV)
    const me = await services.auth.me()
    expect(me.companies.map((c) => c.legalName)).toEqual(['ИП Нурланов А.'])
    expect(me.companies[0]?.vatPayer).toBe(false)
  })

  it('ignore case and spaces around the email', async () => {
    const { services } = setup()
    const session = await services.auth.login({ email: '  Seitkali@Example.KZ ', password: DEV_PASSWORD })
    expect(session.user.email).toBe('seitkali@example.kz')
  })

  it('never hand out the password', async () => {
    const { services } = setup()
    const session = await services.auth.login(SEITKALI)
    const me = await services.auth.me()
    expect(JSON.stringify([session, me])).not.toContain(DEV_PASSWORD)
  })

  it('are rejected with a wrong password or an unknown email (401)', async () => {
    const { services } = setup()
    for (const input of [
      { email: SEITKALI.email, password: 'wrong-password' },
      { email: 'nobody@example.kz', password: DEV_PASSWORD },
      { email: SEITKALI.email, password: '' },
    ]) {
      const error = await services.auth.login(input).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ code: 'unauthorized', status: 401 })
    }
    await expect(services.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('stay signed in across a reload (a new store on the same storage)', async () => {
    const storage = mapStorage()
    await setup({ storage }).services.auth.login(SEITKALI)
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
    const after = setup({ storage })
    expect((await after.services.auth.me()).user.email).toBe('seitkali@example.kz')
  })
})

describe('me and logout', () => {
  it('me is unauthorized when nobody is signed in', async () => {
    const { services } = setup()
    await expect(services.auth.me()).rejects.toMatchObject({ code: 'unauthorized', status: 401 })
  })

  it('logout forgets the session', async () => {
    const { services } = setup()
    await services.auth.login(SEITKALI)
    await services.auth.logout()
    await expect(services.auth.me()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('logout never fails, even with an error forced', async () => {
    const { services, injector } = setup()
    await services.auth.login(SEITKALI)
    injector.force('rate_limited')
    await expect(services.auth.logout()).resolves.toBeUndefined()
    await expect(services.auth.me()).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('a forced unauthorized reaches me as it would from the API', async () => {
    const { services, injector } = setup()
    await services.auth.login(SEITKALI)
    injector.force('unauthorized')
    await expect(services.auth.me()).rejects.toMatchObject({ code: 'unauthorized', status: 401 })
    await expect(services.auth.me()).resolves.toMatchObject({ user: { email: 'seitkali@example.kz' } })
  })
})

describe('register', () => {
  const aliya = { email: 'aliya@example.kz', password: 'correct-horse', fullName: 'Алия Нурланкызы' }

  it('creates the account, signs it in, and it has no company yet', async () => {
    const { services } = setup()
    const session = await services.auth.register(aliya)
    expect(session.user).toMatchObject({ email: 'aliya@example.kz', fullName: 'Алия Нурланкызы', locale: 'ru' })
    expect(await services.auth.me()).toMatchObject({ companies: [] })
    await services.auth.logout()
    const again = await services.auth.login({ email: 'ALIYA@example.kz', password: aliya.password })
    expect(again.user.id).toBe(session.user.id)
  })

  it('shows the new account none of the seed data (AC 6)', async () => {
    const { services, store } = setup()
    await services.auth.register(aliya)
    // No company yet, so there is nothing to read: a company-scoped read is a 404, never the seed's rows.
    expect(() => store.read((db) => db.rows('clients'))).toThrow(ApiError)
    expect(() => store.read((db) => db.rows('documents'))).toThrow(expect.objectContaining({ code: 'not_found' }))
  })

  it('shows a seed company none of the new account’s data (AC 6)', async () => {
    const { services, store } = setup()
    const { user } = await services.auth.register(aliya)
    store.writeAll((data) => {
      data.companies.push({ ...data.companies[0]!, id: 'company-aliya', legalName: 'ИП Алия' })
      data.users.find((u) => u.id === user.id)!.companyId = 'company-aliya'
      data.clients.push({ ...data.clients[0]!, id: 'client-aliya', companyId: 'company-aliya', name: 'Клиент Алии' })
    })
    expect(store.read((db) => db.rows('clients').map((c) => c.name))).toEqual(['Клиент Алии'])
    await services.auth.login(SEITKALI)
    const names = store.read((db) => db.rows('clients').map((c) => c.name))
    expect(names).not.toContain('Клиент Алии')
    expect(names).toHaveLength(3)
    await services.auth.login(NURLANOV)
    expect(store.read((db) => db.rows('clients').map((c) => c.name))).toEqual(['Айгерім Серікқызы'])
  })

  it.each([
    ['a bad email', { ...aliya, email: 'aliya-at-example' }, 'email'],
    ['an empty email', { ...aliya, email: '  ' }, 'email'],
    ['a short password', { ...aliya, password: '1234567' }, 'password'],
    ['an empty name', { ...aliya, fullName: '   ' }, 'fullName'],
  ])('rejects %s with a validation_error on that field (422)', async (_name, input, field) => {
    const { services, store } = setup()
    const error = await services.auth.register(input).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'validation_error', status: 422 })
    expect(Object.keys((error as ApiError).fields ?? {})).toEqual([field])
    expect(store.readAll((d) => d.users)).toHaveLength(2)
  })

  it('rejects an email that is taken, in any case, by a seed user or a new one', async () => {
    const { services } = setup()
    await expect(services.auth.register({ ...aliya, email: 'Seitkali@example.kz' })).rejects.toMatchObject({
      code: 'validation_error',
      fields: { email: expect.stringContaining('уже') },
    })
    await services.auth.register(aliya)
    await expect(services.auth.register({ ...aliya, email: 'ALIYA@example.kz' })).rejects.toMatchObject({
      code: 'validation_error',
    })
  })
})

describe('login rate limit', () => {
  it('allows 5 tries a minute per email and answers rate_limited (429) after that', async () => {
    const { services, clock } = setup()
    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      await expect(services.auth.login({ email: SEITKALI.email, password: 'wrong' })).rejects.toMatchObject({
        code: 'unauthorized',
      })
    }
    const limited = await services.auth.login(SEITKALI).catch((e: unknown) => e)
    expect(limited).toMatchObject({ code: 'rate_limited', status: 429 })
    // Another email is not affected.
    await expect(services.auth.login(NURLANOV)).resolves.toBeDefined()
    // A minute later the same email may try again.
    clock.time += LOGIN_WINDOW_MS
    await expect(services.auth.login(SEITKALI)).resolves.toBeDefined()
  })

  it('forgets earlier mistakes after a successful sign-in', async () => {
    const { services } = setup()
    for (let i = 0; i < LOGIN_LIMIT - 1; i += 1) {
      await services.auth.login({ email: SEITKALI.email, password: 'wrong' }).catch(() => {})
    }
    await expect(services.auth.login(SEITKALI)).resolves.toBeDefined()
    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      await expect(services.auth.login({ email: SEITKALI.email, password: 'wrong' })).rejects.toMatchObject({
        code: 'unauthorized',
      })
    }
  })
})
