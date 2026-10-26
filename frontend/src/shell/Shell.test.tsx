import { renderToString } from 'react-dom/server'
import { createMemoryRouter, StaticRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { shellModeOf } from '../app/nav'
import { routes } from '../app/routes'
import { screens } from '../app/screens'
import { t } from '../i18n/t'
import { renderApp, withClient } from '../test/renderApp'
import { CreateSheet, MoreSheet } from './ActionSheets'

const render = (url: string): string => renderApp(url)

const text = (html: string) => html.replace(/<[^>]+>/g, '').trim()

/** The visible text of every link or button marked aria-current="page". */
function current(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>(.*?)<\/a>/g)].map((m) => text(m[1]))
}

/** The part of the page inside <tag class="name" ...>…</tag>, or '' when it is missing. */
function region(html: string, tag: string, name: string): string {
  const start = html.indexOf(`<${tag} class="${name}"`)
  if (start < 0) return ''
  return html.slice(start, html.indexOf(`</${tag}>`, start))
}

describe('TabBar', () => {
  it('shows home, documents, [+], clients, more in this order', () => {
    const bar = region(render('/'), 'nav', 'tabbar')
    const order = [t('nav.home'), t('nav.documents'), `aria-label="${t('nav.create')}"`, t('nav.clients'), t('nav.more')]
    const positions = order.map((part) => bar.indexOf(part))
    expect(positions.every((i) => i >= 0), order.join(' | ')).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('marks the current tab, and More for catalogue and company', () => {
    expect(current(region(render('/'), 'nav', 'tabbar'))).toEqual([t('nav.home')])
    expect(current(region(render('/documents/invoices'), 'nav', 'tabbar'))).toEqual([t('nav.documents')])
    expect(current(region(render('/clients/demo'), 'nav', 'tabbar'))).toEqual([t('nav.clients')])
    expect(region(render('/catalog'), 'nav', 'tabbar')).toMatch(/class="tab tab-current"/)
  })

  it('lets the Documents tab reopen the segment the user is in', () => {
    const bar = region(render('/invoices/demo'), 'nav', 'tabbar')
    expect(bar).toContain('href="/documents/invoices"')
    expect(region(render('/'), 'nav', 'tabbar')).toContain('href="/documents/quotes"')
  })

  it('keeps the [+] closed until it is tapped', () => {
    const html = render('/')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('role="dialog"')
  })
})

describe('Sidebar', () => {
  it('lists the seven sections and a create button', () => {
    const side = region(render('/'), 'aside', 'sidebar')
    for (const key of ['nav.home', 'nav.quotes', 'nav.invoices', 'nav.acts', 'nav.clients', 'nav.catalog', 'nav.company'] as const) {
      expect(side, key).toContain(t(key))
    }
    expect(side).toContain(t('nav.createQuote'))
    expect(side).toContain('href="/quotes/new"')
  })

  it('marks one section as current', () => {
    expect(current(region(render('/documents/acts'), 'aside', 'sidebar'))).toEqual([t('nav.acts')])
    expect(current(region(render('/settings/company'), 'aside', 'sidebar'))).toEqual([t('nav.company')])
    expect(current(region(render('/quotes/demo'), 'aside', 'sidebar'))).toEqual([t('nav.quotes')])
  })
})

describe('Documents segmented control', () => {
  it('shows all three segments on each list screen and selects the one in the address', () => {
    for (const [url, selected] of [
      ['/documents/quotes', 'segments.quotes'],
      ['/documents/invoices', 'segments.invoices'],
      ['/documents/invoices?filter=unpaid', 'segments.invoices'],
      ['/documents/acts', 'segments.acts'],
    ] as const) {
      const control = region(render(url), 'nav', 'segments')
      for (const key of ['segments.quotes', 'segments.invoices', 'segments.acts'] as const) {
        expect(control, `${url}: ${key}`).toContain(t(key))
      }
      expect(current(control), url).toEqual([t(selected)])
    }
  })

  it('is absent from other pages', () => {
    for (const url of ['/', '/clients', '/invoices/demo', '/catalog']) {
      expect(render(url), url).not.toContain('class="segments"')
    }
  })

  it('sends /documents to the quotes segment', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/documents'] })
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/documents/quotes'))
    router.dispose()
  })
})

describe('chrome per screen', () => {
  it.each(screens.map((s) => [s.id, s.example] as const))('%s at %s has the chrome its mode asks for', (id, example) => {
    const html = render(example)
    const mode = shellModeOf(id)
    expect(html.includes('class="sidebar"'), 'sidebar').toBe(mode !== 'bare')
    expect(html.includes('class="topbar"'), 'topbar').toBe(mode !== 'bare')
    expect(html.includes('class="tabbar"'), 'tabbar').toBe(mode === 'app')
  })

  it('puts the screen title in the TopBar', () => {
    const bar = region(render('/clients'), 'header', 'topbar')
    expect(text(bar)).toBe(t('screen.S22.title'))
  })

  it('gives full-screen flows a back button, and top-level screens none', () => {
    expect(render('/quotes/new')).toContain(`aria-label="${t('nav.back')}"`)
    expect(render('/quotes/demo/send')).toContain(`aria-label="${t('nav.back')}"`)
    expect(render('/clients')).not.toContain(`aria-label="${t('nav.back')}"`)
  })

  it('has one main landmark and a skip link on every page that has the chrome', () => {
    const html = render('/catalog')
    expect(html.match(/<main\b/g)).toHaveLength(1)
    expect(html).toContain('href="#main"')
    expect(render('/login').match(/<main\b/g)).toHaveLength(1)
  })

  it('wraps the unknown-address page in the chrome too', () => {
    const html = render('/no-such-page')
    expect(html).toContain('class="sidebar"')
    expect(text(region(html, 'header', 'topbar'))).toBe(t('notFound.title'))
  })
})

function sheet(node: React.ReactNode): string {
  return renderToString(withClient(<StaticRouter location="/">{node}</StaticRouter>))
}

describe('sheets', () => {
  it('render nothing while closed', () => {
    expect(sheet(<CreateSheet open={false} onClose={() => {}} />)).toBe('')
    expect(sheet(<MoreSheet open={false} onClose={() => {}} />)).toBe('')
  })

  it('opens the [+] sheet as a labelled modal dialog with quote, client, catalogue item', () => {
    const html = sheet(<CreateSheet open onClose={() => {}} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html.match(/<h2[^>]*class="sheet-title"[^>]*>(.*?)<\/h2>/)?.[1]).toBe(t('create.title'))
    expect(html).toContain(`aria-label="${t('nav.close')}"`)
    const labels = [...html.matchAll(/class="sheet-row-label dc-label">(.*?)<\/span>/g)].map((m) => m[1])
    expect(labels).toEqual([t('create.quote'), t('create.client'), t('create.catalogItem')])
    expect(html).toContain('href="/quotes/new"')
    expect(html).toContain('href="/clients?new=1"')
    expect(html).toContain('href="/catalog?new=1"')
  })

  it('opens the More sheet with catalogue, company, sign out', () => {
    const html = sheet(<MoreSheet open onClose={() => {}} />)
    const labels = [...html.matchAll(/class="sheet-row-label dc-label">(.*?)<\/span>/g)].map((m) => m[1])
    expect(labels).toEqual([t('nav.catalog'), t('nav.company'), t('nav.logout')])
    expect(html).toContain('href="/catalog"')
    expect(html).toContain('href="/settings/company"')
    // Выйти is a button that ends the session (#15), no longer a link to the sign-in screen.
    expect(html).not.toContain('href="/login"')
    expect(html).toMatch(new RegExp(`<button[^>]*class="sheet-row"[^>]*>(?:(?!</button>).)*${t('nav.logout')}`))
  })
})
