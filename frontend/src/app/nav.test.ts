import { describe, expect, it } from 'vitest'
import { t } from '../i18n/t'
import {
  backFallbackOf,
  createItems,
  documentSegmentOf,
  documentsTabPath,
  moreItems,
  sectionOf,
  shellModeOf,
  sidebarItems,
  tabOf,
} from './nav'
import { screens } from './screens'

const BARE = ['S01', 'S02', 'S03', 'S11']
const FOCUS = ['S07', 'S08', 'S09', 'S14']

describe('sectionOf', () => {
  it.each([
    ['/', 'home'],
    ['/documents/quotes', 'quotes'],
    ['/quotes/new', 'quotes'],
    ['/quotes/q-1/edit', 'quotes'],
    ['/quotes/q-1/invoice', 'quotes'],
    ['/documents/d-1/preview', 'quotes'],
    ['/documents/invoices', 'invoices'],
    ['/invoices/i-1', 'invoices'],
    ['/documents/acts', 'acts'],
    ['/acts/a-1', 'acts'],
    ['/clients', 'clients'],
    ['/clients/c-1', 'clients'],
    ['/catalog', 'catalog'],
    ['/settings/company', 'company'],
  ])('puts %s in %s', (pathname, section) => {
    expect(sectionOf(pathname)).toBe(section)
  })

  it('leaves pages outside the navigation without a section', () => {
    expect(sectionOf('/screens')).toBeNull()
    expect(sectionOf('/no-such-page')).toBeNull()
    expect(sectionOf('/quotesfoo')).toBeNull()
  })

  it('finds a section for every screen that shows the app chrome', () => {
    for (const screen of screens) {
      if (shellModeOf(screen.id) === 'bare') continue
      for (const path of screen.paths) {
        const example = path.replace(/:\w+/g, 'demo')
        expect(sectionOf(example), `${screen.id} at ${example}`).not.toBeNull()
      }
    }
  })
})

describe('documents segments', () => {
  it('recognises the three list screens, with or without a trailing slash', () => {
    expect(documentSegmentOf('/documents/quotes')).toBe('quotes')
    expect(documentSegmentOf('/documents/invoices/')).toBe('invoices')
    expect(documentSegmentOf('/documents/acts')).toBe('acts')
  })

  it('does not show the control on a document page or elsewhere', () => {
    expect(documentSegmentOf('/invoices/i-1')).toBeNull()
    expect(documentSegmentOf('/documents/d-1/preview')).toBeNull()
    expect(documentSegmentOf('/clients')).toBeNull()
  })

  it('opens the segment the user is already in, and the quotes list otherwise', () => {
    expect(documentsTabPath('invoices')).toBe('/documents/invoices')
    expect(documentsTabPath('acts')).toBe('/documents/acts')
    expect(documentsTabPath('quotes')).toBe('/documents/quotes')
    expect(documentsTabPath('home')).toBe('/documents/quotes')
    expect(documentsTabPath(null)).toBe('/documents/quotes')
  })
})

describe('tabOf', () => {
  it('maps sections to TabBar tabs and tucks Каталог and Компания under Ещё', () => {
    expect(tabOf('home')).toBe('home')
    expect(tabOf('quotes')).toBe('documents')
    expect(tabOf('invoices')).toBe('documents')
    expect(tabOf('acts')).toBe('documents')
    expect(tabOf('clients')).toBe('clients')
    expect(tabOf('catalog')).toBe('more')
    expect(tabOf('company')).toBe('more')
    expect(tabOf(null)).toBeNull()
  })
})

describe('menus', () => {
  it('has the seven Sidebar items of components.md, in order', () => {
    expect(sidebarItems.map((item) => t(item.label))).toEqual([
      'Главная',
      'Коммерческие предложения',
      'Счета',
      'Акты',
      'Клиенты',
      'Каталог',
      'Компания',
    ])
  })

  it('offers КП, Клиент and Работа в каталог in the [+] sheet', () => {
    expect(createItems.map((item) => t(item.label))).toEqual(['КП', 'Клиент', 'Работа в каталог'])
  })

  it('offers Каталог, Компания and Выйти in the Ещё sheet', () => {
    expect(moreItems.map((item) => t(item.label))).toEqual(['Каталог', 'Компания', 'Выйти'])
  })

  it('makes Выйти an action, and the other Ещё entries links', () => {
    expect(moreItems.filter((item) => item.action).map((item) => [item.id, item.action])).toEqual([['logout', 'logout']])
  })

  it('points every menu entry at a route that exists', () => {
    const known = new Set(screens.flatMap((s) => s.paths))
    for (const item of [...sidebarItems, ...createItems, ...moreItems]) {
      const path = item.to.split('?')[0]
      expect(known, item.to).toContain(path)
    }
  })
})

describe('shellModeOf', () => {
  it('keeps the chrome off sign-up, sign-in, onboarding and the public page', () => {
    for (const id of BARE) expect(shellModeOf(id as never), id).toBe('bare')
  })

  it('takes the TabBar off the full-screen flows', () => {
    for (const id of FOCUS) expect(shellModeOf(id as never), id).toBe('focus')
  })

  it('shows the full chrome everywhere else', () => {
    const rest = screens.map((s) => s.id).filter((id) => ![...BARE, ...FOCUS].includes(id))
    expect(rest.length).toBeGreaterThan(0)
    for (const id of rest) expect(shellModeOf(id), id).toBe('app')
  })

  it('gives every full-screen flow somewhere to go back to', () => {
    for (const id of FOCUS) expect(backFallbackOf(id as never), id).toBeDefined()
  })
})
