import { describe, expect, it } from 'vitest'
import { formatIssues, t } from './t'

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
