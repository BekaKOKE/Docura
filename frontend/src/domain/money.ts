// Money in integer tiyn (1 ₸ = 100 tiyn), quantities in thousandths, rates in basis points.
// No floating-point arithmetic: text is parsed digit by digit, products and divisions run on BigInt,
// and a result that is not a safe integer throws instead of silently losing precision.

export type Tiyn = number
export type QtyMilli = number

const TIYN_PER_TENGE = 100
const MILLI_PER_UNIT = 1000

// Digits of the integer part we accept; keeps every parsed value a safe integer.
const MAX_QTY_INT_DIGITS = 9
const MAX_PRICE_INT_DIGITS = 12

// Group separators a user may type: space, no-break space (U+00A0), narrow no-break space (U+202F), thin space.
const GROUP_SPACES = /[\s   ]+/g

function parseDecimal(
  text: string,
  maxIntDigits: number,
  maxFractionDigits: number,
  fractionScale: number,
): number | null {
  const compact = text.replace(GROUP_SPACES, '')
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(compact)
  if (!match) return null
  const intPart = match[1].replace(/^0+(?=\d)/, '')
  const fraction = match[2] ?? ''
  if (intPart.length > maxIntDigits || fraction.length > maxFractionDigits) return null
  const padded = fraction.padEnd(maxFractionDigits, '0')
  return Number(BigInt(intPart) * BigInt(fractionScale) + BigInt(padded === '' ? '0' : padded))
}

// "12,5" / "12.5" / "0,125" → 12500 / 12500 / 125. Up to 3 decimals. null for negatives, letters, empty.
export function parseQuantityMilli(text: string): QtyMilli | null {
  return parseDecimal(text, MAX_QTY_INT_DIGITS, 3, MILLI_PER_UNIT)
}

// "18 500" / "18 500" (U+00A0) / "18500,50" → 1850000 / 1850000 / 1850050. Up to 2 decimals.
export function parsePriceTiyn(text: string): Tiyn | null {
  return parseDecimal(text, MAX_PRICE_INT_DIGITS, 2, TIYN_PER_TENGE)
}

// Integer division that rounds half up. The numerator must not be negative.
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError('divRoundHalfUp expects a non-negative numerator and a positive denominator')
  }
  return (2n * numerator + denominator) / (2n * denominator)
}

// Back from BigInt to a number; throws when the value would not be exact.
export function toSafeTiyn(value: bigint): Tiyn {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Amount does not fit into a safe integer of tiyn')
  }
  return Number(value)
}

export function assertTiyn(value: number): void {
  if (!Number.isSafeInteger(value)) throw new RangeError('Tiyn must be a safe integer')
}

export type MoneyFormatMode = 'ui' | 'document'

// 123456 → "1234.56", 100 → "1.00": an exact decimal string for Intl, built from integer parts only.
function tiynToDecimalString(tiyn: Tiyn): `${number}` {
  const abs = BigInt(tiyn) < 0n ? -BigInt(tiyn) : BigInt(tiyn)
  const tenge = abs / BigInt(TIYN_PER_TENGE)
  const rest = abs % BigInt(TIYN_PER_TENGE)
  const sign = tiyn < 0 ? '-' : ''
  return `${sign}${tenge}.${rest.toString().padStart(2, '0')}` as `${number}`
}

const withoutTiyn = new Intl.NumberFormat('ru-KZ', {
  style: 'currency',
  currency: 'KZT',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: 'always',
})
const withTiyn = new Intl.NumberFormat('ru-KZ', {
  style: 'currency',
  currency: 'KZT',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
})

// UI: "1 250 000 ₸", tiyn only when non-zero ("123,45 ₸"). Document: always "1 250 000,00 ₸".
// Group separators and the gap before ₸ are U+00A0, so an amount never wraps.
export function formatMoney(tiyn: Tiyn, mode: MoneyFormatMode = 'ui'): string {
  assertTiyn(tiyn)
  const showTiyn = mode === 'document' || tiyn % TIYN_PER_TENGE !== 0
  return (showTiyn ? withTiyn : withoutTiyn).format(tiynToDecimalString(tiyn))
}
