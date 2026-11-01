import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import {
  checkAmount,
  DEFAULT_METHOD,
  isPaymentMethod,
  isSwipeLeft,
  LAST_METHOD_KEY,
  newPaymentRequestId,
  NOTICE_MS,
  PAYMENT_METHODS,
  readLastMethod,
  rememberMethod,
  submitLabel,
  UNDO_MS,
} from './paymentRules'

// The pure rules of the record-payment sheet (#30), against the test cases of the issue.

const norm = (text: string) => text.replace(/\s/g, ' ')

// Invoice B of the test cases: 161 965 ₸, of which 64 786 ₸ is paid, so 97 179 ₸ is left.
const BALANCE = 9_717_900

describe('checkAmount (AC 3, TC-3)', () => {
  it('accepts an amount up to the balance, written the way people write it', () => {
    for (const [text, tiyn] of [
      ['97 179', 9_717_900],
      ['97179', 9_717_900],
      ['97 179,00', 9_717_900],
      ['64 786', 6_478_600],
      ['0,01', 1],
      ['0.5', 50],
    ] as const) {
      expect(checkAmount(text, BALANCE), text).toEqual({ ok: true, tiyn })
    }
  })

  it('says by how much an amount is over the balance', () => {
    // 109 179 against 97 179 left: over by 12 000.
    const check = checkAmount('109 179', BALANCE)
    expect(check.ok).toBe(false)
    expect(!check.ok && check.kind).toBe('over')
    expect(!check.ok && norm(check.message)).toBe('Больше остатка на 12 000 ₸. Проверьте сумму.')
  })

  it('is over by one tiyn when it is one tiyn too much', () => {
    const check = checkAmount('97 179,01', BALANCE)
    expect(!check.ok && norm(check.message)).toBe('Больше остатка на 0,01 ₸. Проверьте сумму.')
  })

  it('asks for an amount when there is none or it is zero', () => {
    for (const text of ['', '   ', '0', '0,00', '000']) {
      const check = checkAmount(text, BALANCE)
      expect(check, JSON.stringify(text)).toMatchObject({ ok: false, kind: 'required', message: 'Укажите сумму' })
    }
  })

  it('refuses letters, a minus and more than two decimals with an example', () => {
    for (const text of ['abc', '-5', '−5', '12,345', '1e3', '12 ₸₸']) {
      const check = checkAmount(text, BALANCE)
      expect(check, text).toMatchObject({ ok: false, kind: 'format', message: t('pm.error.amountFormat') })
    }
  })
})

describe('submitLabel (the button follows the amount)', () => {
  it('says "Записать 147 840 ₸" for a good amount', () => {
    expect(norm(submitLabel('147 840', 14_784_000))).toBe('Записать 147 840 ₸')
    expect(norm(submitLabel('64 786', BALANCE))).toBe('Записать 64 786 ₸')
    expect(norm(submitLabel('0,01', BALANCE))).toBe('Записать 0,01 ₸')
  })

  it('says only "Записать" while the amount is empty, zero, wrong or too big', () => {
    for (const text of ['', '0', 'abc', '109 179']) expect(submitLabel(text, BALANCE), text).toBe('Записать')
  })
})

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe('the method chips', () => {
  it('are Наличные, Kaspi, Перевод, Карта, Другое, in this order', () => {
    expect(PAYMENT_METHODS.map((method) => t(`pay.method.${method}`))).toEqual(['Наличные', 'Kaspi', 'Перевод', 'Карта', 'Другое'])
    expect(PAYMENT_METHODS.every(isPaymentMethod)).toBe(true)
    expect(isPaymentMethod('bitcoin')).toBe(false)
    expect(isPaymentMethod(null)).toBe(false)
  })

  it('start with cash when none was used before', () => {
    expect(DEFAULT_METHOD).toBe('cash')
    expect(readLastMethod(memory())).toBeNull()
  })
})

describe('the last method used (AC 2)', () => {
  it('is remembered and read back', () => {
    const storage = memory()
    rememberMethod('kaspi', storage)
    expect(storage.getItem(LAST_METHOD_KEY)).toBe('kaspi')
    expect(readLastMethod(storage)).toBe('kaspi')
  })

  it('ignores a value that is not a method', () => {
    expect(readLastMethod(memory({ [LAST_METHOD_KEY]: 'bitcoin' }))).toBeNull()
  })

  it('survives a browser that keeps nothing or throws: no error, no method', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => rememberMethod('card', throwing)).not.toThrow()
    expect(readLastMethod(throwing)).toBeNull()
    expect(() => rememberMethod('card', null)).not.toThrow()
    expect(readLastMethod(null)).toBeNull()
  })
})

describe('the swipe on a row (TC-8)', () => {
  it('is a long, flat move to the left', () => {
    expect(isSwipeLeft(-120, 4)).toBe(true)
    expect(isSwipeLeft(-64, -20)).toBe(true)
  })

  it('is not a short move, a move to the right, or scrolling the list', () => {
    expect(isSwipeLeft(-30, 0)).toBe(false)
    expect(isSwipeLeft(120, 0)).toBe(false)
    expect(isSwipeLeft(-100, 90)).toBe(false)
    expect(isSwipeLeft(-70, 40)).toBe(false)
  })
})

describe('the toast and the request key (AC 4, AC 6)', () => {
  it('stays 8 seconds, longer than a plain notice', () => {
    expect(UNDO_MS).toBe(8000)
    expect(NOTICE_MS).toBeLessThan(UNDO_MS)
  })

  it('makes a different key for every sheet', () => {
    const keys = new Set(Array.from({ length: 50 }, newPaymentRequestId))
    expect(keys.size).toBe(50)
    for (const key of keys) expect(key).toMatch(/^pm-[a-z0-9]+-[a-z0-9]+$/)
  })
})
