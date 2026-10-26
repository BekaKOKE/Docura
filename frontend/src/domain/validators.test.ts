import { describe, expect, it } from 'vitest'
import { isValidIinBin, validateIinBin } from './binIin'
import { isValidIik, validateIik } from './iik'
import { validateKbe, validateKnp } from './requisites'
import { binIinVectors, iikVectors } from './testVectors'

// A message the user can read: non-empty, Russian, no English "Error".
function expectRussianMessage(message: string | null): void {
  expect(message).not.toBeNull()
  expect(message).toMatch(/[А-Яа-яЁё]/)
  expect(message).not.toMatch(/error/i)
}

describe('contracts/test-vectors/bin-iin.json', () => {
  it('has cases with unique ids', () => {
    expect(binIinVectors.cases.length).toBeGreaterThan(0)
    expect(new Set(binIinVectors.cases.map((c) => c.id)).size).toBe(binIinVectors.cases.length)
  })

  it.each(binIinVectors.cases.map((c) => [c.id, c] as const))('%s', (_id, vector) => {
    expect(isValidIinBin(vector.value)).toBe(vector.valid)
    const message = validateIinBin(vector.value)
    if (vector.valid) expect(message).toBeNull()
    else expectRussianMessage(message)
  })
})

describe('contracts/test-vectors/iik.json', () => {
  it('has cases with unique ids', () => {
    expect(iikVectors.cases.length).toBeGreaterThan(0)
    expect(new Set(iikVectors.cases.map((c) => c.id)).size).toBe(iikVectors.cases.length)
  })

  it.each(iikVectors.cases.map((c) => [c.id, c] as const))('%s', (_id, vector) => {
    expect(isValidIik(vector.value)).toBe(vector.valid)
    const message = validateIik(vector.value)
    if (vector.valid) expect(message).toBeNull()
    else expectRussianMessage(message)
  })
})

describe('ИИН/БИН messages', () => {
  it('name the problem', () => {
    expect(validateIinBin('')).toBe('Введите ИИН или БИН')
    expect(validateIinBin('85031230012A')).toBe('ИИН и БИН состоят только из цифр')
    expect(validateIinBin('85031230012')).toBe('ИИН и БИН состоят из 12 цифр')
    expect(validateIinBin('850312300122')).toBe('ИИН или БИН указан неверно: проверьте цифры')
  })
})

describe('ИИК messages', () => {
  it('name the problem', () => {
    expect(validateIik('')).toBe('Введите ИИК')
    expect(validateIik('KZ75998KZT100130033')).toBe('ИИК состоит из 20 символов')
    expect(validateIik('RU75998KZT1001300335')).toBe('ИИК начинается с букв KZ')
    expect(validateIik('KZ76998KZT1001300335')).toBe('ИИК указан неверно: проверьте символы')
    expect(validateIik('kz75998kzt1001300335')).toBe('ИИК состоит из заглавных латинских букв и цифр, без пробелов')
  })
})

describe('КНП', () => {
  it.each(['859', '000', '123'])('accepts %j', (value) => {
    expect(validateKnp(value)).toBeNull()
  })

  it.each(['85', '8590', '85A', '', ' 85', '８５９'])('rejects %j with a Russian message', (value) => {
    expectRussianMessage(validateKnp(value))
  })
})

describe('Кбе', () => {
  it.each(['17', '19', '00'])('accepts %j', (value) => {
    expect(validateKbe(value)).toBeNull()
  })

  it.each(['7', '170', '1A', '', ' 7'])('rejects %j with a Russian message', (value) => {
    expectRussianMessage(validateKbe(value))
  })
})
