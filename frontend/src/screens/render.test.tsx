import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { screens, SCREEN_MAP_PATH, titleKey } from '../app/screens'
import { formatIssues, t } from '../i18n/t'
import { renderApp } from '../test/renderApp'
import { Placeholder } from './Placeholder'

const render = (url: string): string => renderApp(url)

describe('screen placeholders', () => {
  it.each(screens.map((s) => [s.id, s.example] as const))('%s renders its id and title at %s', (id, example) => {
    const html = render(example)
    expect(html).toContain(`data-screen="${id}"`)
    // The client's page (S11) has no app title on purpose: it is the tradesperson's document, with no Docura chrome.
    if (id !== 'S11') expect(html).toContain(t(titleKey(id)))
  })

  it('names the M1 issue that builds the content', () => {
    // Every MVP screen is built now, so the placeholder is rendered on its own: it stays the fallback for a new screen.
    const screen = screens.find((s) => s.id === 'S18')!
    const html = renderToString(
      <MemoryRouter>
        <Placeholder screen={screen} path={screen.example} />
      </MemoryRouter>,
    )
    expect(html).toContain(formatIssues([31]))
  })

  it('lists every screen on the screen map', () => {
    const html = render(SCREEN_MAP_PATH)
    for (const s of screens) expect(html, s.id).toContain(t(titleKey(s.id)))
  })

  it('shows the not-found page for an unknown address', () => {
    expect(render('/no-such-page')).toContain(t('notFound.title'))
  })
})
