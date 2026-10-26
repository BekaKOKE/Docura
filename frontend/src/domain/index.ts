// Pure business rules: no React, no network. Shared test vectors live in contracts/test-vectors/.
export { amountInWords } from './amountInWords'
export { isValidIinBin, validateIinBin } from './binIin'
export { isValidIik, validateIik } from './iik'
export { formatMoney, parsePriceTiyn, parseQuantityMilli } from './money'
export type { MoneyFormatMode, QtyMilli, Tiyn } from './money'
export { validateKbe, validateKnp } from './requisites'
export { searchKey } from './searchKey'
export { computeLine, computePrepayment, computeTotals, splitGross } from './totals'
export type {
  DocumentTotals,
  LineInput,
  LineTotals,
  PrepaymentError,
  PrepaymentInput,
  PrepaymentResult,
  VatSetting,
} from './totals'
export type { Validation } from './validation'
