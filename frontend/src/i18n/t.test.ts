import { describe, expect, it } from 'vitest'
import { ru } from './ru'
import { formatIssues, t, tCount, type CountKey } from './t'

describe('t', () => {
  it('returns the Russian string for a key', () => {
    expect(t('screen.S14.title')).toBe('Выставление счёта')
  })

  it('fills named params', () => {
    expect(t('placeholder.comesIn', { issues: '#22' })).toBe('Экран появится в задаче #22')
  })

  it('leaves a placeholder visible when its param is missing', () => {
    expect(t('app.pageTitle', {})).toBe('{title} · Docura')
  })

  it('keeps ё and «ёлочки» intact', () => {
    expect(t('screen.S21.purpose')).toContain('«Ждём · просрочено»')
  })
})

describe('formatIssues', () => {
  it('joins issue numbers the Russian way', () => {
    expect(formatIssues([22])).toBe('#22')
    expect(formatIssues([28, 30])).toBe('#28 и #30')
  })
})

describe('tCount', () => {
  it.each([
    [1, '1 счёт'],
    [2, '2 счёта'],
    [4, '4 счёта'],
    [5, '5 счетов'],
    [11, '11 счетов'],
    [12, '12 счетов'],
    [21, '21 счёт'],
    [22, '22 счёта'],
    [25, '25 счетов'],
    [101, '101 счёт'],
    [111, '111 счетов'],
    [0, '0 счетов'],
  ])('counts %i invoices as "%s"', (n, expected) => {
    expect(tCount('count.invoice', n)).toBe(expected)
  })

  it('uses the genitive singular for fractions', () => {
    expect(tCount('count.invoice', 1.5)).toBe('1,5 счёта')
  })

  it('groups thousands with a space so 1000 stays readable', () => {
    expect(tCount('count.invoice', 1000)).toMatch(/^1\s000 счетов$/)
  })

  it('counts every noun in the dictionary in all four forms', () => {
    const bases = Object.keys(ru)
      .filter((key) => key.endsWith('.one'))
      .map((key) => key.slice(0, -'.one'.length) as CountKey)
    expect(bases.length).toBeGreaterThan(0)
    for (const base of bases) {
      for (const form of ['one', 'few', 'many', 'other']) {
        expect(Object.keys(ru), `${base}.${form}`).toContain(`${base}.${form}`)
      }
      expect(tCount(base, 1), base).toContain('1')
    }
  })

  it('gives day, act and client the right Russian forms', () => {
    expect([1, 2, 5].map((n) => tCount('count.day', n))).toEqual(['1 день', '2 дня', '5 дней'])
    expect([1, 3, 7].map((n) => tCount('count.act', n))).toEqual(['1 акт', '3 акта', '7 актов'])
    expect([1, 2, 5].map((n) => tCount('count.client', n))).toEqual(['1 клиент', '2 клиента', '5 клиентов'])
  })
})
