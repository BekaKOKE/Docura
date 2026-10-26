import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import cssSource from './clients.css?raw'
import { t } from '../../i18n/t'
import { renderApp } from '../../test/renderApp'
import { ClientForm } from './ClientForm'

// The routes sit behind the sign-in (#15): render them as a signed-in user with a company.
const render = (url: string): string => renderApp(url)

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('S22 clients list: first paint', () => {
  const html = render('/clients')

  it('is the clients screen with a labelled search field and the archive filter (AC 1)', () => {
    expect(html).toContain('data-screen="S22"')
    expect(html).toContain(`aria-label="${t('clients.search.label')}"`)
    expect(html).toContain('type="search"')
    expect(html).toContain(`aria-pressed="false"`)
  })

  it('shows the loading skeleton before the list arrives (AC 5)', () => {
    expect(html).toContain('cl-skeleton')
    expect(text(html)).toContain(t('clients.loading'))
    expect(html).toContain('aria-busy="true"')
  })

  it('keeps the create form closed until "?new=1"', () => {
    expect(html).not.toContain('role="dialog"')
  })
})

describe('"?new=1" from the [+] sheet opens the create form', () => {
  const html = render('/clients?new=1')

  it('as a dialog titled "Новый клиент"', () => {
    expect(html).toContain('role="dialog"')
    expect(html).toContain(t('clientForm.title.new'))
  })

  it('with every field labelled, optional ones marked, and a number keypad for ИИН/БИН', () => {
    const visible = text(html)
    for (const label of ['clientForm.name.person', 'clientForm.phone', 'clientForm.email', 'clientForm.address', 'clientForm.binIin.person'] as const) {
      expect(visible, label).toContain(t(label))
    }
    expect(visible).toContain(t('clientForm.optional'))
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('inputMode="tel"')
    expect(html).toContain('inputMode="email"')
  })

  it('offers a person and a company', () => {
    expect(html).toContain(t('clients.kind.person'))
    expect(html).toContain(t('clients.kind.company'))
    expect(html).toContain('type="radio"')
  })
})

describe('ClientForm', () => {
  const form = renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <ClientForm onSaved={() => {}} onCancel={() => {}} />
    </QueryClientProvider>,
  )

  it('does not validate on its own: no error text before the user acts', () => {
    expect(form).not.toContain('role="alert"')
    expect(form).not.toContain('aria-invalid')
  })

  it('has at most two buttons next to each other: Отмена and Добавить клиента', () => {
    const buttons = [...form.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((m) => text(m[1] ?? ''))
    expect(buttons).toEqual([t('clientForm.cancel'), t('clientForm.add')])
  })

  it('turns browser autofill and native validation off, so the app’s own messages are the ones shown', () => {
    expect(form).toContain('noValidate')
    expect(form).toContain('autoComplete="off"')
  })

  it('fills an edited client in, Kazakh letters unchanged', () => {
    const edit = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <ClientForm
          client={{
            id: 'c1',
            companyId: 'co',
            kind: 'person',
            name: 'Қайрат Әбілқасымов',
            binIin: '880715301453',
            phone: '+7 701 123 45 67',
            email: 'kairat@example.kz',
            address: 'г. Алматы, мкр. Самал-2',
            searchName: 'қайрат әбілқасымов',
            archivedAt: null,
          }}
          onSaved={() => {}}
          onCancel={() => {}}
        />
      </QueryClientProvider>,
    )
    expect(edit).toContain('value="Қайрат Әбілқасымов"')
    expect(edit).toContain('value="880715301453"')
    expect(text(edit)).toContain(t('clientForm.save'))
  })
})

describe('clients.css', () => {
  it('uses tokens only: no raw colour values (AGENTS.md rule 6)', () => {
    expect(cssSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(cssSource).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/)
  })
})
