import { describe, expect, it } from 'vitest'
import { createSeedData, DEV_PASSWORD, seed } from './seed'

const SEITKALI = 'e3bc7ccf-e8aa-599e-b602-fdd8495bc378'
const NURLANOV = '592a15c4-950b-564d-b1b7-c7752b2ebdce'

describe('seed', () => {
  it('has the two companies and the dev logins of contracts/README.md', () => {
    expect(seed.companies.map((c) => c.id)).toEqual([SEITKALI, NURLANOV])
    expect(seed.users.map((u) => [u.email, u.companyId])).toEqual([
      ['seitkali@example.kz', SEITKALI],
      ['nurlanov@example.kz', NURLANOV],
    ])
  })

  it('has the clients the test cases look for, with Kazakh letters and ё intact', () => {
    const names = seed.clients.filter((c) => c.companyId === SEITKALI).map((c) => c.name)
    expect(names).toContain('Қайрат Әбілқасымов')
    expect(names).toContain('ТОО «Алатау Құрылыс Сервис»')
    expect(names).toContain('Ирина Ёлкина')
  })

  it('points every row at an existing company, and every id is unique', () => {
    const companyIds = new Set(seed.companies.map((c) => c.id))
    const rows = [
      ...seed.clients,
      ...seed.articles,
      ...seed.documents,
      ...seed.shareLinks,
      ...seed.signatures,
      ...seed.payments,
      ...seed.documentCounters,
    ]
    for (const row of rows) expect(companyIds.has(row.companyId)).toBe(true)
    for (const user of seed.users) expect(user.companyId && companyIds.has(user.companyId)).toBe(true)
    const ids = [...seed.clients, ...seed.articles, ...seed.documents, ...seed.shareLinks, ...seed.payments].map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps each company’s documents on its own clients', () => {
    const clientCompany = new Map(seed.clients.map((c) => [c.id, c.companyId]))
    for (const doc of seed.documents) expect(clientCompany.get(doc.clientId)).toBe(doc.companyId)
  })

  it('keeps money as integer tiyn, with gross = net + VAT', () => {
    for (const doc of seed.documents) {
      for (const value of [doc.netTiyn, doc.vatTiyn, doc.grossTiyn]) expect(Number.isInteger(value)).toBe(true)
      expect(doc.netTiyn + doc.vatTiyn).toBe(doc.grossTiyn)
    }
  })
})

describe('createSeedData', () => {
  it('signs nobody in and gives every seed user the dev password', () => {
    const data = createSeedData()
    expect(data.session).toBeNull()
    expect(data.users.every((u) => u.password === DEV_PASSWORD)).toBe(true)
    expect(data.schemaVersion).toBe(1)
    expect(data.seedVersion).toBe(seed.version)
  })

  it('returns a copy: changing it never changes the seed', () => {
    const data = createSeedData()
    data.clients[0].name = 'Changed'
    data.documents.length = 0
    expect(createSeedData().clients[0].name).not.toBe('Changed')
    expect(createSeedData().documents.length).toBe(seed.documents.length)
  })
})
