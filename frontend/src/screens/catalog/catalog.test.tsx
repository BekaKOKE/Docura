import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { t } from '../../i18n/t'

function render(url: string): string {
  return renderToString(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [url] })} />)
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('S24 catalogue: first paint', () => {
  const html = render('/catalog')

  it('is the catalogue screen, not the placeholder, with a labelled search field and the kind filter', () => {
    expect(html).toContain('data-screen="S24"')
    expect(html).toContain(`aria-label="${t('catalog.search.label')}"`)
    expect(html).toContain('type="search"')
    const visible = text(html)
    expect(visible).toContain(t('catalog.filter.service'))
    expect(visible).toContain(t('catalog.filter.material'))
    expect(html).toContain('aria-pressed="false"')
  })

  it('shows the loading skeleton before the list arrives (AC 5)', () => {
    expect(html).toContain('cl-skeleton')
    expect(text(html)).toContain(t('catalog.loading'))
    expect(html).toContain('aria-busy="true"')
  })
})

describe('catalog.css', () => {
  const css = read('./catalog.css')

  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(css.length).toBeGreaterThan(200)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })

  it('lets a long title wrap in a shrinking column and keeps the price column at its own width (TC-6)', () => {
    expect(css).toMatch(/\.ct-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(css).toMatch(/\.ct-row-title \{[^}]*overflow-wrap: anywhere/)
    expect(css).toMatch(/\.ct-nowrap \{[^}]*white-space: nowrap/)
  })
})
