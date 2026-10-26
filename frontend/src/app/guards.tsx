import { Navigate, Outlet, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { ErrorState, FullPage, PageLoading } from '../screens/ui'
import { destinationAfterSignIn, gateFor, leftByChoice, LOGIN_PATH, useMe } from './session'

// The guards of the route tree (routes.tsx). The rules they apply are in session.ts (gateFor).

/** The path the user was on, to come back to after signing in. */
function useCurrentPath(): string {
  const { pathname, search, hash } = useLocation()
  return `${pathname}${search}${hash}`
}

/** Layout route for everything behind the sign-in (`bare`: it already sits inside a page frame). */
export function RequireSession({ needsCompany = true, bare = false }: { needsCompany?: boolean; bare?: boolean }) {
  const me = useMe()
  const from = useCurrentPath()
  const frame = (node: ReactNode) => (bare ? node : <FullPage>{node}</FullPage>)
  const gate = gateFor(me, needsCompany)

  switch (gate.kind) {
    case 'loading':
      return frame(<PageLoading />)
    case 'failed':
      return frame(<ErrorState error={gate.error} onRetry={() => void me.refetch()} retrying={me.isFetching} />)
    case 'sign-in':
      return <Navigate to={LOGIN_PATH} replace state={leftByChoice() ? undefined : { from }} />
    case 'redirect':
      return <Navigate to={gate.to} replace />
    case 'allow':
      return <Outlet />
  }
}

/** Layout route for sign-up and sign-in: the form shows at once; if the session turns out to be live, move on. */
export function GuestOnly() {
  const me = useMe()
  const { state } = useLocation()
  if (me.data) return <Navigate to={destinationAfterSignIn(me.data, (state as { from?: unknown } | null)?.from)} replace />
  return <Outlet />
}
