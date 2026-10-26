// ИИН/БИН: 12 digits, the 12th is a control digit (docs/kz-rules.md, row 6).
// Weights 1–11 over digits 1–11, mod 11; if that is 10, weights 3–11, 1, 2; if that is 10 again, the number is invalid.
// The БИН rules were not found in an official source, so the same algorithm is applied to it (kz-rules row 6).

import type { Validation } from './validation'

const FIRST_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const SECOND_WEIGHTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]

function weightedMod11(digits: readonly number[], weights: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i += 1) sum += digits[i] * weights[i]
  return sum % 11
}

export function validateIinBin(value: string): Validation {
  if (value === '') return 'Введите ИИН или БИН'
  if (!/^\d+$/.test(value)) return 'ИИН и БИН состоят только из цифр'
  if (value.length !== 12) return 'ИИН и БИН состоят из 12 цифр'

  const digits = Array.from(value, Number)
  let control = weightedMod11(digits, FIRST_WEIGHTS)
  if (control === 10) control = weightedMod11(digits, SECOND_WEIGHTS)
  if (control === 10 || control !== digits[11]) return 'ИИН или БИН указан неверно: проверьте цифры'
  return null
}

export function isValidIinBin(value: string): boolean {
  return validateIinBin(value) === null
}
