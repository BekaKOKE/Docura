// What the development panel (src/dev) may do to the mock: force an ApiError on the next call, read what is
// queued, reset the data to the seed. The panel is outside src/services, so it reaches the mock through here
// (boundary.test.ts keeps screens from importing services/mock). Every use sits behind
// `import.meta.env.DEV`, so none of this is in `npm run build` (#14 AC 5).

import type { ApiErrorCode } from './errors'
import type { ForcedError } from './mock/errorInjection'
import { getMockRuntime } from './mock/runtime'
import { seed, DEV_PASSWORD } from './mock/seed'
import { resolveApiMode } from './select'

export type { ForcedError }

/** The panel exists only in development builds that use the mock (with `VITE_API_MODE=http` there is nothing to force). */
export const mockDevtoolsEnabled: boolean =
  import.meta.env.DEV && resolveApiMode(import.meta.env.VITE_API_MODE) === 'mock'

export interface DevLogin {
  email: string
  password: string
  company: string
}

/** The seed's dev logins (contracts/README.md). */
export function devLogins(): DevLogin[] {
  return seed.users.map((user) => ({
    email: user.email,
    password: DEV_PASSWORD,
    company: seed.companies.find((c) => c.id === user.companyId)?.legalName ?? '',
  }))
}

export interface DevSession {
  email: string
  /** Null before onboarding. */
  companyName: string | null
  /** What the signed-in company can see; another company's rows never count. Null without a company. */
  counts: { clients: number; articles: number; documents: number; payments: number } | null
}

export interface DevSnapshot {
  forced: readonly ForcedError[]
  /** False when localStorage can't be used and data lives in memory only. */
  persistent: boolean
  session: DevSession | null
}

const NO_ERRORS: readonly ForcedError[] = []

function describeSession(): DevSession | null {
  const { store } = getMockRuntime()
  const who = store.readAll((data) => {
    const user = data.session ? data.users.find((u) => u.id === data.session?.userId) : undefined
    const company = user?.companyId ? data.companies.find((c) => c.id === user.companyId) : undefined
    return user ? { email: user.email, companyId: company?.id ?? null, companyName: company?.legalName ?? null } : null
  })
  if (!who) return null
  const counts = who.companyId
    ? store.readIn(who.companyId, (db) => ({
        clients: db.rows('clients').length,
        articles: db.rows('articles').length,
        documents: db.rows('documents').length,
        payments: db.rows('payments').length,
      }))
    : null
  return { email: who.email, companyName: who.companyName, counts }
}

let cached: { version: number; forced: readonly ForcedError[]; snapshot: DevSnapshot } | undefined

/** The panel's view of the mock. The same object until something changes, so `useSyncExternalStore` can compare it. */
export function getDevSnapshot(): DevSnapshot {
  const { store, injector } = getMockRuntime()
  const forced = injector?.pending() ?? NO_ERRORS
  if (cached && cached.version === store.version && cached.forced === forced) return cached.snapshot
  const snapshot: DevSnapshot = { forced, persistent: store.persistent, session: describeSession() }
  cached = { version: store.version, forced, snapshot }
  return snapshot
}

/** Calls `listener` after the queue or the data changes. Returns the unsubscribe function. */
export function subscribeDevtools(listener: () => void): () => void {
  const { store, injector } = getMockRuntime()
  const offStore = store.subscribe(listener)
  const offInjector = injector?.subscribe(listener)
  return () => {
    offStore()
    offInjector?.()
  }
}

/** The next `times` mock calls (default 1) fail with `code`. */
export function forceNextError(code: ApiErrorCode, times = 1): void {
  getMockRuntime().injector?.force(code, times)
}

export function clearForcedErrors(): void {
  getMockRuntime().injector?.clear()
}

/** Back to contracts/fixtures/seed.json. */
export function resetMockData(): void {
  getMockRuntime().store.reset()
}
