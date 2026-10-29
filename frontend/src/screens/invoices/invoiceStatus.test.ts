import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import type { DocumentSummary, PaymentState } from '../../services'
import { daysOverdue, invoiceBadge, isPartlyPaid, owesMoney, percentPaid, shortDate, waitingOf } from './invoiceStatus'

// What the invoice screens say about the payment state (#28 AC 1, 2). Days are counted in Asia/Almaty.

function invoice(state: PaymentState, gross: number, paid: number, patch: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: `i-${state}-${gross}-${paid}`,
    type: 'invoice',
    status: 'issued',
    number: 'СЧ-2026-0001',
    dueDate: '2026-10-13',
    grossTiyn: gross,
    payment: { state, paidTiyn: paid, balanceTiyn: gross - paid },
    ...patch,
  } as DocumentSummary
}

describe('daysOverdue (TC-3)', () => {
  it('counts calendar days in Almaty: 00:30 on 21.10 there is still 20.10 in UTC', () => {
    expect(daysOverdue('2026-10-13', new Date('2026-10-20T19:30:00Z'))).toBe(8)
  })

  it('counts 7 days on 20.10 in the afternoon, Almaty time', () => {
    expect(daysOverdue('2026-10-13', new Date('2026-10-20T10:00:00Z'))).toBe(7)
  })

  it('is 0 on the due date, before it, and with no due date', () => {
    expect(daysOverdue('2026-10-13', new Date('2026-10-13T10:00:00Z'))).toBe(0)
    expect(daysOverdue('2026-10-13', new Date('2026-10-01T10:00:00Z'))).toBe(0)
    expect(daysOverdue(null, new Date('2026-10-20T10:00:00Z'))).toBe(0)
  })

  it('counts the end of the day in Almaty, not in UTC', () => {
    // 18:30 UTC on 19.10 is 23:30 in Almaty: still 19.10, so one day after 18.10.
    expect(daysOverdue('2026-10-18', new Date('2026-10-19T18:30:00Z'))).toBe(1)
    // 19:30 UTC is 00:30 on 20.10 there: two days.
    expect(daysOverdue('2026-10-18', new Date('2026-10-19T19:30:00Z'))).toBe(2)
  })
})

describe('invoiceBadge (AC 2)', () => {
  const now = new Date('2026-10-20T10:00:00Z')

  it('says how late an overdue invoice is', () => {
    expect(invoiceBadge(invoice('overdue', 1_000_000, 0), now)).toEqual({ label: 'Просрочен 7 дн.', tone: 'danger' })
  })

  it('says how much of a partly paid one is paid', () => {
    expect(invoiceBadge(invoice('partial', 10_000_000, 4_000_000, { dueDate: '2026-10-25' }), now)).toEqual({
      label: 'Оплачен на 40%',
      tone: 'warning',
    })
  })

  it('says a paid invoice is paid, and an unpaid one waits', () => {
    expect(invoiceBadge(invoice('paid', 100, 100), now).label).toBe(t('docStatus.invoice.paid'))
    expect(invoiceBadge(invoice('unpaid', 100, 0, { dueDate: '2026-10-25' }), now).label).toBe(t('docStatus.invoice.issued'))
  })
})

describe('a draft or a cancelled invoice is never late or partly paid (review of #28)', () => {
  const now = new Date('2026-10-20T10:00:00Z')

  it.each(['draft', 'cancelled'] as const)('shows the shared words, not "Просрочен", for a %s one past its due date', (status) => {
    const badge = invoiceBadge(invoice('overdue', 1_000_000, 0, { status }), now)
    expect(badge.label).not.toMatch(/Просрочен/)
    expect(badge.label).toBe(t(status === 'draft' ? 'docStatus.draft' : 'docStatus.cancelled'))
    expect(isPartlyPaid(invoice('partial', 100, 40, { status }))).toBe(false)
  })

  it('never says "0 дн." for an invoice the data calls overdue', () => {
    // The state was computed on the day it fell due; the screen's clock still says the due date itself.
    expect(invoiceBadge(invoice('overdue', 100, 0, { dueDate: '2026-10-20' }), now).label).toBe('Просрочен 1 дн.')
  })
})

describe('the percent never contradicts the money (review of #28)', () => {
  it('is 99 % while a few tiyn are owed, and 1 % after the first few tiyn', () => {
    expect(percentPaid(invoice('partial', 100_000, 99_600))).toBe(99)
    expect(percentPaid(invoice('partial', 100_000, 100))).toBe(1)
    expect(invoiceBadge(invoice('partial', 100_000, 99_600, { dueDate: '2026-12-01' }), new Date('2026-10-20T10:00:00Z')).label).toBe('Оплачен на 99%')
  })

  it('is 100 % only when nothing is owed', () => {
    expect(percentPaid(invoice('paid', 100_000, 100_000))).toBe(100)
  })
})

describe('owesMoney', () => {
  it('is true for unpaid, partly paid and overdue issued invoices only', () => {
    expect(owesMoney(invoice('unpaid', 100, 0))).toBe(true)
    expect(owesMoney(invoice('partial', 100, 40))).toBe(true)
    expect(owesMoney(invoice('overdue', 100, 0))).toBe(true)
    expect(owesMoney(invoice('paid', 100, 100))).toBe(false)
    expect(owesMoney(invoice('unpaid', 100, 0, { status: 'draft' }))).toBe(false)
    expect(owesMoney(invoice('unpaid', 100, 0, { status: 'cancelled' }))).toBe(false)
    expect(owesMoney({ status: 'issued', payment: null })).toBe(false)
  })
})

describe('percentPaid and isPartlyPaid', () => {
  it('is the share paid, rounded', () => {
    expect(percentPaid(invoice('partial', 10_000_000, 4_000_000))).toBe(40)
    expect(percentPaid(invoice('partial', 3, 1))).toBe(33)
    expect(percentPaid(invoice('paid', 100, 100))).toBe(100)
    expect(percentPaid(invoice('unpaid', 100, 0))).toBe(0)
    expect(percentPaid({ grossTiyn: 0, payment: null })).toBe(0)
  })

  it('shows a bar only while something is paid and something is owed', () => {
    expect(isPartlyPaid(invoice('partial', 100, 40))).toBe(true)
    expect(isPartlyPaid(invoice('overdue', 100, 40))).toBe(true)
    expect(isPartlyPaid(invoice('unpaid', 100, 0))).toBe(false)
    expect(isPartlyPaid(invoice('paid', 100, 100))).toBe(false)
  })
})

describe('waitingOf (the strip, AC 1)', () => {
  it('adds up what is owed on unpaid, partly paid and overdue invoices, and what part of it is late (TC-1)', () => {
    const a = invoice('unpaid', 16_196_500, 0, { dueDate: '2026-10-25' }) // 161 965 ₸, unpaid
    const b = invoice('partial', 10_000_000, 4_000_000, { dueDate: '2026-10-25' }) // 100 000 ₸ with 40 000 paid
    const x = invoice('overdue', 5_000_000, 1_000_000) // 50 000 ₸ with 10 000 paid, overdue
    const paid = invoice('paid', 9_000_000, 9_000_000)
    expect(waitingOf([a, b, x, paid])).toEqual({ waitingTiyn: 16_196_500 + 6_000_000 + 4_000_000, overdueTiyn: 4_000_000 })
  })

  it('counts nothing for drafts, cancelled invoices and a list with nothing owed', () => {
    expect(waitingOf([invoice('unpaid', 100, 0, { status: 'draft' }), invoice('unpaid', 100, 0, { status: 'cancelled' })])).toEqual({ waitingTiyn: 0, overdueTiyn: 0 })
    expect(waitingOf([])).toEqual({ waitingTiyn: 0, overdueTiyn: 0 })
  })
})

describe('shortDate', () => {
  it('is day and month', () => {
    expect(shortDate('2026-10-24')).toBe('24.10')
    expect(shortDate('2026-01-05')).toBe('05.01')
  })
})
