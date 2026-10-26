import { describe, expect, it } from 'vitest'
import { screens, SCREEN_MAP_PATH, titleKey } from '../app/screens'
import { formatIssues, t } from '../i18n/t'
import { renderApp } from '../test/renderApp'

const render = (url: string): string => renderApp(url)

describe('screen placeholders', () => {
  it.each(screens.map((s) => [s.id, s.example] as const))('%s renders its id and title at %s', (id, example) => {
    const html = render(example)
    expect(html).toContain(`data-screen="${id}"`)
    expect(html).toContain(t(titleKey(id)))
  })

  it('names the M1 issue that builds the content', () => {
    expect(render('/quotes/new')).toContain('#19')
    expect(render('/invoices/demo')).toContain(formatIssues([28, 30]))
  })

  it('lists every screen on the screen map', () => {
    const html = render(SCREEN_MAP_PATH)
    for (const s of screens) expect(html, s.id).toContain(t(titleKey(s.id)))
  })

  it('shows the not-found page for an unknown address', () => {
    expect(render('/no-such-page')).toContain(t('notFound.title'))
  })
})
