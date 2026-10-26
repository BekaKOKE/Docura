// КНП (payment purpose code) is 3 digits, Кбе is 2 digits (NB resolution № 203, docs/kz-rules.md row 4).

import type { Validation } from './validation'

export function validateKnp(value: string): Validation {
  if (value === '') return 'Введите КНП'
  if (!/^\d{3}$/.test(value)) return 'КНП состоит из 3 цифр'
  return null
}

export function validateKbe(value: string): Validation {
  if (value === '') return 'Введите Кбе'
  if (!/^\d{2}$/.test(value)) return 'Кбе состоит из 2 цифр'
  return null
}
