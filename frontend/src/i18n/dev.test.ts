import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '../services/errors'
import { devRu } from './dev'
import { ru } from './ru'
import { t } from './t'

describe('development panel strings', () => {
  it('have no empty strings and no key that ru.ts also has', () => {
    for (const [key, value] of Object.entries(devRu)) expect(value.trim(), key).not.toBe('')
    expect(Object.keys(devRu).filter((key) => key in ru)).toEqual([])
  })

  it('are reachable through t() in development, which is what the tests run in', () => {
    expect(t('dev.data.reset')).toBe('Сбросить данные')
    expect(t('dev.data.signedIn', { email: 'a@b.kz' })).toBe('Вход: a@b.kz')
  })
})

describe('ApiError messages', () => {
  it.each(API_ERROR_CODES)('has a Russian message for %s', (code) => {
    expect(t(`apiError.${code}`)).toMatch(/[А-Яа-яЁё]/)
  })
})
