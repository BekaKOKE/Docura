// Display formatting for documents: dates, quantities, rates, the ИИН/БИН label. Pure functions on strings and
// integers (no floating point for anything that is money or a quantity), tested in format.test.ts.

import type { MessageKey } from '../i18n/t'
import type { BasisPoints, ClientSnapshot, CompanySnapshot, IsoDate, IsoTimestamp, QtyMilli } from '../services'

/** `2026-10-15` → `15.10.2026`: dates on documents are dd.mm.yyyy (components.md §6). */
export function formatDate(date: IsoDate): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : date
}

const groups = new Intl.NumberFormat('ru-KZ', { useGrouping: 'always', maximumFractionDigits: 0 })

/** `12500` → `12,5`; `1000` → `1`; `1234567` → `1 234,567`. Thousandths, a comma, no trailing zeros. */
export function formatQty(qtyMilli: QtyMilli): string {
  const whole = Math.trunc(qtyMilli / 1000)
  const fraction = String(qtyMilli % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '')
  const head = groups.format(whole)
  return fraction === '' ? head : `${head},${fraction}`
}

/** `1600` → `16`; `1650` → `16,5`. Basis points as the percent figure printed next to НДС. */
export function formatRate(rateBp: BasisPoints): string {
  const whole = Math.trunc(rateBp / 100)
  const fraction = String(rateBp % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return fraction === '' ? String(whole) : `${whole},${fraction}`
}

/** `2026-10-19T09:05:00Z` in `Asia/Almaty` → `{ date: '19.10.2026', time: '14:05' }`. */
export function formatDateTime(timestamp: IsoTimestamp, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${part('day')}.${part('month')}.${part('year')}`, time: `${part('hour')}:${part('minute')}` }
}

/** The label of a tax number: ИИН for a person or an ИП, БИН for an organisation. */
export function taxIdLabel(party: Pick<ClientSnapshot, 'kind'> | Pick<CompanySnapshot, 'legalForm'>): MessageKey {
  if ('kind' in party) return party.kind === 'person' ? 'doc.id.iin' : 'doc.id.bin'
  if (party.legalForm === 'ip') return 'doc.id.iin'
  return party.legalForm === 'other' ? 'doc.id.binIin' : 'doc.id.bin'
}
