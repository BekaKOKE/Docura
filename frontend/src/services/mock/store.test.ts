import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../errors'
import { createSeedData, seed } from './seed'
import { createStore, STORAGE_KEY, type StorageLike } from './store'
import type { StoredClient } from './storeTypes'

const SEITKALI = 'e3bc7ccf-e8aa-599e-b602-fdd8495bc378'
const SEITKALI_USER = '561fe957-d218-5818-9025-3233e8ff3d04'
const NURLANOV = '592a15c4-950b-564d-b1b7-c7752b2ebdce'
const NURLANOV_USER = '3a8cc045-e9bc-560e-8b65-03d441bc5f23'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

function signIn(store: ReturnType<typeof createStore>, userId: string) {
  store.writeAll((data) => {
    data.session = { userId, accessToken: 'test-token' }
  })
}

const newClient = (id: string, name: string): Omit<StoredClient, 'companyId'> => ({
  id,
  kind: 'person',
  name,
  binIin: null,
  phone: null,
  email: null,
  address: null,
  searchName: name.toLowerCase(),
  archivedAt: null,
})

function errorOf(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected an ApiError')
}

describe('loading and saving (AC 1)', () => {
  it('loads the seed on first start and saves it under docura.mock.v1', () => {
    const storage = memoryStorage()
    const store = createStore({ storage })
    expect(STORAGE_KEY).toBe('docura.mock.v1')
    expect(storage.map.has('docura.mock.v1')).toBe(true)
    expect(store.readAll((d) => d.clients.map((c) => c.name))).toEqual(seed.clients.map((c) => c.name))
    expect(store.persistent).toBe(true)
  })

  it('keeps data across a reload: a new store on the same storage sees the write', () => {
    const storage = memoryStorage()
    const first = createStore({ storage })
    signIn(first, SEITKALI_USER)
    first.write((db) => db.insert('clients', newClient('c-test', 'Тест Тестов')))

    const second = createStore({ storage })
    expect(second.read((db) => db.rows('clients').map((c) => c.name))).toContain('Тест Тестов')
    expect(second.readAll((d) => d.session?.userId)).toBe(SEITKALI_USER)
  })

  it.each([
    ['text that is not JSON', 'not json {'],
    ['an object of the wrong shape', JSON.stringify({ hello: 'world' })],
    ['an older layout', JSON.stringify({ ...createSeedData(), schemaVersion: 0 })],
    ['a save from another seed version', JSON.stringify({ ...createSeedData(), seedVersion: seed.version - 1 })],
    ['a missing collection', JSON.stringify({ ...createSeedData(), clients: null })],
  ])('starts from the seed when the save is %s, and replaces it', (_name, raw) => {
    const storage = memoryStorage({ [STORAGE_KEY]: raw })
    const store = createStore({ storage })
    expect(store.readAll((d) => d.clients.length)).toBe(seed.clients.length)
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).clients).toHaveLength(seed.clients.length)
  })

  it('works from memory when localStorage is unavailable', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    store.write((db) => db.insert('clients', newClient('c1', 'Только в памяти')))
    expect(store.read((db) => db.rows('clients').map((c) => c.name))).toContain('Только в памяти')
    expect(store.persistent).toBe(false)
  })

  it('works when reading throws (private mode) and when saving throws (quota), and recovers', () => {
    let full = true
    const storage: StorageLike = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError')
      },
      setItem: () => {
        if (full) throw new DOMException('quota', 'QuotaExceededError')
      },
      removeItem: () => {},
    }
    const store = createStore({ storage })
    expect(store.readAll((d) => d.clients.length)).toBe(seed.clients.length)
    expect(store.persistent).toBe(false)
    signIn(store, SEITKALI_USER)
    expect(store.read((db) => db.rows('clients')).length).toBe(3)
    full = false
    store.write((db) => db.insert('clients', newClient('c1', 'Сохранится')))
    expect(store.persistent).toBe(true)
  })

  it('reload() picks up what another tab saved', () => {
    const storage = memoryStorage()
    const tab1 = createStore({ storage })
    const tab2 = createStore({ storage })
    signIn(tab2, SEITKALI_USER)
    tab2.write((db) => db.insert('clients', newClient('c-other-tab', 'Из другой вкладки')))
    expect(tab1.readAll((d) => d.clients.some((c) => c.id === 'c-other-tab'))).toBe(false)
    tab1.reload()
    expect(tab1.readAll((d) => d.clients.some((c) => c.id === 'c-other-tab'))).toBe(true)
  })
})

describe('writes', () => {
  it('is all or nothing: a throwing write leaves no half-written data, in memory or in storage', () => {
    const storage = memoryStorage()
    const store = createStore({ storage })
    signIn(store, SEITKALI_USER)
    const before = storage.map.get(STORAGE_KEY)
    expect(() =>
      store.write((db) => {
        db.insert('clients', newClient('c-half', 'Половина'))
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(store.read((db) => db.find('clients', 'c-half'))).toBeUndefined()
    expect(storage.map.get(STORAGE_KEY)).toBe(before)
  })

  it('returns copies: changing a result never changes the store', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    const clients = store.read((db) => db.rows('clients'))
    clients[0].name = 'Испорчено'
    clients.length = 0
    const again = store.read((db) => db.rows('clients'))
    expect(again).toHaveLength(3)
    expect(again.map((c) => c.name)).not.toContain('Испорчено')
  })

  it('notifies subscribers and bumps the version on every change', () => {
    const store = createStore({ storage: null })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const start = store.version
    signIn(store, SEITKALI_USER)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.version).toBe(start + 1)
    store.read((db) => db.rows('clients'))
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.reset()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('the signed-in company', () => {
  it('is unauthorized (401) when nobody is signed in', () => {
    const store = createStore({ storage: null })
    const error = errorOf(() => store.read((db) => db.rows('clients')))
    expect(error.code).toBe('unauthorized')
    expect(error.status).toBe(401)
  })

  it('is not_found (404) for a user who has no company yet', () => {
    const store = createStore({ storage: null })
    store.writeAll((data) => {
      data.users.push({ id: 'u-new', email: 'aliya@example.kz', fullName: 'Алия', locale: 'ru', companyId: null, role: 'owner', password: 'x' })
      data.session = { userId: 'u-new', accessToken: 't' }
    })
    expect(errorOf(() => store.read((db) => db.rows('clients'))).code).toBe('not_found')
  })

  it('is unauthorized when the session points at a user that is gone', () => {
    const store = createStore({ storage: null })
    signIn(store, 'no-such-user')
    expect(errorOf(() => store.read((db) => db.rows('clients'))).code).toBe('unauthorized')
  })
})

describe('company scoping (AC 6)', () => {
  const SEITKALI_CLIENTS = ['Қайрат Әбілқасымов', 'ТОО «Алатау Құрылыс Сервис»', 'Ирина Ёлкина']

  it('shows ИП Сейткали Б. none of ИП Нурланов А.', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    expect(store.read((db) => db.rows('clients').map((c) => c.name))).toEqual(SEITKALI_CLIENTS)
    for (const collection of ['clients', 'articles', 'documents', 'payments', 'shareLinks', 'signatures'] as const) {
      expect(store.read((db) => db.rows(collection).every((r) => r.companyId === SEITKALI)), collection).toBe(true)
    }
    expect(store.read((db) => db.company().legalName)).toBe('ИП Сейткали Б.')
  })

  it('shows ИП Нурланов А. none of ИП Сейткали Б.', () => {
    const store = createStore({ storage: null })
    signIn(store, NURLANOV_USER)
    expect(store.read((db) => db.rows('clients').map((c) => c.name))).toEqual(['Айгерім Серікқызы'])
    expect(store.read((db) => db.rows('documents').every((d) => d.companyId === NURLANOV))).toBe(true)
    expect(store.read((db) => db.rows('documents').length)).toBe(1)
  })

  it('answers 404 for another company’s id on get, patch and remove, and changes nothing', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    const foreignClient = seed.clients.find((c) => c.companyId === NURLANOV)!
    const foreignDocument = seed.documents.find((d) => d.companyId === NURLANOV)!

    for (const attempt of [
      () => store.read((db) => db.get('clients', foreignClient.id)),
      () => store.read((db) => db.get('documents', foreignDocument.id)),
      () => store.write((db) => db.patch('clients', foreignClient.id, { name: 'Взлом' })),
      () => store.write((db) => db.remove('documents', foreignDocument.id)),
    ]) {
      const error = errorOf(attempt)
      expect(error.code).toBe('not_found')
      expect(error.status).toBe(404)
    }
    expect(store.read((db) => db.find('clients', foreignClient.id))).toBeUndefined()
    const untouched = store.readAll((d) => d.clients.find((c) => c.id === foreignClient.id)!.name)
    expect(untouched).toBe(foreignClient.name)
    expect(store.readAll((d) => d.documents.some((doc) => doc.id === foreignDocument.id))).toBe(true)
  })

  it('stamps new rows with the signed-in company, whatever the caller passes', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    const row = store.write((db) =>
      db.insert('clients', { ...newClient('c-mine', 'Мой'), companyId: NURLANOV } as never),
    )
    expect(row.companyId).toBe(SEITKALI)
  })

  it('does not let a patch move a row to another company or change its id', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    const own = seed.clients.find((c) => c.companyId === SEITKALI)!
    const patched = store.write((db) =>
      db.patch('clients', own.id, { name: 'Новое имя', companyId: NURLANOV, id: 'other' } as never),
    )
    expect(patched).toMatchObject({ id: own.id, companyId: SEITKALI, name: 'Новое имя' })
  })

  it('keeps document number counters per company', () => {
    const store = createStore({ storage: null })
    signIn(store, NURLANOV_USER)
    const before = store.read((db) => db.counters())
    expect(before.every((c) => c.companyId === NURLANOV)).toBe(true)
    store.write((db) => db.setCounter('quote', 2026, 99))
    expect(store.read((db) => db.counters().find((c) => c.type === 'quote' && c.year === 2026)?.lastNumber)).toBe(99)
    expect(
      store.readAll((d) => d.documentCounters.find((c) => c.companyId === SEITKALI && c.type === 'quote')?.lastNumber),
    ).toBe(seed.documentCounters.find((c) => c.companyId === SEITKALI && c.type === 'quote')!.lastNumber)
    store.write((db) => db.setCounter('act', 2027, 1))
    expect(store.read((db) => db.counters().some((c) => c.type === 'act' && c.year === 2027))).toBe(true)
  })

  it('refuses a duplicate id, even one that belongs to another company', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    const foreign = seed.clients.find((c) => c.companyId === NURLANOV)!
    expect(() => store.write((db) => db.insert('clients', newClient(foreign.id, 'Дубль')))).toThrow(/duplicate id/)
  })

  it('reads and writes an explicit company without a session (public links)', () => {
    const store = createStore({ storage: null })
    expect(store.readIn(NURLANOV, (db) => db.rows('clients').length)).toBe(1)
    store.writeIn(NURLANOV, (db) => db.insert('clients', newClient('c-public', 'Через ссылку')))
    expect(store.readIn(NURLANOV, (db) => db.rows('clients').length)).toBe(2)
    expect(store.readIn(SEITKALI, (db) => db.rows('clients').length)).toBe(3)
  })
})

describe('reset (AC 4)', () => {
  it('brings back the seed and drops everything added', () => {
    const storage = memoryStorage()
    const store = createStore({ storage })
    signIn(store, SEITKALI_USER)
    store.write((db) => {
      db.insert('clients', newClient('c-test', 'Тест Тестов'))
      db.remove('articles', seed.articles.find((a) => a.companyId === SEITKALI)!.id)
    })
    store.reset()
    expect(store.read((db) => db.rows('clients').map((c) => c.name))).not.toContain('Тест Тестов')
    expect(store.readAll((d) => d.articles)).toEqual(createSeedData().articles)
    expect(store.readAll((d) => d.clients)).toEqual(createSeedData().clients)
    expect(store.readAll((d) => d.documents)).toEqual(createSeedData().documents)
    expect(JSON.parse(storage.map.get(STORAGE_KEY)!).clients).toHaveLength(seed.clients.length)
  })

  it('keeps a seed user signed in', () => {
    const store = createStore({ storage: null })
    signIn(store, SEITKALI_USER)
    store.reset()
    expect(store.readAll((d) => d.session?.userId)).toBe(SEITKALI_USER)
  })

  it('signs out an account that only existed in the changed data', () => {
    const store = createStore({ storage: null })
    store.writeAll((data) => {
      data.users.push({ id: 'u-new', email: 'aliya@example.kz', fullName: 'Алия', locale: 'ru', companyId: null, role: 'owner', password: 'x' })
      data.session = { userId: 'u-new', accessToken: 't' }
    })
    store.reset()
    expect(store.readAll((d) => d.session)).toBeNull()
    expect(store.readAll((d) => d.users.some((u) => u.id === 'u-new'))).toBe(false)
  })
})
