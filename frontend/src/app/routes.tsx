import type { RouteObject } from 'react-router'
import { NotFound } from '../screens/NotFound'
import { ScreenMap } from '../screens/ScreenMap'
import { ScreenRoute } from '../screens/ScreenRoute'
import { screens, SCREEN_MAP_PATH, type Screen } from './screens'

export interface ScreenRouteHandle {
  screens: readonly Screen[]
}

// One route per path. S15 and S21 share /documents/invoices and are told apart by the query.
const byPath = new Map<string, Screen[]>()
for (const screen of screens) {
  for (const path of screen.paths) byPath.set(path, [...(byPath.get(path) ?? []), screen])
}

export const routes: RouteObject[] = [
  ...[...byPath].map(([path, candidates]) => ({
    path,
    element: <ScreenRoute candidates={candidates} path={path} />,
    handle: { screens: candidates } satisfies ScreenRouteHandle,
  })),
  { path: SCREEN_MAP_PATH, element: <ScreenMap /> },
  { path: '*', element: <NotFound /> },
]
