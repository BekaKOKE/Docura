/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DocumentRenderer } from './DocumentRenderer'
import { hasRenderer } from './renderers'
import { fitScale } from './scale'
import { plainText, referenceQuote, seedDocument } from './fixtures'
import { EditorWithPreview, PreviewPane } from './PreviewPane'

// vite's ?raw import of a .css file gives an empty string under vitest, so the stylesheet is read from disk.
const previewCss = readFileSync(new URL('./preview.css', import.meta.url), 'utf8')

// A4 is 595 pt = 793.33 px wide.
const PAGE = 793

describe('fitScale', () => {
  it('shrinks the sheet to the width of its box', () => {
    expect(fitScale(328, PAGE)).toBeCloseTo(0.4135, 3) // a 360 px phone: 328 px between the gutters
    expect(fitScale(520, PAGE)).toBeCloseTo(0.6557, 3) // the desktop preview pane
  })

  it('never enlarges the sheet past its real size', () => {
    expect(fitScale(1200, PAGE)).toBe(1)
    expect(fitScale(PAGE, PAGE)).toBe(1)
  })

  it('stays at 1 while the sizes are unknown', () => {
    expect(fitScale(0, PAGE)).toBe(1)
    expect(fitScale(328, 0)).toBe(1)
    expect(fitScale(Number.NaN, PAGE)).toBe(1)
  })
})

describe('DocumentRenderer', () => {
  it('draws a quote and an invoice, and has nothing for an act yet (#31)', () => {
    expect(hasRenderer('quote')).toBe(true)
    expect(hasRenderer('invoice')).toBe(true)
    expect(hasRenderer('act')).toBe(false)
    expect(renderToString(<DocumentRenderer type="act" document={referenceQuote()} />)).toBe('')
    expect(plainText(renderToString(<DocumentRenderer type="quote" document={referenceQuote()} />))).toContain(
      'Коммерческое предложение',
    )
    expect(plainText(renderToString(<DocumentRenderer type="invoice" document={seedDocument('СЧ-2026-0001')} />))).toContain(
      'Счёт на оплату',
    )
  })
})

describe('EditorWithPreview (the slot #19 fills)', () => {
  const html = renderToString(
    <EditorWithPreview preview={{ type: 'quote', document: referenceQuote() }}>
      <form>форма редактора</form>
    </EditorWithPreview>,
  )

  it('puts the form and the preview side by side', () => {
    expect(html).toContain('doc-split-form')
    expect(html).toContain('форма редактора')
    expect(html).toContain('doc-split-pane')
    expect(html).toContain('doc-pane')
    expect(plainText(html)).toContain('Коммерческое предложение № КП-2026-0001')
  })

  it('names the pane for a screen reader', () => {
    expect(html).toContain('aria-label="Живой предпросмотр документа"')
    expect(renderToString(<PreviewPane type="quote" document={referenceQuote()} />)).toContain('<aside')
  })

  it('shows the pane from 1024 px as a sticky 520 px column', () => {
    const wide = previewCss.slice(previewCss.indexOf('@media (min-width: 1024px)'))
    expect(wide).toContain('position: sticky')
    expect(wide).toContain('width: var(--dc-layout-preview-pane)')
    expect(wide).toContain('var(--dc-layout-preview-pane)')
    // Below 1024 px the pane is not shown (the phone has its own screen).
    expect(previewCss.slice(0, previewCss.indexOf('@media'))).toMatch(/\.doc-split-pane\s*\{\s*display:\s*none/)
  })
})

describe('preview.css', () => {
  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(previewCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(previewCss).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })

  it('scrolls a zoomed sheet inside its own box, never the page', () => {
    expect(previewCss).toMatch(/\[data-zoom='actual'\]\s*\{\s*overflow-x:\s*auto/)
    expect(previewCss).toMatch(/\[data-zoom='fit'\]\s*\{\s*overflow:\s*hidden/)
  })
})
