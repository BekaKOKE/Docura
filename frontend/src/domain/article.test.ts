import { describe, expect, it } from 'vitest'
import { ARTICLE_UNITS, isArticleUnit, parsePriceInput, priceTiynError, titleError, validateArticle } from './article'
import { formatMoney } from './money'

describe('ARTICLE_UNITS (AC 2, TC-2)', () => {
  it('is exactly the twelve units of the spec, in order', () => {
    expect([...ARTICLE_UNITS]).toEqual(['шт', 'м', 'м²', 'м³', 'п.м.', 'кг', 'т', 'л', 'ч', 'смена', 'компл.', 'услуга'])
  })

  it('accepts only those units', () => {
    expect(isArticleUnit('м²')).toBe(true)
    expect(isArticleUnit('п.м.')).toBe(true)
    expect(isArticleUnit('м2')).toBe(false)
    expect(isArticleUnit('')).toBe(false)
    expect(isArticleUnit(undefined)).toBe(false)
  })
})

describe('parsePriceInput (AC 3, TC-3)', () => {
  it.each([
    ['18 500', 1850000],
    ['18\u00a0500', 1850000], // no-break space, as the field formats it
    ['18\u202f500', 1850000], // narrow no-break space
    ['18500', 1850000],
    ['18500,50', 1850050],
    ['18500.5', 1850050],
    ['12,5', 1250],
    ['0', 0],
    ['0,05', 5],
    ['  18 500  ', 1850000],
  ])('reads %j as %i tiyn', (text, tiyn) => {
    expect(parsePriceInput(text)).toEqual({ ok: true, tiyn })
  })

  it.each(['-100', '−100', '– 100', '-18 500,50'])('calls %j negative', (text) => {
    expect(parsePriceInput(text)).toEqual({ ok: false, error: 'article.error.priceNegative' })
  })

  it.each(['abc', '18 5oo', '1,234', '12,', ',5', '1,2,3', '₸', '-abc', '--5', '१२'])('calls %j a format error', (text) => {
    expect(parsePriceInput(text)).toEqual({ ok: false, error: 'article.error.priceFormat' })
  })

  it('asks for a price when the field is empty', () => {
    expect(parsePriceInput('')).toEqual({ ok: false, error: 'article.error.priceRequired' })
    expect(parsePriceInput('   ')).toEqual({ ok: false, error: 'article.error.priceRequired' })
  })

  it('shows what it stored as «18 500 ₸» and «18 500,50 ₸» (AC 3)', () => {
    const shown = (text: string) => {
      const parsed = parsePriceInput(text)
      if (!parsed.ok) throw new Error('not a price')
      return formatMoney(parsed.tiyn).replaceAll('\u00a0', ' ')
    }
    expect(shown('18 500')).toBe('18 500 ₸')
    expect(shown('18500,50')).toBe('18 500,50 ₸')
    expect(shown('18500.5')).toBe('18 500,50 ₸')
  })
})

describe('field rules', () => {
  it('needs a title of 1 to 300 characters', () => {
    expect(titleError('')).toBe('article.error.titleRequired')
    expect(titleError('   ')).toBe('article.error.titleRequired')
    expect(titleError('Қабырғаны сылау')).toBeNull()
    expect(titleError('я'.repeat(300))).toBeNull()
    expect(titleError('я'.repeat(301))).toBe('article.error.titleLong')
  })

  it('takes tiyn only as a non-negative safe integer', () => {
    expect(priceTiynError(0)).toBeNull()
    expect(priceTiynError(1850000)).toBeNull()
    expect(priceTiynError(-1)).toBe('article.error.priceNegative')
    expect(priceTiynError(10.5)).toBe('article.error.priceFormat')
    expect(priceTiynError(Number.NaN)).toBe('article.error.priceFormat')
    expect(priceTiynError('100')).toBe('article.error.priceFormat')
  })

  it('validateArticle is empty for a good item and keyed by field otherwise', () => {
    expect(validateArticle({ kind: 'service', title: 'Плинтус', unit: 'п.м.', unitPriceTiyn: 150000 })).toEqual({})
    expect(validateArticle({ kind: 'thing', title: '', unit: 'пачка', unitPriceTiyn: -5 })).toEqual({
      kind: 'article.error.kindInvalid',
      title: 'article.error.titleRequired',
      unit: 'article.error.unitInvalid',
      unitPriceTiyn: 'article.error.priceNegative',
    })
  })
})
