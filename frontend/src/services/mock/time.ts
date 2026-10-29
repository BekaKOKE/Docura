// Dates and timestamps for the mock services. Business dates (`issueDate`, `validUntil`) are calendar days
// in the company's time zone; timestamps are UTC (replica/architecture.md, "Times"). The day helpers live in
// src/domain/dates.ts, because the quote editor counts days the same way; they are re-exported here.

import type { IsoTimestamp } from '../types'

export { addDays, isIsoDate, todayInZone } from '../../domain/dates'

/** An ISO 8601 UTC timestamp without milliseconds, like the ones in the seed: `2026-10-15T06:20:00Z`. */
export function utcTimestamp(now: Date): IsoTimestamp {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
