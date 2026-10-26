import { describe, expect, it } from 'vitest'
import { formatDocumentNumber, takeNextNumber, yearOf } from './numbering'
import { createStore } from './store'
import { addDays, isIsoDate, todayInZone, utcTimestamp } from './time'

const SEITKALI = 'e3bc7ccf-e8aa-599e-b602-fdd8495bc378'
const NURLANOV = '592a15c4-950b-564d-b1b7-c7752b2ebdce'

describe('document numbers (AC 2)', () => {
  it('are КП-, СЧ- and АВР- with the year and four digits', () => {
    expect(formatDocumentNumber('quote', 2026, 1)).toBe('КП-2026-0001')
    expect(formatDocumentNumber('invoice', 2026, 42)).toBe('СЧ-2026-0042')
    expect(formatDocumentNumber('act', 2027, 1234)).toBe('АВР-2027-1234')
    expect(formatDocumentNumber('quote', 2026, 12345)).toBe('КП-2026-12345')
  })

  it('take the year from the issue date', () => {
    expect(yearOf('2027-01-05')).toBe(2027)
  })

  it('count up from the counter row, and start a new year at 1', () => {
    const store = createStore({ storage: null })
    // The seed has 6 quotes in 2026 for ИП Сейткали Б.
    const taken = store.writeIn(SEITKALI, (db) => [
      takeNextNumber(db, 'quote', '2026-10-20'),
      takeNextNumber(db, 'quote', '2026-10-21'),
      takeNextNumber(db, 'quote', '2027-01-05'),
      takeNextNumber(db, 'quote', '2027-01-06'),
      takeNextNumber(db, 'invoice', '2026-10-21'),
      takeNextNumber(db, 'act', '2026-10-21'),
    ])
    expect(taken).toEqual(['КП-2026-0007', 'КП-2026-0008', 'КП-2027-0001', 'КП-2027-0002', 'СЧ-2026-0005', 'АВР-2026-0002'])
  })

  it('keep each company on its own counter', () => {
    const store = createStore({ storage: null })
    expect(store.writeIn(NURLANOV, (db) => takeNextNumber(db, 'quote', '2026-10-20'))).toBe('КП-2026-0002')
    expect(store.writeIn(SEITKALI, (db) => takeNextNumber(db, 'quote', '2026-10-20'))).toBe('КП-2026-0007')
  })

  it('lose the move when the write that took the number fails', () => {
    const store = createStore({ storage: null })
    expect(() =>
      store.writeIn(SEITKALI, (db) => {
        takeNextNumber(db, 'quote', '2026-10-20')
        throw new Error('the issue failed')
      }),
    ).toThrow('the issue failed')
    expect(store.writeIn(SEITKALI, (db) => takeNextNumber(db, 'quote', '2026-10-20'))).toBe('КП-2026-0007')
  })
})

describe('mock dates', () => {
  it('know the calendar day in Asia/Almaty (UTC+5) at the edge of midnight (AC 5)', () => {
    expect(todayInZone('Asia/Almaty', new Date('2026-10-20T18:59:59Z'))).toBe('2026-10-20')
    expect(todayInZone('Asia/Almaty', new Date('2026-10-20T19:00:00Z'))).toBe('2026-10-21')
    expect(todayInZone('Asia/Almaty', new Date('2026-12-31T19:00:00Z'))).toBe('2027-01-01')
    expect(todayInZone('UTC', new Date('2026-10-20T19:00:00Z'))).toBe('2026-10-20')
  })

  it('accept real calendar days only', () => {
    expect(isIsoDate('2026-10-20')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '20.10.2026', '2026-1-1', '', null, 20261020]) {
      expect(isIsoDate(bad), String(bad)).toBe(false)
    }
  })

  it('add days across a month and a year', () => {
    expect(addDays('2026-10-20', 14)).toBe('2026-11-03')
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('write UTC timestamps without milliseconds', () => {
    expect(utcTimestamp(new Date('2026-10-15T06:20:00.123Z'))).toBe('2026-10-15T06:20:00Z')
  })
})
