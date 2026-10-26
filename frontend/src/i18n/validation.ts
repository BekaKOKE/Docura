// The domain validators (src/domain) return their Russian message as text. The UI and the mock must show
// it through t(), so this maps each of those messages to its dictionary key. The text is only a lookup key
// here: an unknown message (the domain wording changed) falls back to the generic key and the test in
// validation.test.ts fails, so the mapping can't drift unnoticed.

import type { Validation } from '../domain/validation'
import type { MessageKey } from './t'

const keys: Readonly<Record<string, MessageKey>> = {
  'Введите ИИН или БИН': 'validation.binIin.empty',
  'ИИН и БИН состоят только из цифр': 'validation.binIin.digits',
  'ИИН и БИН состоят из 12 цифр': 'validation.binIin.length',
  'ИИН или БИН указан неверно: проверьте цифры': 'validation.binIin.checksum',
  'Введите ИИК': 'validation.iik.empty',
  'ИИК состоит из заглавных латинских букв и цифр, без пробелов': 'validation.iik.charset',
  'ИИК состоит из 20 символов': 'validation.iik.length',
  'ИИК начинается с букв KZ': 'validation.iik.prefix',
  'ИИК указан неверно: проверьте символы': 'validation.iik.checksum',
  'Введите КНП': 'validation.knp.empty',
  'КНП состоит из 3 цифр': 'validation.knp.format',
  'Введите Кбе': 'validation.kbe.empty',
  'Кбе состоит из 2 цифр': 'validation.kbe.format',
}

/** Every domain message this file knows, for the test that runs the validators against it. */
export const knownValidationMessages: readonly string[] = Object.keys(keys)

/** The dictionary key of a domain validator's result: null when the value is valid. */
export function validationKey(result: Validation): MessageKey | null {
  if (result === null) return null
  return keys[result] ?? 'validation.unknown'
}
