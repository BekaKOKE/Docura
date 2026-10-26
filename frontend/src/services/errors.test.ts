import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES, API_ERROR_STATUS, ApiError, isApiError, isApiErrorCode } from './errors'

// #11 AC 2: the codes are exactly the list in replica/architecture.md.
const ARCHITECTURE_CODES = [
  'validation_error',
  'unauthorized',
  'not_found',
  'version_conflict',
  'document_locked',
  'exceeds_quote_total',
  'overpayment',
  'already_signed',
  'link_expired',
  'link_revoked',
  'rate_limited',
]

describe('ApiError codes', () => {
  it('are exactly the eleven codes of the architecture', () => {
    expect([...API_ERROR_CODES]).toEqual(ARCHITECTURE_CODES)
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length)
  })

  it('have a default HTTP status each, and no extra entries', () => {
    expect(Object.keys(API_ERROR_STATUS).sort()).toEqual([...ARCHITECTURE_CODES].sort())
    for (const code of API_ERROR_CODES) expect(API_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400)
  })

  it('uses the statuses the architecture names', () => {
    expect(API_ERROR_STATUS.not_found).toBe(404)
    expect(API_ERROR_STATUS.version_conflict).toBe(409)
    expect(API_ERROR_STATUS.document_locked).toBe(409)
    expect(API_ERROR_STATUS.exceeds_quote_total).toBe(409)
    expect(API_ERROR_STATUS.overpayment).toBe(409)
    expect(API_ERROR_STATUS.already_signed).toBe(409)
    expect(API_ERROR_STATUS.link_expired).toBe(410)
    expect(API_ERROR_STATUS.link_revoked).toBe(410)
    expect(API_ERROR_STATUS.unauthorized).toBe(401)
    expect(API_ERROR_STATUS.rate_limited).toBe(429)
  })

  it('narrows unknown values with isApiErrorCode', () => {
    expect(isApiErrorCode('not_found')).toBe(true)
    expect(isApiErrorCode('cancelled')).toBe(false)
    expect(isApiErrorCode(404)).toBe(false)
    expect(isApiErrorCode(undefined)).toBe(false)
  })
})

describe('ApiError', () => {
  it('carries status, code, message and fields', () => {
    const err = new ApiError({
      status: 422,
      code: 'validation_error',
      message: 'Проверьте поля',
      fields: { name: 'Обязательное поле' },
    })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.name).toBe('ApiError')
    expect(err.status).toBe(422)
    expect(err.code).toBe('validation_error')
    expect(err.message).toBe('Проверьте поля')
    expect(err.fields).toEqual({ name: 'Обязательное поле' })
  })

  it('takes the default status of the code when none is given', () => {
    for (const code of API_ERROR_CODES) {
      expect(new ApiError({ code, message: 'x' }).status).toBe(API_ERROR_STATUS[code])
    }
  })

  it('leaves fields undefined when there are none', () => {
    const err = new ApiError({ code: 'link_expired', message: 'Срок ссылки истёк' })
    expect(err.fields).toBeUndefined()
  })

  it('is recognised by isApiError, and plain errors are not', () => {
    expect(isApiError(new ApiError({ code: 'not_found', message: 'x' }))).toBe(true)
    expect(isApiError(new Error('x'))).toBe(false)
    expect(isApiError({ code: 'not_found', status: 404, message: 'x' })).toBe(false)
  })
})
