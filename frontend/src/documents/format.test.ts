import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatQty, formatRate, taxIdLabel } from './format'

describe('formatDate', () => {
  it('writes dd.mm.yyyy', () => {
    expect(formatDate('2026-10-15')).toBe('15.10.2026')
    expect(formatDate('2027-01-05')).toBe('05.01.2027')
  })
})

describe('formatQty', () => {
  it.each([
    [12500, '12,5'],
    [1000, '1'],
    [500, '0,5'],
    [125, '0,125'],
    [40000, '40'],
    [2000, '2'],
    [32000, '32'],
    [1234567, '1 234,567'],
  ])('%i thousandths read %s', (qtyMilli, expected) => {
    expect(formatQty(qtyMilli)).toBe(expected)
  })
})

describe('formatRate', () => {
  it('prints the VAT rate as a percent figure', () => {
    expect(formatRate(1600)).toBe('16')
    expect(formatRate(1650)).toBe('16,5')
    expect(formatRate(1605)).toBe('16,05')
  })
})

describe('formatDateTime', () => {
  it('shows the time in the zone it is asked for (Kazakhstan is UTC+5)', () => {
    expect(formatDateTime('2026-10-19T09:05:00Z', 'Asia/Almaty')).toEqual({ date: '19.10.2026', time: '14:05' })
  })

  it('rolls the date over at local midnight', () => {
    expect(formatDateTime('2026-10-19T19:30:00Z', 'Asia/Almaty')).toEqual({ date: '20.10.2026', time: '00:30' })
  })
})

describe('taxIdLabel', () => {
  it('names the number by who it belongs to', () => {
    expect(taxIdLabel({ kind: 'person' })).toBe('doc.id.iin')
    expect(taxIdLabel({ kind: 'company' })).toBe('doc.id.bin')
    expect(taxIdLabel({ legalForm: 'ip' })).toBe('doc.id.iin')
    expect(taxIdLabel({ legalForm: 'too' })).toBe('doc.id.bin')
    expect(taxIdLabel({ legalForm: 'other' })).toBe('doc.id.binIin')
  })
})
