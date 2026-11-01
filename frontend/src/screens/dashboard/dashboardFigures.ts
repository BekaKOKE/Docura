import { t } from '../../i18n/t'
import type { Dashboard } from '../../services'

// What the dashboard says about its period and its numbers, apart from the markup.

/** The month of a period's first day in words: "октябрь" for 2026-10-01 (the month does not depend on a zone). */
export function monthName(day: string): string {
  return new Intl.DateTimeFormat('ru', { month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))
}

/** "Октябрь 2026" for the line under the title. */
export function periodTitle(day: string): string {
  const name = monthName(day)
  return t('db.period', { month: name.charAt(0).toUpperCase() + name.slice(1), year: day.slice(0, 4) })
}

/** Nothing happened in the period and nothing waits: the tiles are zeros and the screen says so. */
export function isQuiet(data: Dashboard): boolean {
  return (
    data.cashedTiyn === 0 &&
    data.invoicedTiyn === 0 &&
    data.outstanding.balanceTiyn === 0 &&
    data.signed.count === 0 &&
    data.awaitingSignature.count === 0 &&
    data.toInvoice.length === 0
  )
}
