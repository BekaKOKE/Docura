// ИИК: 20 characters, starts with KZ, upper-case letters and digits, IBAN mod-97 equals 1.
// The format is the IBAN standard; the NB rules don't state it (docs/kz-rules.md, row 4).
// Lower case is rejected as stored; the UI upper-cases what the user typed before validating.

import type { Validation } from './validation'

const IIK_LENGTH = 20

// Letters become two digits (A = 10 … Z = 35); the remainder is carried digit by digit, so it stays small.
function mod97(rearranged: string): number {
  let remainder = 0
  for (const char of rearranged) {
    const code = char <= '9' ? char : String(char.charCodeAt(0) - 55)
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder
}

export function validateIik(value: string): Validation {
  if (value === '') return 'Введите ИИК'
  if (!/^[A-Z0-9]+$/.test(value)) return 'ИИК состоит из заглавных латинских букв и цифр, без пробелов'
  if (value.length !== IIK_LENGTH) return 'ИИК состоит из 20 символов'
  if (!value.startsWith('KZ')) return 'ИИК начинается с букв KZ'
  if (mod97(value.slice(4) + value.slice(0, 4)) !== 1) return 'ИИК указан неверно: проверьте символы'
  return null
}

export function isValidIik(value: string): boolean {
  return validateIik(value) === null
}
