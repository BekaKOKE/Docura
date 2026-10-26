/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { plainText, seedDocument } from '../documents/fixtures'
import { t } from '../i18n/t'
import { ApiError, type Document } from '../services'
import { PreviewError, PreviewLoading, PreviewNotBuilt, PreviewReady } from './DocumentPreview'

// vite's ?raw import of a .css file gives an empty string under vitest, so the stylesheet is read from disk.
const previewCss = readFileSync(new URL('./preview.css', import.meta.url), 'utf8')

const html = (node: React.ReactNode) => renderToString(<MemoryRouter>{node}</MemoryRouter>)
const noop = () => {}

// The seed row is a full Document for everything the screen reads.
const quote = () => seedDocument('КП-2026-0001') as unknown as Document & { type: 'quote' }

describe('S08 preview: loading (AC 4)', () => {
  it('shows a sheet-shaped skeleton and says it is loading', () => {
    const out = html(<PreviewLoading />)
    expect(out).toContain('data-screen="S08"')
    expect(out).toContain('role="status"')
    expect(out).toContain('aria-busy="true"')
    expect(plainText(out)).toContain(t('preview.loading'))
  })
})

describe('S08 preview: error', () => {
  it('shows the service sentence and a Повторить button', () => {
    const error = new ApiError({ code: 'not_found', message: t('apiError.not_found') })
    const out = html(<PreviewError error={error} onRetry={noop} />)
    expect(out).toContain('data-screen="S08"')
    expect(out).toContain('role="alert"')
    expect(plainText(out)).toContain('Не удалось открыть документ')
    expect(plainText(out)).toContain('Не найдено. Возможно, это удалили.')
    expect(plainText(out)).toContain('Повторить')
    expect(out).not.toContain('href="/login"')
  })

  it('offers the sign-in screen when the session is gone', () => {
    const error = new ApiError({ code: 'unauthorized', message: t('apiError.unauthorized') })
    const out = html(<PreviewError error={error} onRetry={noop} />)
    expect(plainText(out)).toContain('Нужно войти в аккаунт.')
    expect(out).toContain('href="/login"')
  })

  it('has a general sentence for a failure that is not an ApiError', () => {
    expect(plainText(html(<PreviewError error={new Error('boom')} onRetry={noop} />))).toContain(
      'Что-то пошло не так. Попробуйте ещё раз.',
    )
  })
})

describe('S08 preview: the document', () => {
  it('draws the quote on its sheet with the two actions in the bar (AC 4, AC 5)', () => {
    const out = html(<PreviewReady document={quote()} zoom="fit" onZoom={noop} onPrint={noop} />)
    expect(out).toContain('data-screen="S08"')
    expect(out).toContain('data-zoom="fit"')
    expect(plainText(out)).toContain('Коммерческое предложение № КП-2026-0001')
    expect(plainText(out)).toContain('Скачать PDF')
    expect(plainText(out)).toContain('Крупнее')
    // The bar is app chrome: print.css hides it.
    expect(out).toContain('pv-bar no-print')
    // Two buttons side by side at most (components.md §0).
    expect(out.match(/<button/g)?.length).toBe(2)
  })

  it('offers to fit the sheet back when it is shown at real size', () => {
    const out = html(<PreviewReady document={quote()} zoom="actual" onZoom={noop} onPrint={noop} />)
    expect(out).toContain('data-zoom="actual"')
    expect(plainText(out)).toContain('Вписать в экран')
  })

  it('draws an invoice with the same screen', () => {
    const invoice = seedDocument('СЧ-2026-0001') as unknown as Document
    const out = html(<PreviewReady document={{ ...invoice, type: 'invoice' }} zoom="fit" onZoom={noop} onPrint={noop} />)
    expect(plainText(out)).toContain('Счёт на оплату № СЧ-2026-0001')
  })

  it('says the act preview is not built yet instead of showing a blank page', () => {
    expect(plainText(html(<PreviewNotBuilt />))).toContain('Предпросмотр акта появится в задаче #31.')
  })
})

describe('preview.css', () => {
  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(previewCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(previewCss).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })

  it('makes the action buttons 56 px on a phone and puts at most two side by side', () => {
    expect(previewCss).toMatch(/\.pv-bar \.btn\s*\{\s*min-height:\s*var\(--dc-size-control-lg\)/)
    expect(previewCss).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  })
})
