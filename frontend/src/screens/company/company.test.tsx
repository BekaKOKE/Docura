import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import type { Company } from '../../services'
import { renderApp, SIGNED_IN, SIGNED_IN_NO_COMPANY } from '../../test/renderApp'
import { companyKey, logoKey } from './queries'
import { defaultPositionKey, emptyCompanyValues, toCompanyInput, valuesFromCompany } from './formValues'
import { logoFileProblem } from './logoCheck'

const company: Company = SIGNED_IN.companies[0]!

describe('form values', () => {
  it('starts empty with the defaults of the form: ИП, КНП 859, 14 days', () => {
    expect(emptyCompanyValues()).toMatchObject({ legalForm: 'ip', defaultKnp: '859', quoteValidityDays: '14', vatPayer: false, phone: '' })
  })

  it('fills the form from a saved company and gives the same input back', () => {
    const values = valuesFromCompany({ ...company, bankName: 'АО Тест Банк', iik: 'KZ75998KZT1001300335', bik: 'DCRAKZKA', kbe: '17', defaultKnp: '859' })
    expect(values).toMatchObject({ legalName: 'ИП Сейткали Б.', phone: '+7 701 555 12 34', quoteValidityDays: '14', iik: 'KZ75998KZT1001300335' })
    expect(toCompanyInput(values)).toMatchObject({
      legalForm: 'ip',
      legalName: 'ИП Сейткали Б.',
      binIin: '850312300121',
      phone: '+7 701 555 12 34',
      vatPayer: true,
      iik: 'KZ75998KZT1001300335',
      kbe: '17',
      quoteValidityDays: 14,
    })
  })

  it('turns empty optional fields into null and cleans the typed ones', () => {
    const input = toCompanyInput({
      ...emptyCompanyValues(),
      legalName: ' ТОО «Алатау» ',
      binIin: '0805 4000 1238',
      iik: ' kz75998kzt1001300335',
      bankName: '',
      phone: '',
      defaultKnp: '',
    })
    expect(input).toMatchObject({ legalName: 'ТОО «Алатау»', binIin: '080540001238', iik: 'KZ75998KZT1001300335', bankName: null, phone: null, defaultKnp: null })
  })

  it('offers a position by legal form', () => {
    expect(t(defaultPositionKey('ip'))).toBe('Индивидуальный предприниматель')
    expect(t(defaultPositionKey('too'))).toBe('Директор')
  })
})

describe('logo file check', () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const file = (head: number[], size: number) => {
    const bytes = new Uint8Array(size)
    bytes.set(head)
    return new Blob([bytes])
  }

  it('lets a PNG of 120 KB and a JPEG of 299 KB through', async () => {
    expect(await logoFileProblem(file(png, 120 * 1024))).toBeNull()
    expect(await logoFileProblem(file([0xff, 0xd8, 0xff], 299 * 1024))).toBeNull()
  })

  it('refuses a PNG of 301 KB, a GIF and a text file named logo.png', async () => {
    expect(await logoFileProblem(file(png, 301 * 1024))).toBe('logo.error.size')
    expect(await logoFileProblem(file([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 50 * 1024))).toBe('logo.error.type')
    expect(await logoFileProblem(new File(['просто текст'], 'logo.png', { type: 'image/png' }))).toBe('logo.error.type')
  })
})

describe('S03 company setup', () => {
  const html = renderApp('/onboarding', SIGNED_IN_NO_COMPANY)

  it('asks for every requisite of the issue, each field with its label', () => {
    for (const key of [
      'company.field.legalForm',
      'company.field.legalName',
      'company.field.binIin',
      'company.field.address',
      'company.field.phone',
      'company.field.directorName',
      'company.field.vatPayer',
      'company.field.bankName',
      'company.field.iik',
      'company.field.bik',
      'company.field.kbe',
      'company.field.defaultKnp',
      'company.field.quoteValidityDays',
      'company.section.logo',
    ] as const) {
      expect(html, key).toContain(t(key))
    }
  })

  it('marks the optional fields and ties every control to its label', () => {
    expect(html.split(t('form.optional')).length - 1).toBeGreaterThanOrEqual(6)
    for (const id of ['legalName', 'binIin', 'address', 'phone', 'directorName', 'iik', 'bik', 'kbe', 'defaultKnp', 'quoteValidityDays']) {
      expect(html, id).toContain(`for="${id}"`)
      expect(html, id).toContain(`id="${id}"`)
    }
  })

  it('uses the right keyboards: tel for the phone, numeric for the digits', () => {
    expect(html).toMatch(/type="tel"[^>]*inputMode="tel"|inputMode="tel"[^>]*type="tel"/)
    expect((html.match(/inputMode="numeric"/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('limits the logo to PNG and JPEG and says so', () => {
    expect(html).toContain('accept="image/png,image/jpeg"')
    expect(html).toContain(t('company.hint.logo'))
  })

  it('has one full-width save button and no app chrome', () => {
    expect(html).toMatch(/<button[^>]*class="btn btn-primary btn-block"[^>]*>\s*<span class="dc-label">Сохранить/)
    expect(html).not.toContain('class="tabbar"')
    expect(html).not.toContain('class="sidebar"')
  })
})

describe('S28 company settings', () => {
  it('shows a loading state while the company is read', () => {
    expect(renderApp('/settings/company')).toContain('data-state="loading"')
  })

  it('shows the saved values once they are read', () => {
    const html = renderApp('/settings/company', SIGNED_IN, (client) => {
      client.setQueryData(companyKey, company)
      client.setQueryData(logoKey, null)
    })
    expect(html).toContain('data-screen="S28"')
    expect(html).toContain('value="ИП Сейткали Б."')
    expect(html).toContain('value="850312300121"')
    expect(html).toContain('value="+7 701 555 12 34"')
    expect(html).toContain('value="г. Алматы, ул. Сәтбаев, 22"')
    expect(html).toContain(t('company.logo.none'))
  })

  it('shows the saved logo with its replace button', () => {
    const html = renderApp('/settings/company', SIGNED_IN, (client) => {
      client.setQueryData(companyKey, { ...company, hasLogo: true })
      client.setQueryData(logoKey, 'data:image/png;base64,AAAA')
    })
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain(t('company.logo.replace'))
  })

  it('shows the app chrome around the form', () => {
    expect(renderApp('/settings/company')).toContain('class="tabbar"')
  })
})
