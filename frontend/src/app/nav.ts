import {
  Building2,
  ClipboardCheck,
  FilePlus,
  Files,
  FileText,
  House,
  LogOut,
  Package,
  PackagePlus,
  Receipt,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { MessageKey } from '../i18n/t'
import type { ScreenId } from './screens'

// Where each screen sits in the navigation: which TabBar tab and Sidebar item is current, which screens
// carry the app chrome, and what the [+] and Ещё sheets offer. Pure data and functions, tested in nav.test.ts.

/** A place in the app that a Sidebar item or a Документы segment stands for. */
export type NavSection = 'home' | 'quotes' | 'invoices' | 'acts' | 'clients' | 'catalog' | 'company'

export const documentSections = ['quotes', 'invoices', 'acts'] as const
export type DocumentSection = (typeof documentSections)[number]

/** The list screen of each Документы segment (S06, S15, and the acts list). */
export const documentListPath: Record<DocumentSection, string> = {
  quotes: '/documents/quotes',
  invoices: '/documents/invoices',
  acts: '/documents/acts',
}

const sectionRules: readonly (readonly [RegExp, NavSection])[] = [
  [/^\/$/, 'home'],
  [/^\/(documents\/)?quotes(\/|$)/, 'quotes'],
  [/^\/documents\/[^/]+\/preview\/?$/, 'quotes'],
  [/^\/(documents\/)?invoices(\/|$)/, 'invoices'],
  [/^\/(documents\/)?acts(\/|$)/, 'acts'],
  [/^\/clients(\/|$)/, 'clients'],
  [/^\/catalog\/?$/, 'catalog'],
  [/^\/settings\/company\/?$/, 'company'],
]

/** The navigation section a pathname belongs to, or null for pages outside it (the screen map, 404). */
export function sectionOf(pathname: string): NavSection | null {
  return sectionRules.find(([pattern]) => pattern.test(pathname))?.[1] ?? null
}

/** The Документы segment whose list screen this exact pathname is, or null on any other page. */
export function documentSegmentOf(pathname: string): DocumentSection | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  return documentSections.find((section) => documentListPath[section] === clean) ?? null
}

export type TabId = 'home' | 'documents' | 'clients' | 'more'

/** The TabBar tab that is current for a section. Каталог and Компания live under Ещё. */
export function tabOf(section: NavSection | null): TabId | null {
  switch (section) {
    case 'home':
      return 'home'
    case 'quotes':
    case 'invoices':
    case 'acts':
      return 'documents'
    case 'clients':
      return 'clients'
    case 'catalog':
    case 'company':
      return 'more'
    default:
      return null
  }
}

/** The Документы tab opens the segment the user is already in, and КП otherwise. */
export function documentsTabPath(section: NavSection | null): string {
  const inDocuments = documentSections.find((s) => s === section)
  return documentListPath[inDocuments ?? 'quotes']
}

export interface SidebarItem {
  section: NavSection
  to: string
  label: MessageKey
  icon: LucideIcon
}

// components.md, Layout shell: Главная, Коммерческие предложения, Счета, Акты, Клиенты, Каталог, Компания.
export const sidebarItems: readonly SidebarItem[] = [
  { section: 'home', to: '/', label: 'nav.home', icon: House },
  { section: 'quotes', to: documentListPath.quotes, label: 'nav.quotes', icon: FileText },
  { section: 'invoices', to: documentListPath.invoices, label: 'nav.invoices', icon: Receipt },
  { section: 'acts', to: documentListPath.acts, label: 'nav.acts', icon: ClipboardCheck },
  { section: 'clients', to: '/clients', label: 'nav.clients', icon: Users },
  { section: 'catalog', to: '/catalog', label: 'nav.catalog', icon: Package },
  { section: 'company', to: '/settings/company', label: 'nav.company', icon: Building2 },
]

export const tabIcons = { home: House, documents: Files, clients: Users } as const

export interface SheetItem {
  id: string
  to: string
  label: MessageKey
  hint?: MessageKey
  icon: LucideIcon
}

// The [+] sheet. The issue names the three entries: КП, Клиент, Работа в каталог.
// "?new=1" asks the clients and catalog screens (#16, #17) to open their create form.
export const createItems: readonly SheetItem[] = [
  { id: 'quote', to: '/quotes/new', label: 'create.quote', hint: 'create.quote.hint', icon: FilePlus },
  { id: 'client', to: '/clients?new=1', label: 'create.client', hint: 'create.client.hint', icon: UserPlus },
  {
    id: 'catalogItem',
    to: '/catalog?new=1',
    label: 'create.catalogItem',
    hint: 'create.catalogItem.hint',
    icon: PackagePlus,
  },
]

/** Where "Выйти" goes. Real sign-out arrives with the auth screens (#15); until then it opens the sign-in screen. */
export const LOGOUT_PATH = '/login'

// The Ещё sheet: Каталог, Компания, Выйти.
export const moreItems: readonly SheetItem[] = [
  { id: 'catalog', to: '/catalog', label: 'nav.catalog', icon: Package },
  { id: 'company', to: '/settings/company', label: 'nav.company', icon: Building2 },
  { id: 'logout', to: LOGOUT_PATH, label: 'nav.logout', icon: LogOut },
]

/**
 * bare:  no app chrome (sign-up, sign-in, onboarding, the client's public page).
 * focus: full-screen flows (editor, preview, send, invoice): TopBar with back, no TabBar, so the ActionBar sits alone.
 * app:   TabBar on a phone, Sidebar on desktop.
 */
export type ShellMode = 'bare' | 'focus' | 'app'

const bareScreens: readonly ScreenId[] = ['S01', 'S02', 'S03', 'S11']
const focusScreens: readonly ScreenId[] = ['S07', 'S08', 'S09', 'S14']

export function shellModeOf(id: ScreenId): ShellMode {
  if (bareScreens.includes(id)) return 'bare'
  if (focusScreens.includes(id)) return 'focus'
  return 'app'
}

/**
 * Who may open a screen (#15 AC 2).
 * public: anyone (the client's page).  guest: sign-up and sign-in.  setup: signed in, no company yet.  app: signed in with a company.
 */
export type ScreenAccess = 'public' | 'guest' | 'setup' | 'app'

export function accessOf(id: ScreenId): ScreenAccess {
  if (id === 'S11') return 'public'
  if (id === 'S01' || id === 'S02') return 'guest'
  if (id === 'S03') return 'setup'
  return 'app'
}

// Detail screens get a back button in the TopBar. The path is where "back" goes when there is no history to return to.
const backFallbacks: Partial<Record<ScreenId, string>> = {
  S07: documentListPath.quotes,
  S08: documentListPath.quotes,
  S09: documentListPath.quotes,
  S13: documentListPath.quotes,
  S14: documentListPath.quotes,
  S16: documentListPath.invoices,
  S18: documentListPath.acts,
  S23: '/clients',
  S28: '/',
}

export function backFallbackOf(id: ScreenId): string | undefined {
  return backFallbacks[id]
}
