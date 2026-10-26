import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { plainText, referenceQuote, seedDocument, withoutVat } from './fixtures'
import type { RenderableDocument } from './model'
import { QuoteDoc } from './QuoteDoc'

const NB = ' '
const render = (document: RenderableDocument, extra: { signatureImageUrl?: string } = {}) =>
  renderToString(<QuoteDoc document={document} {...extra} />)

describe('QuoteDoc: the reference quote (#21 AC 1, TC-1)', () => {
  const html = render(referenceQuote())
  const text = plainText(html)

  it('names the document, its number and its dates', () => {
    expect(text).toContain('Коммерческое предложение № КП-2026-0001')
    expect(text).toContain('от 15.10.2026')
    expect(text).toContain('Действует до 30.06.2027')
  })

  it('prints the executor and the client with their requisites', () => {
    expect(text).toContain('ИП Сейткали Б.')
    expect(text).toContain('ИИН 850312300121')
    expect(text).toContain('г. Алматы, ул. Сәтбаев, 22')
    expect(text).toContain('Қайрат Әбілқасымов')
    expect(text).toContain('ИИН 880715301453')
    expect(text).toContain('+7 701 123 45 67')
  })

  it('lists the lines with quantity, unit, price and sum before VAT', () => {
    expect(text).toContain('Укладка ламината')
    expect(text).toContain(`12,5 м² 18${NB}500,00${NB}₸`)
    expect(text).toContain(`231${NB}250,00${NB}₸`)
    expect(text).toContain('Плинтус, монтаж')
    expect(text).toContain(`48${NB}000,00${NB}₸`)
  })

  it('shows Без НДС / НДС 16 % / Итого to the tiyn', () => {
    expect(text).toContain(`Без НДС 279${NB}250,00${NB}₸`)
    expect(text).toContain(`НДС 16 % 44${NB}680,00${NB}₸`)
    expect(text).toContain(`Итого 323${NB}930,00${NB}₸`)
  })

  it('does not print bank details or an amount in words: those belong to the invoice', () => {
    expect(text).not.toContain('ИИК')
    expect(text).not.toContain('Сумма прописью')
  })
})

describe('QuoteDoc: VAT off', () => {
  const text = plainText(render(withoutVat(referenceQuote())))

  it('prints "Без НДС" and a plain Итого', () => {
    expect(text).toContain('НДС Без НДС')
    expect(text).toContain(`Итого 279${NB}250,00${NB}₸`)
    expect(text).not.toContain('НДС 16')
    expect(text).not.toContain(`44${NB}680`)
  })
})

describe('QuoteDoc: amounts and numbers never wrap (AC 3, TC-3)', () => {
  const html = render(referenceQuote())

  it('wraps every amount in dc-money and the number in dc-code', () => {
    // 2 lines × (price + sum) + 3 totals rows.
    expect(html.match(/class="dc-money"/g)?.length).toBe(7)
    expect(html).toContain('<span class="dc-code">КП-2026-0001</span>')
    expect(html).toContain('<span class="doc-nowrap">15.10.2026</span>')
  })

  it('has no amount without tiyn', () => {
    const amounts = plainText(html).match(new RegExp(`\\d[\\d${NB}]*(?:,\\d+)?${NB}₸`, 'g')) ?? []
    expect(amounts.length).toBe(7)
    for (const amount of amounts) expect(amount, amount).toMatch(new RegExp(`,\\d\\d${NB}₸$`))
  })
})

describe('QuoteDoc: Kazakh letters and ё', () => {
  it('keeps the characters as they are stored', () => {
    const text = plainText(render(referenceQuote()))
    for (const letter of ['Қ', 'Ә', 'ә', 'қ', 'ы']) expect(text, letter).toContain(letter)
    expect(plainText(render(seedDocument('КП-2026-0003')))).toContain('Ирина Ёлкина')
    expect(plainText(render(seedDocument('КП-2026-0002')))).toContain('ТОО «Алатау Құрылыс Сервис»')
  })
})

describe('QuoteDoc: a draft and a long quote', () => {
  it('marks a draft with no number instead of printing an empty one', () => {
    const text = plainText(render({ ...referenceQuote(), number: null }))
    expect(text).toContain('Коммерческое предложение (черновик)')
  })

  it('prints all 25 lines of a long quote (TC-6)', () => {
    const doc = referenceQuote()
    const lines = Array.from({ length: 25 }, (_, i) => ({ ...doc.lines[0], title: `Работа ${i + 1}` }))
    const html = render({ ...doc, lines })
    const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
    expect(body.match(/<tr>/g)?.length).toBe(25)
    for (let i = 1; i <= 25; i += 1) expect(body).toContain(`Работа ${i}<`)
  })

  it('prints the note and the terms when there are any', () => {
    const text = plainText(render({ ...referenceQuote(), notes: 'Материалы заказчика', terms: 'Оплата по факту' }))
    expect(text).toContain('Примечание Материалы заказчика')
    expect(text).toContain('Условия Оплата по факту')
  })
})

describe('QuoteDoc: the signature on screen', () => {
  const signed: RenderableDocument = {
    ...seedDocument('КП-2026-0002'),
    signature: {
      method: 'drawn',
      signerName: 'Әсел Нұрланқызы',
      signedAt: '2026-10-19T09:05:00Z',
      documentVersion: 2,
    },
  }

  it('says "Подписано на экране" with the date and time in the company zone', () => {
    const text = plainText(render(signed))
    expect(text).toContain('Подпись на экране')
    expect(text).toContain('Подписано на экране 19.10.2026 в 14:05 · Әсел Нұрланқызы')
  })

  it('shows the drawn signature when its image is given', () => {
    const html = render(signed, { signatureImageUrl: 'blob:signature' })
    expect(html).toContain('src="blob:signature"')
    expect(html).toContain('alt="Подпись на экране: Әсел Нұрланқызы"')
  })

  it('never claims legal force (spec §7)', () => {
    const everything = plainText(render(signed, { signatureImageUrl: 'blob:signature' }))
    for (const banned of ['юридически значим', 'юридическую силу', 'ЭЦП', 'legally binding']) {
      expect(everything.toLowerCase(), banned).not.toContain(banned.toLowerCase())
    }
  })

  it('has no signature block for the client while the quote is unsigned', () => {
    expect(plainText(render(referenceQuote()))).not.toContain('Подписано на экране')
  })
})
