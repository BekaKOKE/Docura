/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Code, DocDate, DocTitle, Money } from './parts'

// The stylesheet as written (vite's ?raw import of a .css file gives an empty string under vitest).
const cssSource = readFileSync(new URL('./documents.css', import.meta.url), 'utf8')

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

describe('Money', () => {
  it('always shows tiyn on a document, with a no-break space before the tenge sign', () => {
    const html = renderToString(<Money tiyn={32393000} />)
    expect(html).toContain('323 930,00')
    expect(html).toContain(' ₸')
    expect(html).toContain('dc-money')
  })

  it('keeps the zero tiyn of a round amount', () => {
    expect(renderToString(<Money tiyn={100} />)).toContain('1,00')
  })

  it('hides the sign from a screen reader and reads out "тенге" instead', () => {
    const html = renderToString(<Money tiyn={50} />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('doc-sr-only')
    expect(text(html)).toContain('тенге')
  })
})

describe('identifiers and dates', () => {
  it('sets a document number in the mono face, which never wraps', () => {
    const html = renderToString(<Code>КП-2026-0001</Code>)
    expect(html).toContain('dc-code')
    expect(cssSource).toContain('.doc-nowrap')
  })

  it('writes a date as dd.mm.yyyy on one line', () => {
    const html = renderToString(<DocDate date="2026-10-15" />)
    expect(html).toContain('doc-nowrap')
    expect(text(html)).toBe('15.10.2026')
  })

  it('marks a draft instead of printing an empty number', () => {
    expect(text(renderToString(<DocTitle title="Счёт на оплату" number={null} />))).toBe('Счёт на оплату (черновик)')
    expect(text(renderToString(<DocTitle title="Счёт на оплату" number="СЧ-2026-0001" />))).toBe(
      'Счёт на оплату № СЧ-2026-0001',
    )
  })
})

describe('documents.css', () => {
  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(cssSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(cssSource).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })

  it('sets the sheet in points, A4 wide', () => {
    expect(cssSource).toMatch(/width:\s*595pt/)
    expect(cssSource).toMatch(/min-height:\s*842pt/)
  })
})
