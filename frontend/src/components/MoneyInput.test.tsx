import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parsePriceTiyn } from '../domain/money'
import { MoneyInput } from './MoneyInput'
import { formatMoneyInputText, moneyInputTextFromTiyn } from './moneyInputText'

// Read from disk: Vitest turns a `?raw` stylesheet import into an empty string, which would make the checks vacuous.
const cssSource = readFileSync(new URL('./moneyInput.css', import.meta.url), 'utf8')

describe('formatMoneyInputText: the text after blur', () => {
  it.each([
    ['18500', '18 500'],
    ['18 500', '18 500'],
    ['18 500', '18 500'],
    ['18500,5', '18 500,50'],
    ['18500.50', '18 500,50'],
    ['12,5', '12,50'],
    ['1234567', '1 234 567'],
    ['0', '0'],
    ['007', '7'],
  ])('writes %j as %j', (typed, shown) => {
    expect(formatMoneyInputText(typed)).toBe(shown)
  })

  it('leaves what is not a price exactly as typed, so it can be fixed', () => {
    for (const typed of ['', 'abc', '-100', '18 5oo', '1,234', '12,']) {
      expect(formatMoneyInputText(typed)).toBe(typed)
    }
  })

  it('keeps the value: the formatted text parses to the same tiyn', () => {
    for (const typed of ['18500', '18500,5', '0,07', '999 999,99']) {
      expect(parsePriceTiyn(formatMoneyInputText(typed))).toBe(parsePriceTiyn(typed))
    }
  })

  it('never puts the ₸ into the value', () => {
    expect(formatMoneyInputText('18500')).not.toContain('₸')
  })
})

describe('moneyInputTextFromTiyn: the text an edit form starts with', () => {
  it('shows a stored price the way the field shows it after blur (TC-1: 19 000, TC-3: 18 500,50)', () => {
    expect(moneyInputTextFromTiyn(1900000)).toBe('19 000')
    expect(moneyInputTextFromTiyn(1850050)).toBe('18 500,50')
    expect(moneyInputTextFromTiyn(0)).toBe('0')
    expect(moneyInputTextFromTiyn(5)).toBe('0,05')
  })

  it('round-trips through the parser to the same tiyn', () => {
    for (const tiyn of [0, 5, 100, 1850000, 1850050, 123456789]) {
      expect(parsePriceTiyn(moneyInputTextFromTiyn(tiyn))).toBe(tiyn)
    }
  })
})

describe('MoneyInput', () => {
  const render = (props: Partial<Parameters<typeof MoneyInput>[0]> = {}) =>
    renderToString(<MoneyInput id="price" value="" onChange={() => {}} {...props} />)

  it('is a text field with the decimal keypad, right-aligned figures and a muted ₸ that is not announced', () => {
    const html = render({ value: '18 500' })
    expect(html).toContain('inputMode="decimal"')
    expect(html).toContain('type="text"')
    expect(html).toContain('id="price"')
    expect(html).toContain('value="18 500"')
    expect(html).toMatch(/<span class="mi-suffix" aria-hidden="true">₸<\/span>/)
  })

  it('reads the currency out and ties the hint and the error to the field', () => {
    const html = render({ describedBy: 'price-hint price-error', invalid: true })
    expect(html).toContain('aria-describedby="price-currency price-hint price-error"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('id="price-currency"')
    expect(html).toContain('тенге')
  })

  it('has no aria-invalid until there is an error', () => {
    expect(render()).not.toContain('aria-invalid')
  })

  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(cssSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(cssSource).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
    expect(cssSource.length).toBeGreaterThan(200)
    expect(cssSource).toContain('text-align: right')
    expect(cssSource).toContain('tabular-nums')
  })
})
