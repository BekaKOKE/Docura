// Dates and timestamps for the mock services. Business dates (`issueDate`, `validUntil`) are calendar days
// in the company's time zone; timestamps are UTC (replica/architecture.md, "Times"). The zone is an IANA name
// such as `Asia/Almaty`, never a fixed offset.

import type { IsoDate, IsoTimestamp } from '../types'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a real calendar day written `YYYY-MM-DD` (2026-02-30 is not one). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** The calendar day it is at `now` in the zone: 2026-10-20T19:00:00Z is 2026-10-21 in Asia/Almaty (UTC+5). */
export function todayInZone(timeZone: string, now: Date): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** `date` plus a number of calendar days (negative goes back). */
export function addDays(date: IsoDate, days: number): IsoDate {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new RangeError(`not a date: ${date}`)
  const moved = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  return moved.toISOString().slice(0, 10)
}

/** An ISO 8601 UTC timestamp without milliseconds, like the ones in the seed: `2026-10-15T06:20:00Z`. */
export function utcTimestamp(now: Date): IsoTimestamp {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
