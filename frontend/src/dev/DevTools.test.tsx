import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '../app/routes'
import { t } from '../i18n/t'
import { API_ERROR_CODES, API_ERROR_STATUS } from '../services'
import { DevPanel } from './DevTools'

function render(url: string): string {
  return renderToString(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [url] })} />)
}

/** Every <button ...> element with its attributes and text. */
function buttons(html: string): { attrs: string; text: string }[] {
  return [...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)].map((m) => ({
    attrs: m[1] ?? '',
    text: (m[2] ?? '').replace(/<[^>]+>/g, '').trim(),
  }))
}

describe('the launcher (AC 3: reachable from the app shell)', () => {
  it('is in the TopBar of every screen with the app shell', () => {
    for (const url of ['/', '/clients', '/documents/quotes', '/catalog']) {
      const html = render(url)
      const bar = html.slice(html.indexOf('class="topbar"'), html.indexOf('</header>'))
      expect(bar, url).toContain('dev-launcher')
      expect(bar, url).toContain(`aria-label="${t('dev.open')}"`)
    }
  })

  it('floats in the corner of the screens without the shell (sign-in, onboarding, the public page)', () => {
    for (const url of ['/login', '/register', '/onboarding', '/p/demo']) {
      const html = render(url)
      expect(html, url).toContain('data-floating="true"')
      expect(html, url).toContain(`aria-label="${t('dev.open')}"`)
    }
  })

  it('opens a dialog from a button; the dialog is closed until it is tapped', () => {
    const html = render('/')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('class="dev-panel"')
  })
})

describe('the panel', () => {
  const html = renderToString(<DevPanel />)

  it('has one row for every ApiError code, with its HTTP status and its Russian message', () => {
    for (const code of API_ERROR_CODES) {
      const row = html.match(new RegExp(`<button[^>]*data-code="${code}"[^>]*>(.*?)</button>`))?.[1]
      expect(row, code).toBeDefined()
      expect(row).toContain(String(API_ERROR_STATUS[code]))
      expect(row).toContain(t(`apiError.${code}`))
    }
    expect(html.match(/data-code="/g)).toHaveLength(API_ERROR_CODES.length)
  })

  it('has the “Сбросить данные” button', () => {
    expect(t('dev.data.reset')).toBe('Сбросить данные')
    expect(buttons(html).some((b) => b.text === 'Сбросить данные')).toBe(true)
  })

  it('has no more than one button per row, each as wide as the panel (never two side by side on a phone)', () => {
    for (const b of buttons(html)) {
      expect(b.attrs).toMatch(/dev-row|btn-block/)
    }
  })

  it('shows the signed-out state and the dev logins of the seed', () => {
    expect(html).toContain(t('dev.data.signedOut'))
    expect(html).toContain('seitkali@example.kz')
    expect(html).toContain('nurlanov@example.kz')
    expect(html).toContain('docura-dev-2026')
  })

  it('shows an empty queue and disables “Снять все ошибки”', () => {
    expect(html).toContain(t('dev.errors.empty'))
    expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*>(?:<span[^>]*>)?${t('dev.errors.clear')}`))
  })
})
