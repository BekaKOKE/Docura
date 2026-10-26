import { describe, expect, it } from 'vitest'
import { ApiError } from '../errors'
import { createMockServices } from './index'
import { createErrorInjector } from './errorInjection'
import { createMockRuntime } from './runtime'
import { DEV_PASSWORD, seed } from './seed'
import { createStore } from './store'

const instant = async () => {}
const SEITKALI = { email: 'seitkali@example.kz', password: DEV_PASSWORD }
const NURLANOV = { email: 'nurlanov@example.kz', password: DEV_PASSWORD }

async function setup(login = SEITKALI) {
  const store = createStore({ storage: null })
  const injector = createErrorInjector()
  const runtime = createMockRuntime({ store, injector, sleep: instant, now: () => new Date(Date.UTC(2026, 9, 20, 6, 0, 0)) })
  const services = createMockServices(() => runtime)
  await services.auth.login(login)
  return { store, injector, services, clients: services.clients }
}

const names = (page: { items: { name: string }[] }) => page.items.map((c) => c.name)
const rejection = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the call to fail')
}

describe('clients.list: search (AC 1)', () => {
  it('lists the active clients of the company, by name', async () => {
    const { clients } = await setup()
    const page = await clients.list()
    expect(page.total).toBe(3)
    expect(names(page)).toEqual(['Ирина Ёлкина', 'Қайрат Әбілқасымов', 'ТОО «Алатау Құрылыс Сервис»'])
  })

  it('finds «Ирина Ёлкина» by «елкина» and «ЁЛКИНА»', async () => {
    const { clients } = await setup()
    expect(names(await clients.list({ q: 'елкина' }))).toEqual(['Ирина Ёлкина'])
    expect(names(await clients.list({ q: 'ЁЛКИНА' }))).toEqual(['Ирина Ёлкина'])
  })

  it('finds «Қайрат Әбілқасымов» by «қайрат» and «Қайрат», not by Russian «кайрат»', async () => {
    const { clients } = await setup()
    expect(names(await clients.list({ q: 'қайрат' }))).toEqual(['Қайрат Әбілқасымов'])
    expect(names(await clients.list({ q: 'Қайрат' }))).toEqual(['Қайрат Әбілқасымов'])
    expect((await clients.list({ q: 'кайрат' })).items).toEqual([])
  })

  it('finds a company by a word inside «ёлочки» and ignores spaces around the query', async () => {
    const { clients } = await setup()
    expect(names(await clients.list({ q: '  алатау  ' }))).toEqual(['ТОО «Алатау Құрылыс Сервис»'])
  })

  it('pages the result and counts every match in total', async () => {
    const { clients } = await setup()
    const page = await clients.list({ limit: 2, offset: 1 })
    expect(page.total).toBe(3)
    expect(names(page)).toEqual(['Қайрат Әбілқасымов', 'ТОО «Алатау Құрылыс Сервис»'])
    expect(names(await clients.list({ limit: 2, offset: 4 }))).toEqual([])
  })
})

describe('clients.create and update (AC 2)', () => {
  it('saves a person with Kazakh letters unchanged and no ИИН', async () => {
    const { clients } = await setup()
    const created = await clients.create({ kind: 'person', name: '  Ұлжан Төлеуғали ', phone: '+7 777 000 11 22' })
    expect(created).toMatchObject({
      kind: 'person',
      name: 'Ұлжан Төлеуғали',
      phone: '+7 777 000 11 22',
      binIin: null,
      email: null,
      searchName: 'ұлжан төлеуғали',
      archivedAt: null,
    })
    expect((await clients.get(created.id)).name).toBe('Ұлжан Төлеуғали')
    expect(names(await clients.list({ q: 'төлеуғали' }))).toEqual(['Ұлжан Төлеуғали'])
  })

  it('saves a company with a valid БИН, typed in groups', async () => {
    const { clients } = await setup()
    const created = await clients.create({ kind: 'company', name: 'ТОО «Тест»', binIin: '080540 001 238' })
    expect(created.binIin).toBe('080540001238')
  })

  it('refuses a БИН with a wrong control digit and saves nothing (TC-2)', async () => {
    const { clients } = await setup()
    const created = await clients.create({ kind: 'company', name: 'ТОО «Тест»', binIin: '080540001238' })
    const error = await rejection(clients.update(created.id, { binIin: '080540001239' }))
    expect(error).toMatchObject({ code: 'validation_error', status: 422 })
    expect(error.fields?.binIin).toBe('ИИН или БИН указан неверно: проверьте цифры')
    expect((await clients.get(created.id)).binIin).toBe('080540001238')
  })

  it('refuses a name of spaces only, and a bad ИИН, phone and email, with a message per field', async () => {
    const { clients, store } = await setup()
    const before = store.readAll((d) => d.clients.length)
    const error = await rejection(
      clients.create({ kind: 'person', name: '   ', binIin: '850312300122', phone: '123', email: 'x@' }),
    )
    expect(Object.keys(error.fields ?? {}).sort()).toEqual(['binIin', 'email', 'name', 'phone'])
    expect(error.fields?.name).toBe('Укажите имя')
    expect(store.readAll((d) => d.clients.length)).toBe(before)
  })

  it('keeps a 120-character name whole', async () => {
    const { clients } = await setup()
    const name = 'Абдрахманов-Ёлкин '.repeat(7).trim().slice(0, 120)
    expect(name).toHaveLength(120)
    expect((await clients.create({ kind: 'person', name })).name).toBe(name)
  })

  it('updates the fields given, re-derives the search key and clears a field with a blank', async () => {
    const { clients } = await setup()
    const [irina] = (await clients.list({ q: 'елкина' })).items
    const updated = await clients.update(irina!.id, { name: 'Ирина Ёлкина-Ким', phone: '+7 701 000 00 00', address: '' })
    expect(updated).toMatchObject({ name: 'Ирина Ёлкина-Ким', searchName: 'ирина елкина-ким', address: null, kind: 'person' })
    expect(names(await clients.list({ q: 'елкина-ким' }))).toEqual(['Ирина Ёлкина-Ким'])
  })
})

describe('clients.get (AC 4)', () => {
  it('returns the client with their documents: number, status and amount, newest first', async () => {
    const { clients } = await setup()
    const [kairat] = (await clients.list({ q: 'қайрат' })).items
    const detail = await clients.get(kairat!.id)
    const expected = seed.documents.filter((d) => d.clientId === kairat!.id)
    expect(detail.documents.length).toBe(expected.length)
    expect(detail.documents.length).toBeGreaterThan(0)
    for (const doc of detail.documents) {
      expect(doc.clientId).toBe(kairat!.id)
      expect(doc.clientName).toBe('Қайрат Әбілқасымов')
    }
    const dates = detail.documents.map((d) => d.issueDate)
    expect(dates).toEqual([...dates].sort().reverse())
    const invoices = detail.documents.filter((d) => d.type === 'invoice')
    expect(invoices.map((d) => d.number).sort()).toEqual(['СЧ-2026-0001', 'СЧ-2026-0003'])
    for (const invoice of invoices) expect(invoice.payment).not.toBeNull()
    expect(detail.documents.filter((d) => d.type !== 'invoice').every((d) => d.payment === null)).toBe(true)
  })

  it('returns an empty document list for a client without documents', async () => {
    const { clients } = await setup()
    const created = await clients.create({ kind: 'person', name: 'Новый' })
    expect((await clients.get(created.id)).documents).toEqual([])
  })
})

describe('clients.remove: delete or archive (AC 3)', () => {
  it('deletes a client without documents for good', async () => {
    const { clients } = await setup()
    const created = await clients.create({ kind: 'person', name: 'Ұлжан Төлеуғали' })
    await clients.remove(created.id)
    expect(names(await clients.list({ q: 'ұлжан' }))).toEqual([])
    expect(names(await clients.list({ q: 'ұлжан', archived: true }))).toEqual([])
    expect((await rejection(clients.get(created.id))).code).toBe('not_found')
  })

  it('archives a client with documents: hidden by default, shown with the archive filter', async () => {
    const { clients, store } = await setup()
    const [kairat] = (await clients.list({ q: 'қайрат' })).items
    const documents = store.readAll((d) => d.documents.length)
    await clients.remove(kairat!.id)
    expect(names(await clients.list())).not.toContain('Қайрат Әбілқасымов')
    expect(names(await clients.list({ archived: true }))).toEqual(['Қайрат Әбілқасымов'])
    expect((await clients.get(kairat!.id)).archivedAt).toBe('2026-10-20T06:00:00.000Z')
    expect(store.readAll((d) => d.documents.length)).toBe(documents)
  })

  it('archiving twice is harmless and keeps the first date', async () => {
    const { clients } = await setup()
    const [kairat] = (await clients.list({ q: 'қайрат' })).items
    await clients.remove(kairat!.id)
    const first = (await clients.get(kairat!.id)).archivedAt
    await clients.remove(kairat!.id)
    expect((await clients.get(kairat!.id)).archivedAt).toBe(first)
  })
})

describe('company scope', () => {
  it('never lists, reads, changes or removes another company’s client: 404', async () => {
    const { clients, store } = await setup(NURLANOV)
    const seitkaliClient = seed.clients.find((c) => c.name === 'Қайрат Әбілқасымов')!
    expect(names(await clients.list())).toEqual(['Айгерім Серікқызы'])
    expect(names(await clients.list({ q: 'қайрат' }))).toEqual([])
    expect((await rejection(clients.get(seitkaliClient.id))).status).toBe(404)
    expect((await rejection(clients.update(seitkaliClient.id, { name: 'X' }))).code).toBe('not_found')
    expect((await rejection(clients.remove(seitkaliClient.id))).code).toBe('not_found')
    expect(store.readAll((d) => d.clients.find((c) => c.id === seitkaliClient.id)?.archivedAt)).toBeNull()
  })

  it('puts a new client in the signed-in company', async () => {
    const { clients } = await setup(NURLANOV)
    const created = await clients.create({ kind: 'person', name: 'Тест' })
    expect(created.companyId).toBe('592a15c4-950b-564d-b1b7-c7752b2ebdce')
  })

  it('needs a signed-in user', async () => {
    const store = createStore({ storage: null })
    const runtime = createMockRuntime({ store, sleep: instant })
    const error = await rejection(createMockServices(() => runtime).clients.list())
    expect(error.code).toBe('unauthorized')
  })
})

describe('forced errors', () => {
  it('fail the next call with the chosen ApiError, then work again', async () => {
    const { clients, injector } = await setup()
    injector.force('rate_limited')
    expect((await rejection(clients.list())).code).toBe('rate_limited')
    expect((await clients.list()).total).toBe(3)
  })
})
