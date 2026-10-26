import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { amountInWordsVectors } from '../domain/testVectors'
import { InvoiceDoc } from './InvoiceDoc'
import { plainText, seedDocument, withoutVat } from './fixtures'
import type { RenderableDocument } from './model'

const NB = ' '
const render = (document: RenderableDocument) => renderToString(<InvoiceDoc document={document} />)

describe('InvoiceDoc: a prepayment invoice (#21 AC 2, TC-2)', () => {
  const invoice = seedDocument('СЧ-2026-0002')
  const html = render(invoice)
  const text = plainText(html)

  it('names the document and the due date as dd.mm.yyyy', () => {
    expect(text).toContain('Счёт на оплату № СЧ-2026-0002')
    expect(text).toContain('от 03.10.2026')
    expect(text).toContain('Оплатить до 30.06.2027')
  })

  it('carries the beneficiary requisites: ИИК, БИК, Кбе, КНП', () => {
    expect(text).toContain('Бенефициар ИП Сейткали Б. ИИН 850312300121')
    expect(text).toContain('ИИК KZ75998KZT1001300335')
    expect(text).toContain('Кбе 19')
    expect(text).toContain('Банк бенефициара АО «Тест Банк»')
    expect(text).toContain('БИК DCRAKZKA')
    expect(text).toContain('КНП 859')
  })

  it('prints the prepayment line and what the invoice was made from', () => {
    expect(text).toContain('Предоплата 50% по КП № КП-2026-0002 от 02.10.2026')
    expect(text).toContain('Основание: КП № КП-2026-0002 от 02.10.2026')
  })

  it('names the supplier and the buyer', () => {
    expect(text).toContain('Поставщик ИП Сейткали Б.')
    expect(text).toContain('Покупатель ТОО «Алатау Құрылыс Сервис» БИН 080540001238')
  })

  it('shows the saved totals to the tiyn and the total in words', () => {
    expect(text).toContain(`Без НДС 578${NB}500,00${NB}₸`)
    expect(text).toContain(`НДС 16 % 92${NB}560,00${NB}₸`)
    expect(text).toContain(`Итого 671${NB}060,00${NB}₸`)
    expect(text).toContain(`Всего наименований 1, на сумму 671${NB}060,00${NB}₸`)
    expect(text).toContain('Сумма прописью: Шестьсот семьдесят одна тысяча шестьдесят тенге 00 тиын')
  })

  it('keeps the document numbers inside the prepayment line whole', () => {
    expect(html).toContain('<span class="dc-code">КП-2026-0002</span>')
    expect(html).toContain('<span class="doc-nowrap">02.10.2026</span>')
  })
})

describe('InvoiceDoc: the total in words follows the shared vectors', () => {
  const base = seedDocument('СЧ-2026-0001')
  it.each(amountInWordsVectors.cases.map((c) => [c.id, c] as const))('%s', (_id, vector) => {
    const doc: RenderableDocument = {
      ...base,
      vatEnabled: false,
      lines: [{ title: 'Работа', unit: 'услуга', qtyMilli: 1000, unitPriceTiyn: vector.amountTiyn, netTiyn: vector.amountTiyn, vatTiyn: 0, grossTiyn: vector.amountTiyn }],
      netTiyn: undefined,
      vatTiyn: undefined,
      grossTiyn: undefined,
    }
    expect(plainText(render(doc))).toContain(`Сумма прописью: ${vector.expected}`)
  })
})

describe('InvoiceDoc: a full invoice and a company without VAT', () => {
  it('lists the lines of the quote and writes zero tiyn as "00 тиын"', () => {
    const text = plainText(render(seedDocument('СЧ-2026-0001')))
    expect(text).toContain('Замена смесителя')
    expect(text).toContain('Вывоз строительного мусора')
    expect(text).toContain(`Итого 45${NB}240,00${NB}₸`)
    expect(text).toContain('Сорок пять тысяч двести сорок тенге 00 тиын')
  })

  it('prints "Без НДС" when the VAT is off', () => {
    const text = plainText(render(withoutVat(seedDocument('СЧ-2026-0001'))))
    expect(text).toContain('НДС Без НДС')
    expect(text).toContain(`Итого 39${NB}000,00${NB}₸`)
    expect(text).not.toContain('НДС 16')
  })

  it('shows a dash for a requisite the company has not filled in yet', () => {
    const invoice = seedDocument('СЧ-2026-0001')
    const bare = { ...invoice, companySnapshot: { ...invoice.companySnapshot, iik: null, bik: null, bankName: null } }
    const text = plainText(render(bare))
    expect(text).toContain('ИИК —')
    expect(text).toContain('БИК —')
    expect(text).toContain('Банк бенефициара —')
  })

  it('has no claim of legal force and no signature of the client', () => {
    const text = plainText(render(seedDocument('СЧ-2026-0001'))).toLowerCase()
    for (const banned of ['юридически значим', 'юридическую силу', 'эцп', 'legally binding']) {
      expect(text, banned).not.toContain(banned)
    }
    expect(text).not.toContain('подписано на экране')
  })
})
