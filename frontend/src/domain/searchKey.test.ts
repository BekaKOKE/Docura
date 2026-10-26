import { describe, expect, it } from 'vitest'
import { searchKey } from './searchKey'

describe('searchKey', () => {
  it('treats ё and е as the same letter', () => {
    expect(searchKey('Ёлкина')).toBe('елкина')
    expect(searchKey('Ёлкина')).toBe(searchKey('елкина'))
    expect(searchKey('Ирина Ёлкина')).toBe(searchKey('ирина елкина'))
  })

  it.each([
    ['Қайрат', 'қайрат'],
    ['ӘБІЛҚАСЫМОВ', 'әбілқасымов'],
    ['Ғалым Үсенов Һәм Ңұрлан Өтеген', 'ғалым үсенов һәм ңұрлан өтеген'],
  ])('keeps Kazakh letters and only lower-cases them: %s', (text, expected) => {
    expect(searchKey(text)).toBe(expected)
  })

  it('keeps «ёлочки» and other punctuation, and lower-cases the rest', () => {
    expect(searchKey('ТОО «Алатау Құрылыс Сервис»')).toBe('тоо «алатау құрылыс сервис»')
  })

  it('leaves digits, ₸ and Latin text alone apart from case', () => {
    expect(searchKey('Укладка ламината 18 500 ₸')).toBe('укладка ламината 18 500 ₸')
    expect(searchKey('KZ75998KZT')).toBe('kz75998kzt')
  })

  it('is empty for an empty string', () => {
    expect(searchKey('')).toBe('')
  })
})
