import { readFileSync } from 'node:fs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { t } from '../../i18n/t'
import type { Article } from '../../services'
import { renderApp } from '../../test/renderApp'
import { ArchiveConfirm } from './ArchiveConfirm'
import { CatalogForm } from './CatalogForm'

// The routes sit behind the sign-in (#15): render them as a signed-in user with a company.
const render = (url: string): string => renderApp(url)

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

describe('"?new=1" from the [+] sheet opens the create form', () => {
  const html = render('/catalog?new=1')

  it('as a dialog titled "Новая позиция"', () => {
    expect(html).toContain('role="dialog"')
    expect(html).toContain(t('catalogForm.title.new'))
  })

  it('with every field labelled and tied to its control', () => {
    const visible = text(html)
    for (const label of ['catalogForm.name', 'catalogForm.unit', 'catalogForm.price'] as const) {
      expect(visible, label).toContain(t(label))
    }
    expect(html).toContain(t('catalog.kind.service'))
    expect(html).toContain(t('catalog.kind.material'))
    expect(html).toContain('type="radio"')
    // Every <label for> has a control with that id.
    for (const [, id] of html.matchAll(/<label[^>]*for="([^"]+)"/g)) expect(html).toContain(`id="${id}"`)
  })

  it('offers exactly the twelve units, in order (AC 2, TC-2)', () => {
    const select = /<select[^>]*>(.*?)<\/select>/.exec(html)
    expect(select).not.toBeNull()
    const options = [...(select?.[1] ?? '').matchAll(/<option[^>]*>(.*?)<\/option>/g)].map((m) => m[1])
    expect(options).toEqual(['шт', 'м', 'м²', 'м³', 'п.м.', 'кг', 'т', 'л', 'ч', 'смена', 'компл.', 'услуга'])
  })

  it('takes the price in a decimal keypad field with a ₸ suffix and an example', () => {
    expect(html).toContain('inputMode="decimal"')
    expect(html).toContain('class="mi-suffix"')
    expect(text(html)).toContain(t('catalogForm.price.hint'))
  })

  it('does not validate on its own: no error text before the user acts', () => {
    expect(html).not.toContain('aria-invalid')
    expect(html).not.toContain('class="cl-error"')
  })

  it('has two buttons side by side at most: Отмена and Добавить', () => {
    const form = /<form[\s\S]*<\/form>/.exec(html)?.[0] ?? ''
    const buttons = [...form.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((m) => text(m[1] ?? ''))
    expect(buttons).toEqual([t('catalogForm.cancel'), t('catalogForm.add')])
  })

  it('turns native validation and autofill off, so the app’s own messages are the ones shown', () => {
    expect(html).toContain('noValidate')
    expect(html).toContain('autoComplete="off"')
  })
})

describe('editing and archiving an item', () => {
  const kazakh: Article = {
    id: 'a1',
    companyId: 'co',
    kind: 'service',
    title: 'Қабырғаны сылау',
    searchTitle: 'қабырғаны сылау',
    description: null,
    unit: 'м²',
    unitPriceTiyn: 1850050,
    archivedAt: null,
  }
  const inClient = (node: ReactNode) =>
    renderToString(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>)

  it('fills the form with the stored item: Kazakh title unchanged, price as «18 500,50», unit selected (TC-3, TC-6)', () => {
    const html = inClient(<CatalogForm article={kazakh} onSaved={() => {}} onCancel={() => {}} />)
    expect(html).toContain('value="Қабырғаны сылау"')
    expect(html).toContain('value="18 500,50"')
    expect(html).toMatch(/<option value="м²" selected/)
    expect(text(html)).toContain(t('catalogForm.save'))
  })

  it('offers the archive action only when editing, with the reason it is not a delete (AC 1)', () => {
    const editing = inClient(<CatalogForm article={kazakh} onSaved={() => {}} onCancel={() => {}} onArchive={() => {}} />)
    expect(text(editing)).toContain(t('catalogForm.archive'))
    expect(text(editing)).toContain(t('catalogForm.archive.why'))
    const creating = inClient(<CatalogForm onSaved={() => {}} onCancel={() => {}} />)
    expect(text(creating)).not.toContain(t('catalogForm.archive'))
    expect(text(editing)).not.toMatch(/Удалить|Удалён/)
  })

  it('still has Отмена and Сохранить as the only side-by-side buttons', () => {
    const html = inClient(<CatalogForm article={kazakh} onSaved={() => {}} onCancel={() => {}} onArchive={() => {}} />)
    const bar = /<div class="cl-actions cl-actions-bar">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? ''
    const buttons = [...bar.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((m) => text(m[1] ?? ''))
    expect(buttons).toEqual([t('catalogForm.cancel'), t('catalogForm.save')])
  })

  it('asks before archiving, names the item, promises the documents stay, and offers Отмена', () => {
    const html = inClient(<ArchiveConfirm article={kazakh} onArchived={() => {}} onCancel={() => {}} />)
    const visible = text(html)
    expect(visible).toContain('«Қабырғаны сылау»')
    expect(visible).toContain('не изменятся')
    const buttons = [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((m) => text(m[1] ?? ''))
    expect(buttons).toEqual([t('catalogArchive.confirm'), t('catalogArchive.cancel')])
    expect(html).not.toContain('role="alert"')
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
