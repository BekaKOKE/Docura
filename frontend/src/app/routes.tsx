import { redirect, type RouteObject } from 'react-router'
import { NotFound } from '../screens/NotFound'
import { ScreenMap } from '../screens/ScreenMap'
import { ScreenRoute } from '../screens/ScreenRoute'
import { BareLayout } from '../shell/BareLayout'
import { Shell, type ShellHandle } from '../shell/Shell'
import { documentListPath, shellModeOf } from './nav'
import { screens, SCREEN_MAP_PATH, type Screen } from './screens'

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

export const routes: RouteObject[] = [
  // Sign-up, sign-in, onboarding and the client's public page: no navigation around them.
  { element: <BareLayout />, children: entries.filter(isBare).map(screenRoute) },
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
        path: '*',
        element: <NotFound />,
        handle: { titleKey: 'notFound.title' } satisfies ShellHandle,
      },
    ],
  },
]
