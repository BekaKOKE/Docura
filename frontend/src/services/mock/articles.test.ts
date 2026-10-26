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
const NOW = new Date(Date.UTC(2026, 9, 20, 6, 0, 0))

async function setup(login = SEITKALI) {
  const store = createStore({ storage: null })
  const injector = createErrorInjector()
  const runtime = createMockRuntime({ store, injector, sleep: instant, now: () => NOW })
  const services = createMockServices(() => runtime)
  await services.auth.login(login)
  return { store, injector, services, articles: services.articles }
}

const titles = (page: { items: { title: string }[] }) => page.items.map((a) => a.title)
const rejection = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the call to fail')
}

const LAMINATE = { kind: 'service', title: 'Укладка ламината', unit: 'м²', unitPriceTiyn: 1850000 } as const

describe('articles.list: search (AC 1)', () => {
  it('lists the active items of the company, by title', async () => {
    const { articles } = await setup()
    const page = await articles.list()
    expect(page.total).toBe(8)
    expect(titles(page)).toEqual([
      'Вывоз строительного мусора',
      'Демонтаж напольного покрытия',
      'Замена смесителя',
      'Ламинат 33 класс',
      'Плинтус, монтаж',
      'Подложка 3 мм',
      'Укладка ламината',
      'Штукатурка стен',
    ])
  })

  it('finds «Укладка ламината» by «ламинат» in any case (TC-1)', async () => {
    const { articles } = await setup()
    expect(titles(await articles.list({ q: 'ламинат' }))).toEqual(['Ламинат 33 класс', 'Укладка ламината'])
    expect(titles(await articles.list({ q: 'УКЛАДКА' }))).toEqual(['Укладка ламината'])
    expect(titles(await articles.list({ q: '  плинтус  ' }))).toEqual(['Плинтус, монтаж'])
  })

  it('treats ё as е and keeps Kazakh letters as typed', async () => {
    const { articles } = await setup()
    await articles.create({ kind: 'service', title: 'Қабырғаны сылау', unit: 'м²', unitPriceTiyn: 300000 })
    await articles.create({ kind: 'material', title: 'Ёмкость 20 л', unit: 'шт', unitPriceTiyn: 250000 })
    expect(titles(await articles.list({ q: 'қабырғаны' }))).toEqual(['Қабырғаны сылау'])
    expect((await articles.list({ q: 'кабырганы' })).items).toEqual([])
    expect(titles(await articles.list({ q: 'емкость' }))).toEqual(['Ёмкость 20 л'])
    expect(titles(await articles.list({ q: 'ЁМКОСТЬ' }))).toEqual(['Ёмкость 20 л'])
  })

  it('filters by kind', async () => {
    const { articles } = await setup()
    expect(titles(await articles.list({ kind: 'material' }))).toEqual(['Ламинат 33 класс', 'Подложка 3 мм'])
    expect((await articles.list({ kind: 'service' })).total).toBe(6)
  })

  it('pages the result and counts every match in total', async () => {
    const { articles } = await setup()
    const page = await articles.list({ limit: 3, offset: 2 })
    expect(page.total).toBe(8)
    expect(page.items).toHaveLength(3)
    expect((await articles.list({ limit: 3, offset: 6 })).items).toHaveLength(2)
    expect((await articles.list({ limit: 3, offset: 20 })).items).toEqual([])
  })

  it('returns the wire shape, not the stored row', async () => {
    const { articles } = await setup()
    const [first] = (await articles.list({ q: 'смесител' })).items
    expect(first).toEqual({
      id: expect.any(String),
      companyId: expect.any(String),
      kind: 'service',
      title: 'Замена смесителя',
      searchTitle: 'замена смесителя',
      description: null,
      unit: 'шт',
      unitPriceTiyn: 1200000,
      archivedAt: null,
    })
  })
})

describe('articles.create and update (AC 1, 3)', () => {
  it('creates «Укладка ламината» as a work in м² at 18 500 ₸ and stores integer tiyn (TC-1, TC-3)', async () => {
    const { articles, store } = await setup()
    const made = await articles.create({ ...LAMINATE, title: 'Укладка ламината (новая)' })
    expect(made).toMatchObject({ kind: 'service', unit: 'м²', unitPriceTiyn: 1850000, archivedAt: null })
    expect(made.searchTitle).toBe('укладка ламината (новая)')
    expect(store.read((db) => db.get('articles', made.id)).unitPriceTiyn).toBe(1850000)
    expect(titles(await articles.list({ q: 'новая' }))).toEqual(['Укладка ламината (новая)'])
  })

  it('trims the title and stores a blank description as null', async () => {
    const { articles } = await setup()
    const made = await articles.create({ ...LAMINATE, title: '  Грунтовка  ', description: '   ' })
    expect(made.title).toBe('Грунтовка')
    expect(made.description).toBeNull()
  })

  it('changes the price on update and keeps the rest (TC-1: 18 500 → 19 000)', async () => {
    const { articles } = await setup()
    const [item] = (await articles.list({ q: 'укладка' })).items
    const changed = await articles.update(item.id, { unitPriceTiyn: 1900000 })
    expect(changed).toMatchObject({ id: item.id, title: 'Укладка ламината', unit: 'м²', unitPriceTiyn: 1900000 })
    expect((await articles.list({ q: 'укладка' })).items[0].unitPriceTiyn).toBe(1900000)
  })

  it('keeps the search title in step with a renamed item', async () => {
    const { articles } = await setup()
    const [item] = (await articles.list({ q: 'подложка' })).items
    await articles.update(item.id, { title: 'Ёлочная подложка' })
    expect(titles(await articles.list({ q: 'елочная' }))).toEqual(['Ёлочная подложка'])
    expect((await articles.list({ q: 'подложка 3' })).items).toEqual([])
  })

  it('offers exactly the twelve units and rejects any other (AC 2)', async () => {
    const { articles } = await setup()
    for (const unit of ['шт', 'м', 'м²', 'м³', 'п.м.', 'кг', 'т', 'л', 'ч', 'смена', 'компл.', 'услуга']) {
      await expect(articles.create({ ...LAMINATE, title: `Позиция ${unit}`, unit })).resolves.toMatchObject({ unit })
    }
    const error = await rejection(articles.create({ ...LAMINATE, unit: 'пачка' }))
    expect(error.code).toBe('validation_error')
    expect(error.fields).toEqual({ unit: 'Выберите единицу измерения' })
  })

  it('reports each bad field in Russian', async () => {
    const { articles } = await setup()
    const error = await rejection(
      articles.create({ kind: 'service', title: '   ', unit: 'шт', unitPriceTiyn: -10000 }),
    )
    expect(error.code).toBe('validation_error')
    expect(error.fields).toEqual({
      title: 'Укажите название',
      unitPriceTiyn: 'Цена не может быть отрицательной',
    })
    const fraction = await rejection(articles.create({ ...LAMINATE, unitPriceTiyn: 1850.5 }))
    expect(fraction.fields).toHaveProperty('unitPriceTiyn')
  })

  it('rejects a title over 300 characters and accepts 300', async () => {
    const { articles } = await setup()
    await expect(articles.create({ ...LAMINATE, title: 'а'.repeat(300) })).resolves.toBeDefined()
    expect((await rejection(articles.create({ ...LAMINATE, title: 'а'.repeat(301) }))).fields).toEqual({
      title: 'Не больше 300 знаков',
    })
  })

  it('allows a price of zero', async () => {
    const { articles } = await setup()
    await expect(articles.create({ ...LAMINATE, title: 'Консультация', unitPriceTiyn: 0 })).resolves.toMatchObject({
      unitPriceTiyn: 0,
    })
  })

  it('does not change the item when the update is invalid', async () => {
    const { articles } = await setup()
    const [item] = (await articles.list({ q: 'смесител' })).items
    await rejection(articles.update(item.id, { unitPriceTiyn: -1 }))
    expect((await articles.list({ q: 'смесител' })).items[0].unitPriceTiyn).toBe(1200000)
  })
})

describe('articles.remove archives, never deletes (AC 1, 4)', () => {
  it('drops the item from the list and keeps the row with archivedAt set (TC-1)', async () => {
    const { articles, store } = await setup()
    const [item] = (await articles.list({ q: 'укладка' })).items
    await articles.remove(item.id)
    expect((await articles.list({ q: 'укладка' })).items).toEqual([])
    expect((await articles.list()).total).toBe(7)
    const row = store.read((db) => db.get('articles', item.id))
    expect(row.archivedAt).toBe(NOW.toISOString())
    expect(row.title).toBe('Укладка ламината')
  })

  it('archiving twice keeps the first date and is not an error', async () => {
    const { articles, store } = await setup()
    const [item] = (await articles.list({ q: 'плинтус' })).items
    await articles.remove(item.id)
    await expect(articles.remove(item.id)).resolves.toBeUndefined()
    expect(store.read((db) => db.get('articles', item.id)).archivedAt).toBe(NOW.toISOString())
  })

  it('leaves the lines of existing documents as they were copied (TC-4)', async () => {
    const { articles, services } = await setup()
    const documents = await services.documents.list({ type: 'quote' })
    const quote = documents.items.find((doc) => doc.number === 'КП-2026-0004')
    expect(quote).toBeDefined()
    const before = await services.documents.get(quote!.id)
    const mixer = before.lines.find((line) => line.title === 'Замена смесителя')
    expect(mixer).toMatchObject({ unitPriceTiyn: 1200000 })
    const [item] = (await articles.list({ q: 'смесител' })).items
    expect(mixer!.articleId).toBe(item.id)

    await articles.update(item.id, { unitPriceTiyn: 1300000, title: 'Замена смесителя (новая цена)' })
    await articles.remove(item.id)

    const after = await services.documents.get(quote!.id)
    expect(after.lines).toEqual(before.lines)
    expect(after.grossTiyn).toBe(before.grossTiyn)
    expect((await articles.list({ q: 'смесител' })).items).toEqual([])
  })
})

describe('articles are scoped by company', () => {
  it('another company sees none of the items', async () => {
    const { articles } = await setup(NURLANOV)
    expect((await articles.list()).total).toBe(0)
  })

  it('another company’s id is not_found for update and remove, and nothing changes', async () => {
    const { articles, services } = await setup(NURLANOV)
    const foreign = seed.articles[0]
    expect((await rejection(articles.update(foreign.id, { unitPriceTiyn: 1 }))).code).toBe('not_found')
    expect((await rejection(articles.remove(foreign.id))).code).toBe('not_found')
    expect((await rejection(articles.update('00000000-0000-4000-8000-000000000000', { unitPriceTiyn: 1 }))).code).toBe(
      'not_found',
    )
    await services.auth.login(SEITKALI)
    expect((await articles.list()).total).toBe(8)
  })

  it('creates the item in the signed-in company only', async () => {
    const nur = await setup(NURLANOV)
    const made = await nur.articles.create(LAMINATE)
    expect(made.companyId).not.toBe(seed.articles[0].companyId)
    expect(titles(await nur.articles.list())).toEqual(['Укладка ламината'])
  })
})

describe('articles under the dev panel', () => {
  it('fails with the forced error, once, and then works again', async () => {
    const { articles, injector } = await setup()
    injector.force('rate_limited')
    expect((await rejection(articles.list())).code).toBe('rate_limited')
    await expect(articles.list()).resolves.toMatchObject({ total: 8 })
  })
})
