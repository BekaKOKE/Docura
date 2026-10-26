import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import { renderApp } from '../../test/renderApp'
import type { DocumentSummary } from '../../services'
import { documentBadge, documentPath } from './documentStatus'
import { Money } from './parts'

// The routes sit behind the sign-in (#15): render them as a signed-in user with a company.
const render = (url: string): string => renderApp(url)

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('S23 client card: first paint', () => {
  it('shows the card screen with a loading skeleton (AC 4, 5)', () => {
    const html = render('/clients/anything')
    expect(html).toContain('data-screen="S23"')
    expect(text(html)).toContain(t('clientCard.loading'))
  })
})

const doc = (patch: Partial<DocumentSummary>): DocumentSummary => ({
  id: 'd1',
  companyId: 'co',
  type: 'quote',
  status: 'sent',
  number: 'КП-2026-0001',
  issueDate: '2026-10-01',
  validUntil: null,
  dueDate: null,
  clientId: 'c1',
  clientName: 'Қайрат Әбілқасымов',
  sourceDocumentId: null,
  currency: 'KZT',
  netTiyn: 0,
  vatTiyn: 0,
  grossTiyn: 32393000,
  version: 1,
  issuedAt: null,
  signedAt: null,
  isExpired: false,
  payment: null,
  ...patch,
})

describe('document rows of the client card (AC 4)', () => {
  it('names the status of every kind of document', () => {
    expect(documentBadge(doc({ status: 'draft', number: null }))).toEqual({ label: 'Черновик', tone: 'neutral' })
    expect(documentBadge(doc({}))).toEqual({ label: 'Отправлен', tone: 'info' })
    expect(documentBadge(doc({ isExpired: true }))).toEqual({ label: 'Срок истёк', tone: 'warning' })
    expect(documentBadge(doc({ status: 'signed' }))).toEqual({ label: 'Подписан', tone: 'success' })
    expect(documentBadge(doc({ status: 'cancelled' })).label).toBe('Аннулирован')
    const invoice = { type: 'invoice', status: 'issued', grossTiyn: 10000 } as const
    expect(documentBadge(doc({ ...invoice, payment: { state: 'unpaid', paidTiyn: 0, balanceTiyn: 10000 } })).label).toBe('Ждёт оплаты')
    expect(documentBadge(doc({ ...invoice, payment: { state: 'partial', paidTiyn: 4000, balanceTiyn: 6000 } })).label).toBe('Оплачен на 40%')
    expect(documentBadge(doc({ ...invoice, payment: { state: 'paid', paidTiyn: 10000, balanceTiyn: 0 } })).tone).toBe('success')
    expect(documentBadge(doc({ ...invoice, payment: { state: 'overdue', paidTiyn: 0, balanceTiyn: 10000 } })).tone).toBe('danger')
    expect(documentBadge(doc({ type: 'act', status: 'issued' })).label).toBe('Выставлен')
    expect(documentBadge(doc({ type: 'act', status: 'signed' })).label).toBe('Подписан')
  })

  it('opens each document on its own screen', () => {
    expect(documentPath(doc({ id: 'q1' }))).toBe('/quotes/q1')
    expect(documentPath(doc({ id: 'q2', status: 'draft' }))).toBe('/quotes/q2/edit')
    expect(documentPath(doc({ id: 'i1', type: 'invoice' }))).toBe('/invoices/i1')
    expect(documentPath(doc({ id: 'a1', type: 'act' }))).toBe('/acts/a1')
  })

  it('writes an amount so that it never wraps and the tenge sign is not read as a letter', () => {
    const html = renderToString(<Money tiyn={32393000} />)
    expect(html).toContain('dc-money')
    expect(html).toContain('323 930')
    expect(html).toContain('aria-hidden="true"')
    expect(text(html)).toContain('тенге')
  })
})
