import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isIsoDate, todayInZone } from './dates'

describe('calendar days', () => {
  it('knows the day in the company zone, not in UTC', () => {
    expect(todayInZone('Asia/Almaty', new Date('2026-10-20T18:59:59Z'))).toBe('2026-10-20')
    expect(todayInZone('Asia/Almaty', new Date('2026-10-20T19:00:00Z'))).toBe('2026-10-21')
  })

  it('accepts real days only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true)
    for (const bad of ['2026-02-30', '2026-13-01', '20.10.2026', '', null, 20261020]) {
      expect(isIsoDate(bad), String(bad)).toBe(false)
    }
  })

  it('adds days across a month and a year', () => {
    expect(addDays('2026-10-20', 14)).toBe('2026-11-03')
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it.each([
    ['2026-10-20', '2026-10-23', 3],
    ['2026-10-20', '2026-11-19', 30],
    ['2026-12-25', '2027-01-08', 14],
    ['2026-10-20', '2026-10-20', 0],
    ['2026-10-20', '2026-10-19', -1],
  ])('counts the days from %s to %s: %i', (from, to, days) => {
    expect(daysBetween(from, to)).toBe(days)
  })

  it('is the inverse of addDays', () => {
    for (const days of [0, 3, 7, 14, 30, 365]) expect(daysBetween('2026-10-20', addDays('2026-10-20', days))).toBe(days)
  })

  it('refuses a text that is not a date', () => {
    expect(() => daysBetween('20.10.2026', '2026-10-21')).toThrow(RangeError)
    expect(() => daysBetween('2026-10-20', 'soon')).toThrow(RangeError)
  })
})
