// Calendar days. Business dates (`issueDate`, `validUntil`) are `YYYY-MM-DD` strings: days in the company's time
// zone, never timestamps (replica/architecture.md, "Times"). The zone is an IANA name such as `Asia/Almaty`,
// never a fixed offset. Used by the mock services and by the quote editor, so both count days the same way.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a real calendar day written `YYYY-MM-DD` (2026-02-30 is not one). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** The calendar day it is at `now` in the zone: 2026-10-20T19:00:00Z is 2026-10-21 in Asia/Almaty (UTC+5). */
export function todayInZone(timeZone: string, now: Date): string {
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
export function addDays(date: string, days: number): string {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new RangeError(`not a date: ${date}`)
  const moved = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  return moved.toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const start = DATE_PATTERN.exec(from)
  const end = DATE_PATTERN.exec(to)
  if (!start) throw new RangeError(`not a date: ${from}`)
  if (!end) throw new RangeError(`not a date: ${to}`)
  const utc = (m: RegExpExecArray) => Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // Two UTC midnights are a whole number of days apart (no daylight saving), so the division is exact.
  return (utc(end) - utc(start)) / 86_400_000
}
