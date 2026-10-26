import { describe, expect, it } from 'vitest'
import seedRaw from '../../../contracts/fixtures/seed.json?raw'
import typesSource from './types.ts?raw'
import type { Article, Client, Company, ConvertInput, Document, Payment } from './types'

// #11 AC 5: camelCase, money fields end in `Tiyn` and are integers, dates are `YYYY-MM-DD` strings.

interface Prop {
  name: string
  type: string
}

/** Every `name?: type` property line of types.ts. */
const props: Prop[] = [...typesSource.matchAll(/^ {2}(?:readonly )?(\w+)\??: (.+)$/gm)].map((m) => ({
  name: m[1]!,
  type: m[2]!.trim(),
}))

const seed = JSON.parse(seedRaw) as Record<string, Record<string, unknown>[]>
const propNames = new Set(props.map((p) => p.name))

describe('types.ts conventions', () => {
  it('declares properties', () => {
    expect(props.length).toBeGreaterThan(100)
  })

  it('uses camelCase only', () => {
    for (const p of props) expect(p.name, p.name).toMatch(/^[a-z][a-zA-Z0-9]*$/)
  })

  it('ends every money field in Tiyn, typed as integer tiyn', () => {
    const money = props.filter((p) => /Tiyn$/.test(p.name))
    expect(money.length).toBeGreaterThan(10)
    for (const p of money) expect(p.type, p.name).toMatch(/^(Tiyn|number)( \| null)?$/)
  })

  it('types quantities as thousandths and rates as basis points', () => {
    expect(props.filter((p) => /^qty/.test(p.name)).map((p) => p.name)).toEqual(['qtyMilli', 'qtyMilli'])
    for (const p of props.filter((p) => /Bp$/.test(p.name))) expect(p.type, p.name).toMatch(/^(BasisPoints|number)/)
  })

  it('types dates as IsoDate strings and timestamps as IsoTimestamp strings', () => {
    const dates = props.filter((p) => /(Date|Until|From|To|paidOn|Day)$|^(from|to)$/.test(p.name) && p.name !== 'documentType')
    expect(dates.length).toBeGreaterThan(8)
    for (const p of dates) expect(p.type, p.name).toMatch(/^IsoDate( \| null)?$/)
    for (const p of props.filter((p) => /(At|^at)$/.test(p.name))) expect(p.type, p.name).toMatch(/^IsoTimestamp( \| null)?$/)
  })

  it('has no float or Date types', () => {
    expect(typesSource).not.toMatch(/:\s*Date\b/)
    expect(typesSource).not.toMatch(/\bbigint\b|\bdecimal\b/i)
  })
})

describe('types.ts against contracts/fixtures/seed.json', () => {
  // Fields of the seed that are not wire fields of the type on purpose.
  const NOT_ON_THE_WIRE: Record<string, string[]> = {
    // The text the user typed in the quantity box; the schema stores only qty_milli.
    lines: ['qtyText'],
  }

  function checkKeys(label: string, rows: Record<string, unknown>[]) {
    const keys = new Set(rows.flatMap((r) => Object.keys(r)))
    const skip = NOT_ON_THE_WIRE[label] ?? []
    for (const key of keys) {
      if (skip.includes(key)) continue
      expect(propNames.has(key), `${label}.${key} is in the seed but not in types.ts`).toBe(true)
    }
  }

  it('knows every field of the seed companies, clients, articles, documents, lines and payments', () => {
    checkKeys('companies', seed.companies!)
    checkKeys('clients', seed.clients!)
    checkKeys('articles', seed.articles!)
    checkKeys('payments', seed.payments!)
    const documents = seed.documents! as (Record<string, unknown> & { lines: Record<string, unknown>[] })[]
    checkKeys('documents', documents)
    checkKeys('lines', documents.flatMap((d) => d.lines))
  })

  it('holds integer tiyn, thousandths and basis points in the seed', () => {
    const documents = seed.documents! as (Record<string, unknown> & { lines: Record<string, unknown>[] })[]
    for (const row of [...documents, ...documents.flatMap((d) => d.lines), ...seed.payments!, ...seed.articles!]) {
      for (const [key, value] of Object.entries(row)) {
        if (/Tiyn$|Milli$|Bp$/.test(key)) expect(Number.isInteger(value), key).toBe(true)
      }
    }
  })

  it('writes dates as YYYY-MM-DD', () => {
    const documents = seed.documents! as Record<string, unknown>[]
    for (const d of documents) {
      for (const key of ['issueDate', 'validUntil', 'dueDate', 'periodFrom', 'periodTo']) {
        const value = d[key]
        if (value !== null && value !== undefined) expect(value, key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })
})

describe('sample values typecheck', () => {
  it('accepts shapes taken from the seed', () => {
    const company: Company = {
      id: 'e3bc7ccf-e8aa-599e-b602-fdd8495bc378',
      legalForm: 'ip',
      legalName: 'ИП Сейткали Б.',
      binIin: '850312300121',
      address: 'г. Алматы, ул. Сәтбаев, 22',
      phone: '+7 701 555 12 34',
      email: 'seitkali@example.kz',
      directorName: 'Сейткали Бекзат',
      directorPosition: 'Индивидуальный предприниматель',
      vatPayer: true,
      bankName: 'АО «Тест Банк»',
      iik: 'KZ75998KZT1001300335',
      bik: 'DCRAKZKA',
      kbe: '19',
      defaultKnp: '859',
      timezone: 'Asia/Almaty',
      quoteValidityDays: 14,
      invoiceDueDays: 5,
      currency: 'KZT',
      hasLogo: false,
    }
    const client: Client = {
      id: 'd653011a-9b58-568d-8bcc-316e728a4458',
      companyId: company.id,
      kind: 'person',
      name: 'Қайрат Әбілқасымов',
      binIin: '880715301453',
      phone: '+7 701 123 45 67',
      email: 'kairat@example.kz',
      address: 'г. Алматы, мкр. Самал-2, 58, кв. 14',
      searchName: 'қайрат әбілқасымов',
      archivedAt: null,
    }
    const article: Article = {
      id: '3bd7df08-b7be-5805-a321-b50a26253f7c',
      companyId: company.id,
      kind: 'service',
      title: 'Укладка ламината',
      searchTitle: 'укладка ламината',
      unit: 'м²',
      unitPriceTiyn: 1850000,
      archivedAt: null,
    }
    const payment: Payment = {
      id: 'cddcad39-2138-57db-926e-081242594001',
      companyId: company.id,
      documentId: '8cdf26d1-d44e-5fb6-b3dd-b7c8da28465e',
      amountTiyn: 4524000,
      currency: 'KZT',
      method: 'cash',
      paidOn: '2026-10-07',
      note: 'Оплата наличными на объекте',
    }
    const quote: Document = {
      id: '04450fe3-60be-5173-a95b-d7b95c95c158',
      companyId: company.id,
      type: 'quote',
      status: 'sent',
      number: 'КП-2026-0001',
      issueDate: '2026-10-15',
      validUntil: '2027-06-30',
      dueDate: null,
      periodFrom: null,
      periodTo: null,
      contractRef: null,
      clientId: client.id,
      clientName: client.name,
      clientSnapshot: {
        kind: 'person',
        name: client.name,
        binIin: client.binIin,
        phone: client.phone,
        email: client.email,
        address: client.address,
      },
      companySnapshot: {
        legalForm: company.legalForm,
        legalName: company.legalName,
        binIin: company.binIin,
        address: company.address,
        phone: company.phone,
        directorName: company.directorName,
        directorPosition: company.directorPosition,
        vatPayer: company.vatPayer,
        bankName: company.bankName,
        iik: company.iik,
        bik: company.bik,
        kbe: company.kbe,
      },
      sourceDocumentId: null,
      basis: null,
      basisValue: null,
      vatEnabled: true,
      vatRateBp: 1600,
      currency: 'KZT',
      netTiyn: 27925000,
      vatTiyn: 4468000,
      grossTiyn: 32393000,
      notes: null,
      terms: null,
      version: 1,
      issuedAt: '2026-10-15T06:20:00Z',
      signedAt: null,
      cancelledAt: null,
      isExpired: false,
      payment: null,
      shareUrl: null,
      signature: null,
      children: [],
      lines: [
        {
          id: '308e12be-2d72-56f2-bf99-eba111b2147c',
          position: 0,
          articleId: article.id,
          kind: 'service',
          title: article.title,
          unit: article.unit,
          qtyMilli: 12500,
          unitPriceTiyn: article.unitPriceTiyn,
          discountBp: 0,
          netTiyn: 23125000,
          vatTiyn: 3700000,
          grossTiyn: 26825000,
        },
      ],
    }
    expect(quote.lines[0]!.netTiyn + quote.lines[0]!.vatTiyn).toBe(quote.lines[0]!.grossTiyn)
    expect(payment.amountTiyn).toBe(4524000)
  })

  it('types the four ways to invoice a quote', () => {
    const requestId = '6d1d1f0e-8d0a-4f6b-9a2e-1b2c3d4e5f60'
    const inputs: ConvertInput[] = [
      { target: 'act', clientRequestId: requestId },
      { target: 'invoice', basis: 'full', clientRequestId: requestId, issue: true },
      { target: 'invoice', basis: 'percent', basisValue: 5000, clientRequestId: requestId },
      { target: 'invoice', basis: 'amount', basisValue: 10000000, clientRequestId: requestId },
      { target: 'invoice', basis: 'remaining', clientRequestId: requestId },
    ]
    expect(inputs).toHaveLength(5)
    // @ts-expect-error a percent invoice needs its value
    const bad: ConvertInput = { target: 'invoice', basis: 'percent', clientRequestId: requestId }
    expect(bad.target).toBe('invoice')
  })
})
