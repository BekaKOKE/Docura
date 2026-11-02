// What the record-payment sheet decides on its own (#30), as pure functions: what an amount means against the balance,
// the label of the save button, the method remembered between payments, the swipe on a row, the request key.
// The sheet (RecordPaymentSheet.tsx) only draws these.

import { formatMoney } from '../../domain'
import { parsePriceInput } from '../../domain/article'
import { t } from '../../i18n/t'
import type { PaymentMethod, Tiyn } from '../../services'

/** The order of the chips: components.md "Record payment sheet". */
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'kaspi', 'transfer', 'card', 'other']
/** The method chosen when none was ever used. */
export const DEFAULT_METHOD: PaymentMethod = 'cash'
export const NOTE_MAX = 500
/** How long "Оплата записана · Отменить" stays on screen (components.md, Toast). */
export const UNDO_MS = 8000
/** How long a plain notice ("Оплата отменена") stays. */
export const NOTICE_MS = 4000

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value)
}

// ---------------------------------------------------------------- the amount

export type AmountCheck =
  | { ok: true; tiyn: Tiyn }
  | { ok: false; kind: 'required' | 'format' | 'over'; message: string }

/**
 * What the typed amount means for an invoice with `balanceTiyn` left. Zero and an empty field are "Укажите сумму"; letters
 * and a minus are refused with an example; more than the balance says by how much ("Больше остатка на 12 000 ₸").
 */
export function checkAmount(text: string, balanceTiyn: Tiyn): AmountCheck {
  const parsed = parsePriceInput(text)
  if (!parsed.ok) {
    const required = parsed.error === 'article.error.priceRequired'
    return required
      ? { ok: false, kind: 'required', message: t('pm.error.amountRequired') }
      : { ok: false, kind: 'format', message: t('pm.error.amountFormat') }
  }
  if (parsed.tiyn <= 0) return { ok: false, kind: 'required', message: t('pm.error.amountRequired') }
  if (parsed.tiyn > balanceTiyn) {
    return { ok: false, kind: 'over', message: t('pm.error.overpayment', { amount: formatMoney(parsed.tiyn - balanceTiyn) }) }
  }
  return { ok: true, tiyn: parsed.tiyn }
}

/** "Записать 147 840 ₸": the label follows the amount; "Записать" while the amount is not one yet. */
export function submitLabel(text: string, balanceTiyn: Tiyn): string {
  const check = checkAmount(text, balanceTiyn)
  return check.ok ? t('pm.submit.amount', { amount: formatMoney(check.tiyn) }) : t('pm.submit')
}

// ---------------------------------------------------------------- the method remembered between payments

export const LAST_METHOD_KEY = 'docura.payments.lastMethod'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** `localStorage` when the browser lets us at it (it throws in some private modes and does not exist outside a browser). */
function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** The method used last, or null when none was saved or the browser keeps nothing. */
export function readLastMethod(storage: StorageLike | null = browserStorage()): PaymentMethod | null {
  try {
    const value = storage?.getItem(LAST_METHOD_KEY)
    return isPaymentMethod(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers the method for the next payment. A full or blocked storage is not an error: the next sheet starts with cash. */
export function rememberMethod(method: PaymentMethod, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(LAST_METHOD_KEY, method)
  } catch {
    // Quota or blocked storage: nothing to do.
  }
}

// ---------------------------------------------------------------- the swipe on a row

/** A swipe to the left, far enough and flatter than steep, so scrolling the list up and down never counts. */
export function isSwipeLeft(dx: number, dy: number): boolean {
  return dx <= -64 && Math.abs(dy) <= 32 && Math.abs(dx) >= 2 * Math.abs(dy)
}
