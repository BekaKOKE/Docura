import {
  Building2,
  ClipboardCheck,
  Eye,
  FilePen,
  FileText,
  House,
  LogIn,
  Package,
  PenLine,
  Receipt,
  Send,
  Settings,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { MessageKey } from '../i18n/t'

// Every MVP screen, its route and the M1 issue that builds its content.
// IDs come from replica/recon.md (screen inventory); ACTS is the acts list under Документы › Акты, which has no recon ID.
export type ScreenId =
  | 'S01' | 'S02' | 'S03' | 'S04' | 'S06' | 'S07' | 'S08' | 'S09' | 'S11' | 'S13'
  | 'S14' | 'S15' | 'S16' | 'S18' | 'S21' | 'S22' | 'S23' | 'S24' | 'S28' | 'ACTS'

export type ScreenGroup = 'account' | 'home' | 'quotes' | 'public' | 'invoices' | 'acts' | 'clients'

export interface Screen {
  id: ScreenId
  group: ScreenGroup
  /** Route patterns. A screen can have more than one (the editor opens a new or an existing quote). */
  paths: readonly string[]
  /** A screen that lives on another screen's path is told apart by its query (S21 is a filter of S15). */
  query?: Readonly<Record<string, string>>
  /** A URL that opens the screen, used by the screen map. */
  example: string
  /** The M1 issues that build the screen's content. */
  issues: readonly number[]
  icon: LucideIcon
}

export const screens: readonly Screen[] = [
  { id: 'S01', group: 'account', paths: ['/register'], example: '/register', issues: [15], icon: UserPlus },
  { id: 'S02', group: 'account', paths: ['/login'], example: '/login', issues: [15], icon: LogIn },
  { id: 'S03', group: 'account', paths: ['/onboarding'], example: '/onboarding', issues: [15], icon: Building2 },
  { id: 'S28', group: 'account', paths: ['/settings/company'], example: '/settings/company', issues: [15], icon: Settings },

  { id: 'S04', group: 'home', paths: ['/'], example: '/', issues: [32], icon: House },

  { id: 'S06', group: 'quotes', paths: ['/documents/quotes'], example: '/documents/quotes', issues: [22], icon: FileText },
  { id: 'S07', group: 'quotes', paths: ['/quotes/new', '/quotes/:quoteId/edit'], example: '/quotes/new', issues: [19], icon: FilePen },
  { id: 'S13', group: 'quotes', paths: ['/quotes/:quoteId'], example: '/quotes/demo', issues: [22], icon: FileText },
  { id: 'S08', group: 'quotes', paths: ['/documents/:documentId/preview'], example: '/documents/demo/preview', issues: [21], icon: Eye },
  { id: 'S09', group: 'quotes', paths: ['/quotes/:quoteId/send'], example: '/quotes/demo/send', issues: [22], icon: Send },
  { id: 'S14', group: 'quotes', paths: ['/quotes/:quoteId/invoice'], example: '/quotes/demo/invoice', issues: [27], icon: Receipt },

  { id: 'S11', group: 'public', paths: ['/p/:token'], example: '/p/demo', issues: [24], icon: PenLine },

  { id: 'S15', group: 'invoices', paths: ['/documents/invoices'], example: '/documents/invoices', issues: [28], icon: Receipt },
  {
    id: 'S21',
    group: 'invoices',
    paths: ['/documents/invoices'],
    query: { filter: 'unpaid' },
    example: '/documents/invoices?filter=unpaid',
    issues: [28],
    icon: Wallet,
  },
  { id: 'S16', group: 'invoices', paths: ['/invoices/:invoiceId'], example: '/invoices/demo', issues: [28, 30], icon: Wallet },

  { id: 'ACTS', group: 'acts', paths: ['/documents/acts'], example: '/documents/acts', issues: [31], icon: ClipboardCheck },
  { id: 'S18', group: 'acts', paths: ['/acts/:actId'], example: '/acts/demo', issues: [31], icon: ClipboardCheck },

  { id: 'S22', group: 'clients', paths: ['/clients'], example: '/clients', issues: [16], icon: Users },
  { id: 'S23', group: 'clients', paths: ['/clients/:clientId'], example: '/clients/demo', issues: [16], icon: UserRound },
  { id: 'S24', group: 'clients', paths: ['/catalog'], example: '/catalog', issues: [17], icon: Package },
]

export const screenGroups: readonly ScreenGroup[] = ['account', 'home', 'quotes', 'public', 'invoices', 'acts', 'clients']

export const SCREEN_MAP_PATH = '/screens'
/** A service page for checking fonts and 360 px wrapping by eye. It is not an MVP screen. */
export const DESIGN_CHECK_PATH = '/screens/check'

export const titleKey = (id: ScreenId) => `screen.${id}.title` as const satisfies MessageKey
export const purposeKey = (id: ScreenId) => `screen.${id}.purpose` as const satisfies MessageKey
export const groupKey = (group: ScreenGroup) => `group.${group}` as const satisfies MessageKey

/** The path as a person reads it: the pattern plus the query that selects the screen. */
export function displayPath(screen: Screen, path: string): string {
  if (!screen.query) return path
  return `${path}?${new URLSearchParams(screen.query).toString()}`
}

/** Of the screens sharing one path, the first whose query matches; otherwise the one without a query. */
export function pickScreen(candidates: readonly Screen[], search: URLSearchParams): Screen | undefined {
  const withQuery = candidates.find(
    (s) => s.query && Object.entries(s.query).every(([k, v]) => search.get(k) === v),
  )
  return withQuery ?? candidates.find((s) => !s.query)
}
