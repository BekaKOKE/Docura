import { readFileSync } from 'node:fs'
import type { QueryClient } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import type { PublicDocument } from '../../services'
import { renderApp } from '../../test/renderApp'
import { PublicGone, PublicLoading, PublicView } from './PublicScreen'
import { missingItems, SigningSheet } from './SigningSheet'

// S11 (#24): what the client sees at /p/:token and the signing sheet. Rendered to a string like the other screens'
// tests; drawing with a finger is run by hand in the dev server. The document is built by hand because a screen's
// tests do not import the mock (src/services/boundary.test.ts); the mock's own rules are in services/mock/public.test.ts.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

function publicDoc(patch: Partial<PublicDocument> = {}): PublicDocument {
  return {
    type: 'quote',
    status: 'sent',
    number: 'КП-2026-0004',
    issueDate: '2026-10-20',
    validUntil: '2026-11-03',
    dueDate: null,
    periodFrom: null,
    periodTo: null,
    contractRef: null,
    clientSnapshot: { kind: 'person', name: 'Қайрат Әбілқасымов', binIin: '880715301453', phone: '+7 701 123 45 67', email: null, address: null },
    companySnapshot: {
      legalForm: 'ip',
      legalName: 'ИП Сейткали Б.',
      binIin: '850312300121',
      address: 'г. Алматы, ул. Сәтбаев, 22',
      phone: '+7 701 555 12 34',
      directorName: 'Сейткали Бекзат',
      directorPosition: 'Индивидуальный предприниматель',
      vatPayer: true,
      bankName: null,
      iik: null,
      bik: null,
      kbe: null,
    },
    vatEnabled: true,
    vatRateBp: 1600,
    currency: 'KZT',
    netTiyn: 27_925_000,
    vatTiyn: 4_468_000,
    grossTiyn: 32_393_000,
    notes: 'Работы начнём в понедельник.',
    terms: null,
    lines: [
      { id: 'l-1', position: 0, articleId: null, kind: 'service', title: 'Укладка ламината', unit: 'м²', qtyMilli: 12_500, unitPriceTiyn: 1_850_000, discountBp: 0, netTiyn: 23_125_000, vatTiyn: 3_700_000, grossTiyn: 26_825_000 },
      { id: 'l-2', position: 1, articleId: null, kind: 'service', title: 'Плинтус, монтаж', unit: 'п.м.', qtyMilli: 32_000, unitPriceTiyn: 150_000, discountBp: 0, netTiyn: 4_800_000, vatTiyn: 768_000, grossTiyn: 5_568_000 },
    ],
    version: 1,
    canSign: true,
    isExpired: false,
    signature: null,
    logoUrl: null,
    signatureImageUrl: null,
    ...patch,
  }
}

const renderPage = (doc?: PublicDocument) =>
  renderApp('/p/tok', null, (client: QueryClient) => {
    if (doc) client.setQueryData(['public', 'tok'], doc)
  })

const view = (doc: PublicDocument, justSigned = false) =>
  renderToString(<PublicView doc={doc} token="tok" justSigned={justSigned} onReload={() => {}} onSigned={() => {}} />)

describe('S11 the page the client opens', () => {
  const html = renderPage(publicDoc())
  const visible = text(html)

  it('shows the company, the title, the number, the date, the amount and the validity (AC 1)', () => {
    expect(html).toContain('data-screen="S11"')
    for (const word of ['ИП Сейткали Б.', 'ИИН', '850312300121', 'Коммерческое предложение', '№ КП-2026-0004 от 20.10.2026', '323 930', 'Действует до 03.11.2026', 'с НДС 16 %']) {
      expect(visible, word).toContain(word)
    }
  })

  it('sets the БИН or ИИН in the mono face, one identifier per element', () => {
    expect(html).toContain('<span class="dc-code">850312300121</span>')
  })

  it('has the company phone as a call link, and none when the company has no phone (AC 1)', () => {
    expect(html).toMatch(/<a[^>]*class="pub-phone"[^>]*href="tel:\+77015551234"/)
    const none = renderPage(publicDoc({ companySnapshot: { ...publicDoc().companySnapshot, phone: null } }))
    expect(none).not.toContain('tel:')
  })

  it('shows the lines as cards with the quantity, the price and the VAT, then the totals (AC 1)', () => {
    expect(html.match(/class="card pub-line"/g)).toHaveLength(2)
    expect(visible).toContain('12,5 м² × 18 500 ₸')
    expect(visible).toContain('НДС 37 000 ₸')
    expect(visible).toContain(`${t('pub.totals.net')} 279 250`)
    expect(visible).toContain(`${t('pub.totals.vat', { rate: '16' })} 44 680`)
    expect(visible).toContain('Всего 323 930')
    expect(visible).toContain('Работы начнём в понедельник.')
  })

  it('tells search engines to stay away and has no app navigation (AC 1)', () => {
    expect(html).toContain('<meta name="robots" content="noindex"')
    for (const chrome of ['class="tabbar"', 'class="sidebar"', 'class="topbar"', 'nav.skip']) expect(html).not.toContain(chrome)
  })

  it('offers "Подписать" and "Скачать PDF", and says what is recorded', () => {
    expect(visible).toContain(t('pub.sign'))
    expect(visible).toContain(t('pub.pdf'))
    expect(visible).toContain(t('pub.footer'))
    expect(visible).toContain(t('pub.footer.record'))
  })

  it('carries the A4 document for printing, apart from the phone layout', () => {
    expect(html).toContain('class="pub-print"')
    expect(html).toContain('data-doc="quote"')
  })

  it('shows the logo when there is one', () => {
    const logo = renderPage(publicDoc({ logoUrl: 'data:image/png;base64,AAAA' }))
    expect(logo).toContain('src="data:image/png;base64,AAAA"')
    expect(logo).toContain('class="pub-logo"')
  })

  it('never calls the signature legally binding (spec §7)', () => {
    expect(html).not.toMatch(/юридическ|ЭЦП|legally/i)
  })
})

describe('S11 states (AC 2)', () => {
  it('loading: a skeleton before the document arrives', () => {
    const html = renderPage()
    expect(html).toContain('data-state="pending"')
    expect(html).toContain('skeleton')
    expect(text(html)).toContain(t('pub.loading'))
    expect(html).toContain('<meta name="robots" content="noindex"')
  })

  it('already signed: the banner with the name, date and time, the signature image, and no way to sign', () => {
    const doc = publicDoc({
      status: 'signed',
      canSign: false,
      signature: { method: 'drawn', signerName: 'Қайрат Әбілқасымов', signedAt: '2026-10-19T09:05:00Z', documentVersion: 1 },
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    })
    const html = renderPage(doc)
    expect(text(html)).toContain('Подписано на экране 19.10.2026 в 14:05 · Қайрат Әбілқасымов')
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="')
    expect(text(html)).not.toContain(t('pub.sign'))
    expect(html).not.toContain('class="pub-actions"')
    expect(html).toContain('data-state="signed"')
  })

  it('expired: the document stays, the expiry is said, signing is gone, and the contractor can be called', () => {
    const html = renderPage(publicDoc({ isExpired: true, canSign: false }))
    const visible = text(html)
    expect(visible).toContain('Срок действия предложения истёк 03.11.2026. Свяжитесь с исполнителем, чтобы получить новое.')
    expect(visible).toContain('Укладка ламината')
    expect(visible).not.toContain(t('pub.sign'))
    expect(html).toMatch(/<a[^>]*href="tel:\+77015551234"[^>]*class="btn btn-secondary btn-block pub-call"|<a[^>]*class="btn btn-secondary btn-block pub-call"[^>]*href="tel:\+77015551234"/)
    expect(html).toContain('data-state="expired"')
  })

  it('a quote that can no longer be signed says so', () => {
    const html = renderPage(publicDoc({ status: 'declined', canSign: false }))
    expect(text(html)).toContain(t('pub.closed'))
    expect(text(html)).not.toContain(t('pub.sign'))
  })

  it('revoked or unknown: "Ссылка больше не действует" and no document data', () => {
    const html = renderToString(<PublicGone />)
    const visible = text(html)
    expect(visible).toContain(t('pub.gone.title'))
    expect(visible).toContain(t('pub.gone.text'))
    for (const leaked of ['ИП Сейткали', 'КП-2026', '323 930', 'Қайрат']) expect(visible).not.toContain(leaked)
    expect(html).toContain('<meta name="robots" content="noindex"')
  })

  it('the loading piece renders on its own', () => {
    expect(renderToString(<PublicLoading />)).toContain('data-state="pending"')
  })

  it('success: "Подписано на экране" with the date and the time (AC 7)', () => {
    const signed = publicDoc({
      status: 'signed',
      canSign: false,
      signature: { method: 'drawn', signerName: 'Қайрат Әбілқасымов', signedAt: '2026-10-19T09:05:00Z', documentVersion: 1 },
    })
    const html = view(signed, true)
    const visible = text(html)
    expect(html).toContain('data-state="success"')
    expect(visible).toContain('Подписано на экране 19.10.2026, 14:05')
    expect(visible).toContain(t('pub.success.text'))
    expect(visible).toContain(t('pub.pdf'))
    expect(visible).not.toContain(t('pub.sign'))
    expect(html).not.toMatch(/юридическ|ЭЦП|legally/i)
  })
})

describe('the signing sheet (AC 3, 4)', () => {
  const sheet = renderToString(<SigningSheet doc={publicDoc()} token="tok" onClose={() => {}} onSigned={() => {}} onReload={() => {}} />)
  const visible = text(sheet)

  it('is a dialog titled "Подпись на экране" with the name filled in from the client', () => {
    expect(sheet).toContain('role="dialog"')
    expect(visible).toContain(t('pub.sheet.title'))
    expect(sheet).toMatch(/<input[^>]*id="pub-name"[^>]*value="Қайрат Әбілқасымов"/)
    expect(visible).toContain(t('pub.name.label'))
  })

  it('has the two consents, word for word, with the number and the amount filled in', () => {
    expect(visible).toContain('Я ознакомился с коммерческим предложением № КП-2026-0004 на сумму 323 930 ₸ и принимаю его.')
    expect(visible).toContain('Согласен на обработку моих персональных данных (имя, подпись, IP-адрес) для подтверждения подписи.')
    expect(sheet.match(/type="checkbox"/g)).toHaveLength(2)
    expect(sheet).not.toMatch(/type="checkbox"[^>]*checked/)
  })

  it('has the pad as a labelled image, a way to clear it and a status line', () => {
    expect(sheet).toContain('<canvas')
    expect(sheet).toContain('role="img"')
    expect(sheet).toContain(`aria-label="${t('pub.pad.aria')}"`)
    expect(visible).toContain(t('pub.pad.hint'))
    expect(visible).toContain(t('pub.pad.clear'))
    expect(visible).toContain(t('pub.pad.empty'))
  })

  it('keeps "Подписать" off and names everything that is missing', () => {
    expect(sheet).toMatch(/<button[^>]*disabled[^>]*>\s*<span class="dc-label">Подписать<\/span>/)
    expect(visible).toContain(
      'Чтобы подписать, нужно: расписаться, согласиться с предложением, дать согласие на обработку данных.',
    )
    expect(sheet).toContain('aria-describedby="pub-missing"')
  })

  it('never calls the signature legally binding (spec §7)', () => {
    expect(sheet).not.toMatch(/юридическ|ЭЦП|legally/i)
  })
})

describe('missingItems', () => {
  const all = { name: 'Қайрат', padOk: true, consentQuote: true, consentData: true }

  it('is empty when everything is given', () => {
    expect(missingItems(all)).toEqual([])
  })

  it('lists each missing item, in the order of the sheet', () => {
    expect(missingItems({ name: '  ', padOk: false, consentQuote: false, consentData: false })).toEqual([
      'pub.missing.name',
      'pub.missing.pad',
      'pub.missing.consentQuote',
      'pub.missing.consentData',
    ])
    expect(missingItems({ ...all, consentData: false })).toEqual(['pub.missing.consentData'])
    expect(missingItems({ ...all, padOk: false })).toEqual(['pub.missing.pad'])
  })
})

describe('the page follows the design rules (components.md §0, §3)', () => {
  const css = read('./public.css')
  const sources = ['./PublicScreen.tsx', './SigningSheet.tsx', './SignaturePad.tsx'].map(read).join('\n')

  it('uses tokens only: no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\b(rgb|rgba|hsl)\(/)
  })

  it('locks page scrolling on the pad only', () => {
    const rules = [...css.matchAll(/([^{}]+)\{[^}]*touch-action: none[^}]*\}/g)].map((m) => m[1]!.trim())
    expect(rules).toEqual(['.pub-pad'])
  })

  it('gives targets 48 px or more, and keeps the grids shrinkable', () => {
    for (const rule of ['.pub-phone', '.pub-check', '.pub-submit .btn', '.pub-actions .btn']) {
      const block = css.slice(css.indexOf(`${rule} {`))
      expect(block.slice(0, block.indexOf('}')), rule).toMatch(/min-height: var\(--dc-size-(touch-min|control-lg)\)/)
    }
    expect(css).toContain('minmax(0, 1fr)')
  })

  it('prints the A4 document, not the phone layout', () => {
    expect(css).toMatch(/@media print\s*\{[^@]*\.pub-screen,\s*\.pub-actions \{ display: none !important; \}/)
    expect(css).toMatch(/\.pub-print \{ display: none; \}/)
  })

  it('sends every visible string through t()', () => {
    expect(sources).not.toMatch(/>\s*[А-Яа-яЁё][^<{]*</)
    expect(sources).not.toMatch(/(placeholder|aria-label|title|alt)="[А-Яа-яЁё]/)
  })
})
