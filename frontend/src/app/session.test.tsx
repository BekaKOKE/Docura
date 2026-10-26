import { describe, expect, it } from 'vitest'
import { t } from '../i18n/t'
import { ApiError } from '../services'
import { renderApp, SIGNED_IN, SIGNED_IN_NO_COMPANY } from '../test/renderApp'
import { accessOf } from './nav'
import { screens } from './screens'
import { destinationAfterSignIn, gateFor, safeFrom } from './session'

const unauthorized = new ApiError({ code: 'unauthorized', message: 'Нужно войти в аккаунт.' })
const state = (over: Partial<Parameters<typeof gateFor>[0]>) => ({ data: undefined, isPending: false, error: null, ...over })

describe('who may open which screen (AC 2)', () => {
  it('keeps the client page public, the auth screens for guests and everything else behind the sign-in', () => {
    expect(accessOf('S11')).toBe('public')
    expect(accessOf('S01')).toBe('guest')
    expect(accessOf('S02')).toBe('guest')
    expect(accessOf('S03')).toBe('setup')
    const behind = screens.filter((s) => accessOf(s.id) === 'app').map((s) => s.id)
    expect(behind).toContain('S22')
    expect(behind).toContain('S28')
    expect(behind).toContain('S06')
    expect(behind).not.toContain('S11')
  })
})

describe('gateFor', () => {
  it('waits while the session is being read', () => {
    expect(gateFor(state({ isPending: true }), true)).toEqual({ kind: 'loading' })
  })

  it('sends a signed-out visitor to the sign-in', () => {
    expect(gateFor(state({ error: unauthorized }), true)).toEqual({ kind: 'sign-in' })
    expect(gateFor(state({ error: unauthorized }), false)).toEqual({ kind: 'sign-in' })
  })

  it('shows another failure with a retry instead of signing the user out', () => {
    const lost = new ApiError({ code: 'rate_limited', message: 'Слишком много попыток. Подождите минуту.' })
    expect(gateFor(state({ error: lost }), true)).toEqual({ kind: 'failed', error: lost })
  })

  it('opens the app for a user with a company and the setup for one without', () => {
    expect(gateFor(state({ data: SIGNED_IN }), true)).toEqual({ kind: 'allow' })
    expect(gateFor(state({ data: SIGNED_IN_NO_COMPANY }), true)).toEqual({ kind: 'redirect', to: '/onboarding' })
    expect(gateFor(state({ data: SIGNED_IN_NO_COMPANY }), false)).toEqual({ kind: 'allow' })
    expect(gateFor(state({ data: SIGNED_IN }), false)).toEqual({ kind: 'redirect', to: '/' })
  })

  it('keeps the screen when a background refresh fails', () => {
    expect(gateFor(state({ data: SIGNED_IN, error: unauthorized }), true)).toEqual({ kind: 'allow' })
  })
})

describe('where a user goes after signing in', () => {
  it('goes back to the page they were opening', () => {
    expect(destinationAfterSignIn(SIGNED_IN, '/clients')).toBe('/clients')
    expect(destinationAfterSignIn(SIGNED_IN, '/documents/invoices?filter=unpaid')).toBe('/documents/invoices?filter=unpaid')
  })

  it('goes to Главная without a remembered page, and to the company setup without a company', () => {
    expect(destinationAfterSignIn(SIGNED_IN, undefined)).toBe('/')
    expect(destinationAfterSignIn(SIGNED_IN_NO_COMPANY, '/clients')).toBe('/onboarding')
  })

  it('never follows a page that is not inside the app', () => {
    for (const from of ['https://evil.example/', '//evil.example', 'javascript:alert(1)', 42, null, '/login', '/register?x=1']) {
      expect(safeFrom(from), String(from)).toBeUndefined()
    }
  })
})

describe('the guard in the rendered app', () => {
  it('shows a loading state, not the app, while the session is checked', () => {
    const html = renderApp('/clients', null)
    expect(html).toContain('data-state="loading"')
    expect(html).not.toContain('class="tabbar"')
    expect(html).not.toContain('data-screen="S22"')
  })

  it('shows the app for a signed-in user', () => {
    expect(renderApp('/clients')).toContain('data-screen="S22"')
  })

  it('opens the client page without a session', () => {
    const html = renderApp('/p/demo', null)
    expect(html).toContain('data-screen="S11"')
    expect(html).not.toContain('data-state="loading"')
  })

  it('shows the sign-in and sign-up forms at once, before the session is known', () => {
    for (const [url, screen] of [
      ['/login', 'S02'],
      ['/register', 'S01'],
    ] as const) {
      const html = renderApp(url, null)
      expect(html, url).toContain(`data-screen="${screen}"`)
      expect(html, url).toContain('<form')
    }
  })

  it('keeps the app chrome off the setup page', () => {
    const html = renderApp('/onboarding', SIGNED_IN_NO_COMPANY)
    expect(html).toContain('data-screen="S03"')
    expect(html).not.toContain('class="tabbar"')
    expect(t('screen.S03.title')).toBeTruthy()
  })
})
