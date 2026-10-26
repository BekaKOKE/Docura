import { describe, expect, it } from 'vitest'
import { ru } from './ru'

describe('Russian dictionary', () => {
  it('keeps the Kazakh letters, ₸, Ё and № that the font check page shows', () => {
    for (const letter of ['ә', 'ғ', 'қ', 'ң', 'ө', 'ұ', 'ү', 'һ', 'і']) {
      expect(ru['check.kazakhSample'], letter).toContain(letter)
    }
    expect(ru['check.tengeSample']).toBe('₸')
    expect(ru['check.yoNumeroSample']).toContain('Ё')
    expect(ru['check.yoNumeroSample']).toContain('№')
    expect(ru['check.nameKazakh']).toContain('Қ')
    expect(ru['check.nameKazakh']).toContain('Ә')
  })

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(ru)) expect(value.trim(), key).not.toBe('')
  })

  it('spells «ёлочки» and ё where the copy rules ask for them', () => {
    expect(ru['check.nameCompany']).toBe('ТОО «Алатау Құрылыс Сервис»')
    expect(ru['nav.more']).toBe('Ещё')
  })
})
