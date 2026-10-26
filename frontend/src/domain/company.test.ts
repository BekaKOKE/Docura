import { describe, expect, it } from 'vitest'
import { t } from '../i18n/t'
import { knownValidationMessages, validationKey } from '../i18n/validation'
import { validateIinBin } from './binIin'
import { cleanCompanyValue, validateCompanyField, validateCompanyValues } from './company'
import { validateIik } from './iik'
import { detectLogoType, LOGO_MAX_BYTES, logoProblem } from './logo'
import { normalizeKzPhone } from './phone'
import { validateKbe, validateKnp } from './requisites'

describe('phone', () => {
  it.each([
    ['+7 701 123 45 67', '+7 701 123 45 67'],
    ['+77011234567', '+7 701 123 45 67'],
    ['+7 (701) 123-45-67', '+7 701 123 45 67'],
    ['8 701 123 45 67', '+7 701 123 45 67'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeKzPhone(input)).toBe(expected)
  })

  it.each(['', '+7 701 123 45', '+7 701 123 45 678', '+8 701 123 45 67', '701 123 45 67', '+7 701 abc 45 67', '+44 20 7946 0958'])(
    'refuses %j',
    (input) => {
      expect(normalizeKzPhone(input)).toBeNull()
    },
  )
})

describe('logo', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
  const gif = new TextEncoder().encode('GIF89a....')
  const text = new TextEncoder().encode('just text')

  it('reads the type from the first bytes, not from a name', () => {
    expect(detectLogoType(png)).toBe('image/png')
    expect(detectLogoType(jpeg)).toBe('image/jpeg')
    expect(detectLogoType(gif)).toBeNull()
    expect(detectLogoType(text)).toBeNull()
    expect(detectLogoType(new Uint8Array())).toBeNull()
  })

  it('allows up to 300 KB and refuses more', () => {
    expect(logoProblem(120 * 1024, png)).toBeNull()
    expect(logoProblem(299 * 1024, jpeg)).toBeNull()
    expect(logoProblem(LOGO_MAX_BYTES, png)).toBeNull()
    expect(logoProblem(301 * 1024, png)).toBe('size')
    expect(logoProblem(50 * 1024, gif)).toBe('type')
    expect(logoProblem(10, text)).toBe('type')
  })
})

describe('validation messages through t()', () => {
  // Every message a #12 validator can return, so a changed wording can't slip past the mapping.
  const samples = [
    ...['', 'abc', '12345', '850312300122'].map(validateIinBin),
    ...['', 'kz75998kzt1001300335', 'KZ75', 'AA75998KZT1001300335', 'KZ76998KZT1001300335'].map(validateIik),
    ...['', '85', '8591'].map(validateKnp),
    ...['', '7', '177'].map(validateKbe),
  ]

  it('has a dictionary key for every message the validators return', () => {
    const messages = samples.filter((m): m is string => m !== null)
    expect(messages.length).toBeGreaterThan(10)
    for (const message of messages) {
      expect(knownValidationMessages, message).toContain(message)
      const key = validationKey(message)
      expect(key, message).not.toBe('validation.unknown')
      expect(t(key!), message).toBe(message)
    }
  })

  it('maps a valid value to nothing and an unknown message to the generic key', () => {
    expect(validationKey(null)).toBeNull()
    expect(validationKey('какой-то новый текст')).toBe('validation.unknown')
  })
})

describe('company form rules', () => {
  it('accepts the TC-3 data', () => {
    expect(
      validateCompanyValues({
        legalName: 'ИП Сейткали Б.',
        binIin: '850312300121',
        address: 'г. Алматы, ул. Сәтбаев, 22',
        phone: '+7 701 123 45 67',
        directorName: 'Сейткали Бекзат',
        directorPosition: 'Индивидуальный предприниматель',
        bankName: 'АО Тест Банк',
        iik: 'KZ75998KZT1001300335',
        bik: 'DCRAKZKA',
        kbe: '17',
        defaultKnp: '859',
        quoteValidityDays: '14',
      }),
    ).toEqual({})
  })

  it('names the problem of each invalid value from TC-4', () => {
    expect(validateCompanyField('binIin', '850312300122')).toBe('validation.binIin.checksum')
    expect(validateCompanyField('binIin', '85031230012')).toBe('validation.binIin.length')
    expect(validateCompanyField('binIin', '85031230012A')).toBe('validation.binIin.digits')
    expect(validateCompanyField('iik', 'KZ76998KZT1001300335')).toBe('validation.iik.checksum')
    expect(validateCompanyField('iik', 'KZ75998KZT100130033')).toBe('validation.iik.length')
    expect(validateCompanyField('defaultKnp', '85')).toBe('validation.knp.format')
    expect(validateCompanyField('kbe', '7')).toBe('validation.kbe.format')
  })

  it('requires the identity fields and leaves the bank block optional', () => {
    expect(validateCompanyField('binIin', '')).toBe('validation.binIin.empty')
    expect(validateCompanyField('legalName', '  ')).toBe('company.error.legalName')
    for (const field of ['bankName', 'iik', 'bik', 'kbe', 'defaultKnp', 'phone'] as const) {
      expect(validateCompanyField(field, ''), field).toBeNull()
    }
  })

  it('cleans what was typed: capitals and no spaces for ИИК, a canonical phone', () => {
    expect(cleanCompanyValue('iik', ' kz75 998kzt 1001300335 ')).toBe('KZ75998KZT1001300335')
    expect(cleanCompanyValue('binIin', '8503 1230 0121')).toBe('850312300121')
    expect(cleanCompanyValue('phone', '8 (701) 123-45-67')).toBe('+7 701 123 45 67')
    expect(validateCompanyField('iik', 'kz75998kzt1001300335')).toBeNull()
  })

  it('checks the phone, the БИК and the validity days when they are filled', () => {
    expect(validateCompanyField('phone', '+7 701 123')).toBe('company.error.phone')
    expect(validateCompanyField('bik', 'DCRA')).toBe('company.error.bik')
    expect(validateCompanyField('quoteValidityDays', '0')).toBe('company.error.validityDays')
    expect(validateCompanyField('quoteValidityDays', '366')).toBe('company.error.validityDays')
    expect(validateCompanyField('quoteValidityDays', '14,5')).toBe('company.error.validityDays')
    expect(validateCompanyField('quoteValidityDays', '30')).toBeNull()
  })
})
