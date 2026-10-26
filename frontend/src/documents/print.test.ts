/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { printDocument } from './print'

// vite's ?raw import of a .css file gives an empty string under vitest, so the stylesheets are read from disk.
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const printCss = read('./print.css')
const shellCss = read('../styles/shell.css')

describe('print.css (#21 AC 5)', () => {
  it('prints on A4 with page margins', () => {
    expect(printCss).toMatch(/@page\s*\{[^}]*size:\s*A4/)
    expect(printCss).toMatch(/@page\s*\{[^}]*margin:\s*40pt/)
  })

  it('hides the app chrome: sidebar, top bar, tab bar, buttons, the dev panel', () => {
    const print = printCss.slice(printCss.indexOf('@media print'))
    for (const chrome of ['.sidebar', '.topbar', '.tabbar', '.segments-wrap', '.dev-launcher', '.no-print']) {
      expect(print, chrome).toContain(chrome)
    }
    expect(print).toMatch(/\{\s*display:\s*none\s*!important/)
  })

  it('only hides classes that the shell really has', () => {
    for (const chrome of ['.sidebar', '.topbar', '.tabbar', '.segments-wrap']) expect(shellCss, chrome).toContain(chrome)
  })

  it('takes the scale off the sheet, so it prints at 100 %', () => {
    expect(printCss).toMatch(/\.doc-scaled[^}]*transform:\s*none\s*!important/)
    expect(printCss).toMatch(/\.doc-sheet\s*\{[^}]*padding:\s*0/)
  })

  it('keeps the lines table together: rows do not split and the header repeats', () => {
    expect(printCss).toMatch(/\.doc-table tr[^{]*\{[^}]*break-inside:\s*avoid/)
    expect(printCss).toContain('display: table-header-group')
  })

  it('does not print the screen-reader word after the tenge sign', () => {
    expect(printCss).toMatch(/\.doc-sr-only\s*\{\s*display:\s*none/)
  })

  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(printCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(printCss).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })
})

describe('printDocument', () => {
  const listeners = new Map<string, () => void>()
  const doc = { title: 'Docura', fonts: { ready: Promise.resolve() } }
  const win = {
    print: vi.fn(() => {
      // The title is the file name Chrome suggests, so it is the document's while the dialog is open.
      printedTitle = doc.title
    }),
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  let printedTitle = ''

  afterEach(() => {
    vi.unstubAllGlobals()
    listeners.clear()
    win.print.mockClear()
    doc.title = 'Docura'
    doc.fonts = { ready: Promise.resolve() }
  })

  function stub() {
    vi.stubGlobal('document', doc)
    vi.stubGlobal('window', win)
  }

  it('opens the print dialog under the document number, then puts the page title back', async () => {
    stub()
    await printDocument('КП-2026-0001')
    expect(win.print).toHaveBeenCalledTimes(1)
    expect(printedTitle).toBe('КП-2026-0001')
    listeners.get('afterprint')?.()
    expect(doc.title).toBe('Docura')
    expect(listeners.has('afterprint')).toBe(false)
  })

  it('waits for the fonts before it prints', async () => {
    stub()
    let loaded = false
    doc.fonts = { ready: new Promise<void>((resolve) => setTimeout(() => ((loaded = true), resolve()), 20)) }
    win.print.mockImplementationOnce(() => {
      expect(loaded).toBe(true)
    })
    await printDocument()
    expect(win.print).toHaveBeenCalledTimes(1)
  })

  it('still prints when the fonts fail to load', async () => {
    stub()
    doc.fonts = { ready: Promise.reject(new Error('font')) }
    await printDocument()
    expect(win.print).toHaveBeenCalledTimes(1)
  })
})
