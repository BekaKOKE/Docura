import { describe, expect, it } from 'vitest'
import { DESIGN_CHECK_PATH, SCREEN_MAP_PATH } from '../app/screens'
import { t } from '../i18n/t'
import { renderApp } from '../test/renderApp'

const render = (url: string): string => renderApp(url)

/** The text of the element marked data-sample="name". */
function sample(html: string, name: string): string | undefined {
  return html.match(new RegExp(`data-sample="${name}"[^>]*>([^<]*)<`))?.[1]
}

describe('font and wrapping check page', () => {
  const html = render(DESIGN_CHECK_PATH)

  it('shows the glyphs that must come from the web font', () => {
    expect(sample(html, 'tenge')).toBe(t('check.tengeSample'))
    expect(sample(html, 'kazakh')).toBe(t('check.kazakhSample'))
    expect(sample(html, 'yo-numero')).toBe(t('check.yoNumeroSample'))
    expect(sample(html, 'name-kazakh')).toBe(t('check.nameKazakh'))
    expect(sample(html, 'name-yo')).toBe(t('check.nameYo'))
  })

  it('formats the amount with Intl and keeps it in one unbreakable piece', () => {
    // Digit groups and the space before ₸ are no-break spaces (U+00A0), and .dc-money sets white-space: nowrap.
    expect(sample(html, 'money')).toBe('1 874 300 ₸')
    expect(html).toMatch(/class="dc-money check-row-amount" data-sample="money"/)
  })

  it('sets the document number as a mono identifier in one element', () => {
    expect(html).toContain(`class="dc-code" data-sample="code">${t('check.documentNumber')}<`)
  })

  it('has a full-width long-word button and at most two buttons side by side', () => {
    expect(html).toContain(`btn btn-primary btn-block"><span class="dc-label">${t('check.buttonLong')}<`)
    const pair = html.slice(html.indexOf('class="check-pair"'))
    expect(pair.slice(0, pair.indexOf('</div>')).match(/<button/g)).toHaveLength(2)
  })

  it('is linked from the screen map and titled through t()', () => {
    expect(render(SCREEN_MAP_PATH)).toContain(`href="${DESIGN_CHECK_PATH}"`)
    expect(html).toContain(t('check.title'))
  })
})
