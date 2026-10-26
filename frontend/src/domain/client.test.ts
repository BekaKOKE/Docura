import { describe, expect, it } from 'vitest'
import { t } from '../i18n/t'
import { validateIinBin } from './binIin'
import { binIinError, clientFieldError, normalizeBinIin, validateClient } from './client'
import { binIinVectors } from './testVectors'

describe('client ИИН/БИН (AC 2)', () => {
  it('accepts every valid vector and rejects every invalid one, like the shared validator', () => {
    for (const vector of binIinVectors.cases) {
      const error = binIinError(normalizeBinIin(vector.value))
      if (vector.value === '') expect(error, vector.id).toBeNull() // optional: blank is fine for a client
      else expect(error === null, vector.id).toBe(vector.valid)
    }
  })

  it('shows the same words as the domain validator for each way a number can be wrong', () => {
    // 11 digits, a letter, a wrong control digit (contracts README, "invalid values")
    for (const value of ['85031230012', '85031230012A', '850312300122']) {
      const key = binIinError(value)
      expect(key, value).not.toBeNull()
      expect(t(key!), value).toBe(validateIinBin(value))
    }
  })

  it('takes a number typed in groups', () => {
    expect(normalizeBinIin(' 880715 301 453 ')).toBe('880715301453')
    expect(clientFieldError('binIin', '880715 301 453')).toBeNull()
    expect(clientFieldError('binIin', '')).toBeNull()
    expect(clientFieldError('binIin', null)).toBeNull()
  })

  it('refuses the БИН of the test case after one digit is changed', () => {
    expect(clientFieldError('binIin', '080540001238')).toBeNull()
    expect(clientFieldError('binIin', '080540001239')).toBe('client.error.binIinChecksum')
  })
})

describe('client name, phone, email', () => {
  it('requires a name that is not only spaces', () => {
    expect(clientFieldError('name', '')).toBe('client.error.nameRequired')
    expect(clientFieldError('name', '    ')).toBe('client.error.nameRequired')
    expect(t('client.error.nameRequired')).toBe('Укажите имя')
  })

  it('takes long Russian and Kazakh names up to the column size', () => {
    expect(clientFieldError('name', 'Иванов '.repeat(17).trim().slice(0, 120))).toBeNull()
    expect(clientFieldError('name', 'Қайрат Әбілқасымов')).toBeNull()
    expect(clientFieldError('name', 'А'.repeat(301))).toBe('client.error.nameLong')
  })

  it('checks a phone only when it is filled', () => {
    expect(clientFieldError('phone', '')).toBeNull()
    expect(clientFieldError('phone', '+7 777 000 11 22')).toBeNull()
    expect(clientFieldError('phone', '8 (701) 123-45-67')).toBeNull()
    expect(clientFieldError('phone', '12345')).toBe('client.error.phoneInvalid')
    expect(clientFieldError('phone', 'позвонить завтра')).toBe('client.error.phoneInvalid')
  })

  it('checks an email only when it is filled', () => {
    expect(clientFieldError('email', '')).toBeNull()
    expect(clientFieldError('email', 'kairat@example.kz')).toBeNull()
    expect(clientFieldError('email', 'kairat@')).toBe('client.error.emailInvalid')
  })

  it('collects every error of a draft and none for a good one', () => {
    expect(validateClient({ name: 'Ұлжан Төлеуғали', phone: '+7 777 000 11 22', binIin: null })).toEqual({})
    expect(validateClient({ name: ' ', binIin: '123', email: 'x' })).toEqual({
      name: 'client.error.nameRequired',
      binIin: 'client.error.binIinLength',
      email: 'client.error.emailInvalid',
    })
  })
})
