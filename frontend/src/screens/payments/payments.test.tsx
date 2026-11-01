import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { todayInZone } from '../../domain/dates'
import { t } from '../../i18n/t'
import type { Payment } from '../../services'
import { withClient } from '../../test/renderApp'
import { InvoiceMenuSheet } from './InvoiceMenuSheet'
import { PaymentToast } from './PaymentToast'
import { RecordPaymentSheet, type PayableInvoice } from './RecordPaymentSheet'
import { RemovePaymentSheet } from './RemovePaymentSheet'

// The record-payment sheet, the row menu, the remove confirmation and the toast (#30). Rendered to a string like the
// other screens' tests; the interaction (a tap, the clock) is covered by the pure rules and the mock's tests.

// What a person sees: the words kept for screen readers ("тенге" after an amount) are left out.
const text = (html: string) =>
  html
    .replace(/<span class="cl-sr-only">.*?<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const noop = () => {}

// TC-2: invoice 161 965 ₸, nothing paid yet.
const fresh: PayableInvoice = {
  id: 'i-1',
  number: 'СЧ-2026-0014',
  grossTiyn: 16_196_500,
  payment: { state: 'unpaid', paidTiyn: 0, balanceTiyn: 16_196_500 },
}
// A part is paid: 64 786 ₸ of 161 965 ₸.
const partly: PayableInvoice = { ...fresh, payment: { state: 'partial', paidTiyn: 6_478_600, balanceTiyn: 9_717_900 } }

const sheet = (invoice: PayableInvoice) => renderToString(withClient(<RecordPaymentSheet invoice={invoice} timeZone="Asia/Almaty" onClose={noop} onRecorded={noop} />))

describe('the record-payment sheet (AC 2, TC-2)', () => {
  const html = sheet(fresh)
  const visible = text(html)

  it('is titled "Оплата по СЧ-…" and says what is left of what', () => {
    expect(html).toContain('role="dialog"')
    expect(visible).toContain('Оплата по СЧ-2026-0014')
    expect(visible).toContain('Остаток 161 965 ₸ из 161 965 ₸')
  })

  it('says what is left after a part was paid', () => {
    expect(text(sheet(partly))).toContain('Остаток 97 179 ₸ из 161 965 ₸')
  })

  it('starts the amount at the balance, in a field that takes the decimal keypad', () => {
    expect(html).toMatch(/<input[^>]*id="pm-amount"[^>]*inputMode="decimal"[^>]*value="161\s965"/)
    expect(sheet(partly)).toMatch(/<input[^>]*id="pm-amount"[^>]*value="97\s179"/)
  })

  it('offers Наличные, Kaspi, Перевод, Карта, Другое as one group of choices', () => {
    expect(html).toMatch(/role="radiogroup"[^>]*aria-labelledby="pm-method-label"/)
    const labels = [...html.matchAll(/class="pm-chip-tile">([^<]+)</g)].map((m) => m[1])
    expect(labels).toEqual(['Наличные', 'Kaspi', 'Перевод', 'Карта', 'Другое'])
    expect(html.match(/name="pm-method"/g)).toHaveLength(5)
    // Nothing was used before, so cash is the one chosen.
    expect(html).toMatch(/checked=""\s+value="cash"/)
  })

  it('starts the date at today in the company zone, in a date field', () => {
    const today = todayInZone('Asia/Almaty', new Date())
    expect(html).toMatch(new RegExp(`<input[^>]*type="date"[^>]*value="${today}"`))
  })

  it('has an optional comment', () => {
    expect(visible).toContain(`${t('pm.note.label')} ${t('form.optional')}`)
    expect(html).toMatch(/<input[^>]*maxLength="500"[^>]*id="pm-note"/)
  })

  it('has one primary button whose label follows the amount: "Записать 161 965 ₸"', () => {
    expect(html.match(/<button[^>]*type="submit"/g)).toHaveLength(1)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*btn-primary[^>]*>\s*<span class="dc-label">Записать 161\s965\s₸<\/span>/)
    expect(visible).toContain('Записать 161 965 ₸')
  })

  it('shows no error before anything is typed', () => {
    expect(html).not.toContain('field-error')
    expect(html).not.toContain('role="alert"')
  })

  it('keeps amounts on one line', () => {
    expect(html).toContain('class="dc-money"')
  })
})

describe('the remove confirmation', () => {
  const payment: Payment = { id: 'p-1', companyId: 'c-1', documentId: 'i-1', amountTiyn: 6_478_600, currency: 'KZT', method: 'kaspi', paidOn: '2026-10-18', note: null }
  const html = renderToString(withClient(<RemovePaymentSheet payment={payment} onClose={noop} onRemoved={noop} />))

  it('asks first, names the payment and offers two buttons: keep and delete', () => {
    const visible = text(html)
    expect(visible).toContain(t('pm.remove.title'))
    expect(visible).toContain('Оплата 64 786 ₸ от 18.10.2026')
    expect(html.match(/<button[^>]*type="button"[^>]*class="btn /g)).toHaveLength(2)
    expect(visible).toContain(t('pm.remove.keep'))
    expect(visible).toContain(t('pm.remove.confirm'))
  })
})

describe('the menu of a row (AC 1, TC-1, TC-8)', () => {
  const html = renderToString(
    withClient(
      <StaticRouter location="/documents/invoices">
        <InvoiceMenuSheet invoice={partly} onClose={noop} onRecord={noop} />
      </StaticRouter>,
    ),
  )
  const visible = text(html)

  it('has "Записать оплату" with the balance, and a way into the card', () => {
    expect(visible).toContain('Счёт СЧ-2026-0014')
    expect(html).toMatch(/<button[^>]*class="sheet-row"[^>]*>[\s\S]*?Записать оплату/)
    expect(visible).toContain('Остаток 97 179 ₸')
    expect(html).toContain('href="/invoices/i-1"')
  })
})

describe('the toast (AC 4, TC-4)', () => {
  it('hides under an open sheet, so a tap meant for the sheet cannot undo the payment (AC 1)', () => {
    const toast = { id: 3, kind: 'recorded', paymentId: 'p-1', invoiceId: 'i-1' } as const
    expect(renderToString(withClient(<PaymentToast toast={toast} onDismiss={() => {}} covered />))).toContain('data-covered="true"')
    expect(renderToString(withClient(<PaymentToast toast={toast} onDismiss={() => {}} />))).not.toContain('data-covered')
  })

  it('says "Оплата записана" with an "Отменить" button', () => {
    const html = renderToString(withClient(<PaymentToast toast={{ id: 1, kind: 'recorded', paymentId: 'p-1', invoiceId: 'i-1' }} onDismiss={noop} />))
    expect(text(html)).toBe('Оплата записана Отменить')
    expect(html).toMatch(/<div class="pm-toast" role="status">/)
    expect(html).toMatch(/<button[^>]*class="pm-toast-action"[^>]*>\s*<span class="dc-label">Отменить<\/span>/)
  })

  it('is a plain notice, with nothing to undo, after a removal', () => {
    const html = renderToString(withClient(<PaymentToast toast={{ id: 2, kind: 'notice', text: t('pm.toast.removed') }} onDismiss={noop} />))
    expect(text(html)).toBe('Оплата удалена')
    expect(html).not.toContain('<button')
  })
})

describe('the payment files follow the design rules (components.md §0)', () => {
  const css = read('./payments.css')
  const sources = ['./RecordPaymentSheet.tsx', './RemovePaymentSheet.tsx', './InvoiceMenuSheet.tsx', './PaymentToast.tsx', './paymentRules.ts', './paymentQueries.ts'].map(read).join('\n')

  it('uses tokens only: no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl)\(/)
  })

  it('keeps the grids shrinkable, the chips and the toast button at 48 px, and at most two buttons side by side', () => {
    expect(css).toContain('minmax(0, 1fr)')
    const rule = (selector: string) => {
      const from = css.indexOf(`${selector} {`)
      return css.slice(from, css.indexOf('}', from))
    }
    expect(rule('.pm-chip-tile')).toContain('min-height: var(--dc-size-touch-min)')
    expect(rule('.pm-toast-action')).toContain('min-height: var(--dc-size-touch-min)')
    expect(rule('.pm-toast-action')).toContain('min-width: var(--dc-size-touch-min)')
    expect(rule('.pm-pair')).toContain('repeat(2, minmax(0, 1fr))')
  })

  it('sends every visible string through t()', () => {
    expect(sources).not.toMatch(/>\s*[А-Яа-яЁё][^<{]*</)
    expect(sources).not.toMatch(/(placeholder|aria-label|title|alt)="[А-Яа-яЁё]/)
  })

  it('writes no money as a float', () => {
    expect(sources).not.toMatch(/parseFloat|toFixed/)
  })
})
