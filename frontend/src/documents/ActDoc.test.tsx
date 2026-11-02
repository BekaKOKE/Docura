import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { amountInWordsVectors } from '../domain/testVectors'
import { ActDoc } from './ActDoc'
import { plainText, referenceQuote, seedDocument, withoutVat } from './fixtures'
import type { RenderableDocument } from './model'

const NB = ' '
const render = (document: RenderableDocument, props: { signatureImageUrl?: string } = {}) =>
  renderToString(<ActDoc document={document} {...props} />)

/** TC-2/TC-3: the reference quote (323 930 ₸) as an act with two work dates and a contract reference. */
const referenceAct = (): RenderableDocument => {
  const quote = referenceQuote()
  return {
    ...quote,
    number: 'АВР-2026-0003',
    issueDate: '2026-10-20',
    validUntil: null,
    contractRef: 'Договор № 15 от 01.10.2026',
    periodFrom: '2026-10-15',
    periodTo: '2026-10-18',
    lines: quote.lines.map((line, index) => ({ ...line, workDate: index === 0 ? '2026-10-15' : '2026-10-18' })),
  }
}

describe('ActDoc: the Р-1 layout (AC 3, TC-3)', () => {
  const html = render(referenceAct())
  const text = plainText(html)

  it('names the act and numbers it, with the date it was drawn up', () => {
    expect(text).toContain('Акт выполненных работ (оказанных услуг)* № АВР-2026-0003')
    expect(text).toContain('от 20.10.2026')
  })

  it('prints the contract and the reporting period', () => {
    expect(text).toContain('Договор (контракт): Договор № 15 от 01.10.2026')
    expect(text).toContain('Отчётный период: с 15.10.2026 по 18.10.2026')
  })

  it('puts the customer first and the executor second, as form Р-1 does', () => {
    expect(text.indexOf('Заказчик')).toBeGreaterThan(-1)
    expect(text.indexOf('Заказчик')).toBeLessThan(text.indexOf('Исполнитель'))
    expect(text).toContain('Исполнитель ИП Сейткали Б. ИИН 850312300121')
  })

  it('has the columns of the form in order: №, name, date, report, unit, quantity, price, cost', () => {
    const head = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'))
    const columns = [...head.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1])
    expect(columns).toEqual([
      'Выполнено работ (оказано услуг)',
      'Номер по порядку',
      'Наименование работ (услуг) (в разрезе их подвидов в соответствии с технической спецификацией, заданием, графиком выполнения работ (услуг) при их наличии)',
      'Дата выполнения работ (оказания услуг)**',
      'Сведения об отчете о научных исследованиях, маркетинговых, консультационных и прочих услугах (дата, номер, количество страниц) (при их наличии)***',
      'Единица измерения',
      'количество',
      'цена за единицу',
      'стоимость',
      ...['1', '2', '3', '4', '5', '6', '7', '8'],
    ])
    expect(head).toContain('colSpan="3"')
    // Chrome stretches the rows of a table with a rowSpan in its header, and the totals then lie over the lines.
    expect(head).not.toContain('rowSpan')
  })

  it('gives each line its work date, quantity, unit, price and cost before VAT', () => {
    const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
    const rows = [...body.matchAll(/<tr>(.*?)<\/tr>/g)].map((m) => plainText(m[1]!))
    expect(rows[0]).toBe(`1 Укладка ламината 15.10.2026 — м² 12,5 18${NB}500,00${NB}₸ тенге 231${NB}250,00${NB}₸ тенге`)
    expect(rows[1]).toBe(`2 Плинтус, монтаж 18.10.2026 — п.м. 32 1${NB}500,00${NB}₸ тенге 48${NB}000,00${NB}₸ тенге`)
  })

  it('keeps the lines of the form Docura has no data for, to fill in by hand', () => {
    expect(text).toContain('Сведения об использовании запасов, полученных от заказчика (наименование, количество, стоимость):')
    expect(text).toContain('Приложение: Перечень документации, в том числе отчет(ы) о маркетинговых, научных исследованиях, консультационных и прочих услугах (обязательны при его (их) наличии) на страниц')
    expect(text.indexOf('Приложение')).toBeLessThan(text.indexOf('Сдал (Исполнитель)'))
  })

  it('goes smaller only for an amount of 100 million tenge or more', () => {
    expect(html).not.toContain('data-wide')
    const doc = referenceAct()
    const big = { ...doc, netTiyn: undefined, vatTiyn: undefined, grossTiyn: undefined, lines: doc.lines.map((line) => ({ ...line, qtyMilli: 1000, unitPriceTiyn: 10_000_000_000 })) }
    expect(render(big)).toContain('data-wide="true"')
  })

  it('carries the three footnotes of the form', () => {
    expect(text).toContain('*Применяется для приемки-передачи выполненных работ (оказанных услуг), за исключением строительно-монтажных работ.')
    expect(text).toContain('**Заполняется в случае, если даты выполненных работ (оказанных услуг) приходятся на различные периоды')
    expect(text).toContain('***Заполняется в случае наличия отчета о научных исследованиях')
  })

  it('shows the total and the total in words', () => {
    expect(text).toContain(`Без НДС 279${NB}250,00${NB}₸`)
    expect(text).toContain(`НДС 16 % 44${NB}680,00${NB}₸`)
    expect(text).toContain(`Итого 323${NB}930,00${NB}₸`)
    expect(text).toContain(`Всего наименований 2, на сумму 323${NB}930,00${NB}₸`)
    expect(text).toContain('Сумма прописью: Триста двадцать три тысячи девятьсот тридцать тенге 00 тиын')
  })

  it('has the Сдал / Принял blocks with lines for the signatures, the stamp and the signing date', () => {
    expect(text).toContain('Сдал (Исполнитель)')
    expect(text).toContain('Принял (Заказчик)')
    expect(text.indexOf('Сдал (Исполнитель)')).toBeLessThan(text.indexOf('Принял (Заказчик)'))
    expect(html.match(/class="act-sign-row"/g)).toHaveLength(6)
    expect(html.match(/>должность</g)).toHaveLength(2)
    expect(html.match(/>подпись</g)).toHaveLength(2)
    expect(html.match(/>расшифровка подписи</g)).toHaveLength(2)
    expect(html.match(/>М\.П\.</g)).toHaveLength(2)
    expect(text).toContain('Дата подписания (принятия) работ (услуг):')
    // The executor's position and name are filled in, the customer writes theirs by hand.
    expect(text).toContain('Индивидуальный предприниматель')
    expect(text).toContain('Сейткали Бекзат')
  })
})

describe('ActDoc: amounts, numbers and dates never wrap', () => {
  const html = render(referenceAct())

  it('wraps every amount in dc-money, the number in dc-code and the dates in doc-nowrap', () => {
    // 2 lines x (price + cost), 3 totals rows and the amount of the "всего наименований" line.
    expect(html.match(/class="dc-money"/g)?.length).toBe(8)
    expect(html).toContain('<span class="dc-code">АВР-2026-0003</span>')
    expect(html).toContain('<span class="doc-nowrap">15.10.2026</span>')
    expect(html).toContain('<span class="doc-nowrap">18.10.2026</span>')
  })

  it('has no amount without tiyn', () => {
    const amounts = plainText(html).match(new RegExp(`\\d[\\d${NB}]*(?:,\\d+)?${NB}₸`, 'g')) ?? []
    expect(amounts.length).toBe(8)
    for (const amount of amounts) expect(amount, amount).toMatch(new RegExp(`,\\d\\d${NB}₸$`))
  })
})

describe('ActDoc: Kazakh letters, the tenge sign and a company without VAT (TC-4, TC-5)', () => {
  it('keeps the characters as they are stored', () => {
    const text = plainText(render(seedDocument('АВР-2026-0001')))
    for (const letter of ['Қ', 'Ә', 'қ', 'ы']) expect(text, letter).toContain(letter)
    expect(text).toContain('Қайрат Әбілқасымов')
    expect(text).toContain(`${NB}₸`)
  })

  it('prints "Без НДС" when the VAT is off', () => {
    const text = plainText(render(withoutVat(referenceAct())))
    expect(text).toContain('НДС Без НДС')
    expect(text).toContain(`Итого 279${NB}250,00${NB}₸`)
    expect(text).not.toContain('НДС 16')
  })

  it('prints all 20 lines', () => {
    const doc = referenceAct()
    const lines = Array.from({ length: 20 }, (_, i) => ({ ...doc.lines[0]!, title: `Работа ${i + 1}` }))
    const html = render({ ...doc, lines })
    const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
    expect(body.match(/<tr>/g)?.length).toBe(20)
    for (let i = 1; i <= 20; i += 1) expect(body).toContain(`Работа ${i}<`)
  })
})

describe('ActDoc: the seed act and the total in words follow the shared vectors', () => {
  it('draws АВР-2026-0001 with its dates and total', () => {
    const text = plainText(render(seedDocument('АВР-2026-0001')))
    expect(text).toContain('№ АВР-2026-0001')
    expect(text).toContain('Договор (контракт): КП № КП-2026-0004 от 05.10.2026')
    expect(text).toContain('Отчётный период: с 07.10.2026 по 07.10.2026')
    expect(text).toContain(`Итого 45${NB}240,00${NB}₸`)
    expect(text).toContain('Сорок пять тысяч двести сорок тенге 00 тиын')
  })

  const base = referenceAct()
  it.each(amountInWordsVectors.cases.map((c) => [c.id, c] as const))('%s', (_id, vector) => {
    const doc: RenderableDocument = {
      ...base,
      vatEnabled: false,
      lines: [{ title: 'Работа', unit: 'услуга', qtyMilli: 1000, unitPriceTiyn: vector.amountTiyn, netTiyn: vector.amountTiyn, vatTiyn: 0, grossTiyn: vector.amountTiyn, workDate: '2026-10-15' }],
      netTiyn: undefined,
      vatTiyn: undefined,
      grossTiyn: undefined,
    }
    expect(plainText(render(doc))).toContain(`Сумма прописью: ${vector.expected}`)
  })
})

describe('ActDoc: a draft', () => {
  it('marks a draft with no number and leaves a dash where a work date is missing', () => {
    const doc = referenceAct()
    const draft = { ...doc, number: null, lines: doc.lines.map((line) => ({ ...line, workDate: null })) }
    const text = plainText(render(draft))
    expect(text).toContain('Акт выполненных работ (оказанных услуг)* (черновик)')
    expect(text).toContain(`Укладка ламината — — м²`)
  })

  it('leaves out the period and the contract line when there are none', () => {
    const text = plainText(render({ ...referenceAct(), periodFrom: null, periodTo: null, contractRef: null }))
    expect(text).not.toContain('Отчётный период')
    expect(text).not.toContain('Договор (контракт)')
  })
})

describe('ActDoc: wording about signatures (spec §7)', () => {
  it('has no claim of legal force and no on-screen signature of the client in the MVP', () => {
    const text = plainText(render(referenceAct())).toLowerCase()
    for (const banned of ['юридически значим', 'юридическую силу', 'эцп', 'legally binding', 'подписано на экране']) {
      expect(text, banned).not.toContain(banned)
    }
  })

  it('calls a signature record "Подпись на экране" when one is given', () => {
    const signed: RenderableDocument = {
      ...referenceAct(),
      signature: { method: 'drawn', signerName: 'Әсел Нұрланқызы', signedAt: '2026-10-19T09:05:00Z', documentVersion: 2 },
    }
    const text = plainText(render(signed))
    expect(text).toContain('Подпись на экране')
    expect(text).toContain('Подписано на экране 19.10.2026 в 14:05 · Әсел Нұрланқызы')
    for (const banned of ['юридически значим', 'юридическую силу', 'эцп', 'legally binding']) {
      expect(text.toLowerCase(), banned).not.toContain(banned)
    }
  })
})

describe('ActDoc.css', () => {
  const css = readFileSync(new URL('./ActDoc.css', import.meta.url), 'utf8')
  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })
})
