import { redirect, type RouteObject } from 'react-router'
import { DesignCheck } from '../screens/DesignCheck'
import { NotFound } from '../screens/NotFound'
import { ScreenMap } from '../screens/ScreenMap'
import { ScreenRoute } from '../screens/ScreenRoute'
import { BareLayout } from '../shell/BareLayout'
import { Shell, type ShellHandle } from '../shell/Shell'
import { GuestOnly, RequireSession } from './guards'
import { QueryProvider } from './QueryProvider'
import { accessOf, documentListPath, shellModeOf, type ScreenAccess } from './nav'
import { DESIGN_CHECK_PATH, screens, SCREEN_MAP_PATH, type Screen } from './screens'

export interface ScreenRouteHandle {
  screens: readonly Screen[]
}

// One route per path. S15 and S21 share /documents/invoices and are told apart by the query.
const byPath = new Map<string, Screen[]>()
for (const screen of screens) {
  for (const path of screen.paths) byPath.set(path, [...(byPath.get(path) ?? []), screen])
}

function screenRoute([path, candidates]: [string, Screen[]]): RouteObject {
  return {
    path,
    element: <ScreenRoute candidates={candidates} path={path} />,
    handle: { screens: candidates } satisfies ScreenRouteHandle,
  }
}

const entries = [...byPath]
// Screens that share a path share a layout (S15 and S21), so the first one decides.
const isBare = ([, candidates]: [string, Screen[]]) => shellModeOf(candidates[0].id) === 'bare'
const hasAccess = (access: ScreenAccess) => (entry: [string, Screen[]]) => accessOf(entry[1][0].id) === access

const appRoutes: RouteObject[] = [
  // Sign-up, sign-in, onboarding and the client's public page: no navigation around them.
  {
    element: <BareLayout />,
    children: [
      // The client's page needs no account.
      ...entries.filter(hasAccess('public')).map(screenRoute),
      // Sign-up and sign-in; someone already signed in is sent on.
      { element: <GuestOnly />, children: entries.filter(hasAccess('guest')).map(screenRoute) },
      // The company setup: signed in, and only while there is no company.
      {
        element: <RequireSession needsCompany={false} bare />,
        children: entries.filter(isBare).filter(hasAccess('setup')).map(screenRoute),
      },
    ],
  },
  // Everything else needs a signed-in user with a company; a signed-out visitor is sent to /login.
  {
    element: <RequireSession />,
    children: [
      {
        element: <Shell />,
        children: [
          ...entries.filter((entry) => !isBare(entry)).map(screenRoute),
          // /documents has no screen of its own: it opens the quotes segment.
          { path: '/documents', loader: () => redirect(documentListPath.quotes) },
          {
            path: SCREEN_MAP_PATH,
            element: <ScreenMap />,
            handle: { titleKey: 'map.title' } satisfies ShellHandle,
          },
          {
            path: DESIGN_CHECK_PATH,
            element: <DesignCheck />,
            handle: { titleKey: 'check.title' } satisfies ShellHandle,
          },
          {
            path: '*',
            element: <NotFound />,
            handle: { titleKey: 'notFound.title' } satisfies ShellHandle,
          },
        ],
      },
    ],
  },
]

// Every route sits under the query cache provider (./QueryProvider).
export const routes: RouteObject[] = [{ element: <QueryProvider />, children: appRoutes }]
