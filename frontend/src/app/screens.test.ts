import { matchRoutes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes, type ScreenRouteHandle } from './routes'
import { pickScreen, screenGroups, screens, SCREEN_MAP_PATH } from './screens'

// #7 AC 2: these screens must each have a route. ACTS is the acts list under Документы › Акты.
const MVP_SCREENS = [
  'S01', 'S02', 'S03', 'S04', 'S06', 'S07', 'S08', 'S09', 'S11', 'S13',
  'S14', 'S15', 'S16', 'S18', 'S21', 'S22', 'S23', 'S24', 'S28', 'ACTS',
]

// The open M1 issues that build screens (docs/tasks.md, M1).
const M1_SCREEN_ISSUES = [15, 16, 17, 19, 21, 22, 24, 27, 28, 30, 31, 32]

describe('screens', () => {
  it('lists every MVP screen exactly once', () => {
    expect(screens.map((s) => s.id).sort()).toEqual([...MVP_SCREENS].sort())
  })

  it('gives every screen at least one route and an M1 issue that builds it', () => {
    for (const s of screens) {
      expect(s.paths.length, s.id).toBeGreaterThan(0)
      expect(s.issues.length, s.id).toBeGreaterThan(0)
      for (const n of s.issues) expect(M1_SCREEN_ISSUES, `${s.id} → #${n}`).toContain(n)
    }
  })

  it('opens each screen from its example link through the real route table', () => {
    for (const s of screens) {
      const url = new URL(s.example, 'http://docura.test')
      const match = matchRoutes(routes, url.pathname)?.at(-1)
      const handle = match?.route.handle as ScreenRouteHandle | undefined
      expect(handle, `${s.id}: ${s.example} matched no screen route`).toBeDefined()
      expect(pickScreen(handle!.screens, url.searchParams)?.id, s.example).toBe(s.id)
    }
  })

  it('sends unknown addresses to the not-found page, not to a screen', () => {
    const match = matchRoutes(routes, '/no-such-page')?.at(-1)
    expect(match?.route.path).toBe('*')
  })

  it('never lets two screens claim the same path without a query to tell them apart', () => {
    const plain = screens.filter((s) => !s.query).flatMap((s) => s.paths)
    expect(new Set(plain).size).toBe(plain.length)
    expect(plain).not.toContain(SCREEN_MAP_PATH)
  })

  it('puts every screen in a group the screen map shows', () => {
    for (const s of screens) expect(screenGroups).toContain(s.group)
  })
})
