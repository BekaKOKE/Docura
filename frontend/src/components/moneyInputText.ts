// The text of a MoneyInput after it loses focus (components.md "MoneyInput": formats with NBSP on blur).
// Only a price that parses is rewritten; a typo stays exactly as typed, so the user can fix it.

import { formatMoney, parsePriceTiyn } from '../domain/money'

/** "18500" → "18 500" (U+00A0 between groups), "18500,5" → "18 500,50". Anything that isn't a price is returned as it was. */
export function formatMoneyInputText(text: string): string {
  const tiyn = parsePriceTiyn(text)
  if (tiyn === null) return text
  // formatMoney is the one place that groups digits; the ₸ is drawn next to the field, not typed into it.
  return formatMoney(tiyn).replace(/\s*₸$/, '')
}
