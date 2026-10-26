import { describe, expect, it } from 'vitest'
import { amountInWords } from './amountInWords'
import { amountInWordsVectors } from './testVectors'

describe('contracts/test-vectors/amount-in-words.json', () => {
  it('has cases with unique ids', () => {
    expect(amountInWordsVectors.cases.length).toBeGreaterThan(0)
    expect(new Set(amountInWordsVectors.cases.map((c) => c.id)).size).toBe(amountInWordsVectors.cases.length)
  })

  it.each(amountInWordsVectors.cases.map((c) => [c.id, c] as const))('%s', (_id, vector) => {
    expect(amountInWords(vector.amountTiyn)).toBe(vector.expected)
  })
})

describe('amountInWords', () => {
  it.each([
    [1, 'Ноль тенге 01 тиын'],
    [2, 'Ноль тенге 02 тиына'],
    [4, 'Ноль тенге 04 тиына'],
    [5, 'Ноль тенге 05 тиынов'],
    [20, 'Ноль тенге 20 тиынов'],
    [21, 'Ноль тенге 21 тиын'],
    [23, 'Ноль тенге 23 тиына'],
    [25, 'Ноль тенге 25 тиынов'],
    [101, 'Один тенге 01 тиын'],
    [0, 'Ноль тенге 00 тиын'],
  ])('tiyn: %i → %s', (tiyn, expected) => {
    expect(amountInWords(tiyn)).toBe(expected)
  })

  it.each([
    [10000, 'Сто тенге 00 тиын'],
    [1200000, 'Двенадцать тысяч тенге 00 тиын'],
    [11100000, 'Сто одиннадцать тысяч тенге 00 тиын'],
    [110000000, 'Один миллион сто тысяч тенге 00 тиын'],
    [100000100, 'Один миллион один тенге 00 тиын'],
    [200000200, 'Два миллиона два тенге 00 тиын'],
    [2100000000, 'Двадцать один миллион тенге 00 тиын'],
    [100000000000, 'Один миллиард тенге 00 тиын'],
    [100002000, 'Один миллион двадцать тенге 00 тиын'],
    [300000000, 'Три миллиона тенге 00 тиын'],
    [2200000, 'Двадцать две тысячи тенге 00 тиын'],
    [1000000000000, 'Десять миллиардов тенге 00 тиын'],
  ])('tenge: %i → %s', (tiyn, expected) => {
    expect(amountInWords(tiyn)).toBe(expected)
  })

  it('starts with a capital letter and never changes "тенге"', () => {
    const text = amountInWords(32393000)
    expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase())
    expect(text).toContain(' тенге ')
  })

  it('refuses a negative or non-integer amount', () => {
    expect(() => amountInWords(-1)).toThrow(RangeError)
    expect(() => amountInWords(1.5)).toThrow(RangeError)
  })
})
