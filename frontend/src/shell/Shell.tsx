import { useState } from 'react'
import { Outlet, useLocation, useMatches, useNavigate, useSearchParams } from 'react-router'
import {
  backFallbackOf,
  documentSegmentOf,
  documentsTabPath,
  sectionOf,
  shellModeOf,
  tabOf,
} from '../app/nav'
import { pickScreen, titleKey, type Screen } from '../app/screens'
import { DevToolsLauncher } from '../dev/DevTools'
import { t, type MessageKey } from '../i18n/t'
import { CreateSheet, MoreSheet } from './ActionSheets'
import { DocumentSegments } from './DocumentSegments'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'

/** What a route tells the shell about itself: a screen (or several that differ by query), or just a title. */
export interface ShellHandle {
  screens?: readonly Screen[]
  titleKey?: MessageKey
}

type SheetKind = 'create' | 'more'

// The app chrome around every signed-in screen: Sidebar (desktop), TopBar, the Documents segmented control,
// TabBar (phone), and the [+] and More sheets. Screens render into <Outlet />; they only draw their own content.
export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const handle = useMatches().at(-1)?.handle as ShellHandle | undefined

  // A sheet belongs to the page it was opened on, so any navigation closes it.
  const [sheet, setSheet] = useState<{ kind: SheetKind; at: string } | null>(null)
  const openSheet = sheet?.at === location.key ? sheet.kind : null
  const open = (kind: SheetKind) => setSheet({ kind, at: location.key })
  const close = () => setSheet(null)

  const screen = handle?.screens ? pickScreen(handle.screens, search) : undefined
  const mode = screen ? shellModeOf(screen.id) : 'app'
  const title = screen ? t(titleKey(screen.id)) : handle?.titleKey ? t(handle.titleKey) : t('app.name')
  const section = sectionOf(location.pathname)
  const segment = documentSegmentOf(location.pathname)

  // Back returns to where the user came from; a page opened directly goes to its parent list instead.
  const fallback = screen ? backFallbackOf(screen.id) : undefined
  const onBack = fallback
    ? () => (location.key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1))
    : undefined

  return (
    <div className="shell" data-mode={mode}>
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <Sidebar current={section} />
      <div className="shell-main">
        <TopBar title={title} onBack={onBack}>
          {import.meta.env.DEV && <DevToolsLauncher />}
        </TopBar>
        {segment && <DocumentSegments current={segment} />}
        <main id="main" className="shell-content">
          <Outlet />
        </main>
      </div>
      {mode === 'app' && (
        <TabBar
          current={tabOf(section)}
          homeTo="/"
          documentsTo={documentsTabPath(section)}
          clientsTo="/clients"
          createOpen={openSheet === 'create'}
          moreOpen={openSheet === 'more'}
          onCreate={() => open('create')}
          onMore={() => open('more')}
        />
      )}
      <CreateSheet open={openSheet === 'create'} onClose={close} />
      <MoreSheet open={openSheet === 'more'} onClose={close} />
    </div>
  )
}
