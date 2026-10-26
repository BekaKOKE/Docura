import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { isApiError, services, type Me } from '../services'

// Who is signed in, and the guards that keep the app routes behind a sign-in (#15 AC 2).
//   /login and /register  GuestOnly            open to signed-out users; a signed-in user is sent on
//   /onboarding           RequireSession       signed in, but only while there is no company yet
//   the app (Shell)       RequireSession       signed in and with a company
//   /p/:token             no guard             the client's page is public
// The session is the `me` query: the one place that knows the user and their company.

export const meKey = ['me'] as const

export const LOGIN_PATH = '/login'
export const REGISTER_PATH = '/register'
export const ONBOARDING_PATH = '/onboarding'

export function useMe() {
  // Fresh for a minute: the guards mount often, and a refetch each time would also eat an error the dev panel forced for a screen.
  return useQuery({ queryKey: meKey, queryFn: () => services.auth.me(), staleTime: 60_000 })
}

export const hasCompany = (me: Me) => me.companies.length > 0

/** `from` only if it is a path inside this app (it travels in the navigation state, but never trust it). */
export function safeFrom(from: unknown): string | undefined {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return undefined
  const path = from.split(/[?#]/)[0]
  return [LOGIN_PATH, REGISTER_PATH].includes(path) ? undefined : from
}

/** Where a user who just signed in goes: back to what they were opening, or to the company setup if they have none. */
export function destinationAfterSignIn(me: Me, from: unknown): string {
  if (!hasCompany(me)) return ONBOARDING_PATH
  return safeFrom(from) ?? '/'
}

// True from the moment the user chose Выйти until the next sign-in: a guard that sends them to /login then
// must not remember the page they left, or the next person to sign in would be taken back to it.
let signedOutByChoice = false

/** True after Выйти, until the next sign-in. */
export const leftByChoice = () => signedOutByChoice

/**
 * Forget everything the previous user's session loaded, then load who is signed in now. Null when `me` could not
 * be read (the caller still navigates; the guard of the next screen reads it again and shows its own retry).
 */
export async function startSession(client: QueryClient): Promise<Me | null> {
  signedOutByChoice = false
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] })
  try {
    const me = await services.auth.me()
    client.setQueryData(meKey, me)
    return me
  } catch {
    client.removeQueries({ queryKey: meKey })
    return null
  }
}

/** Signs out for real (services.auth.logout), drops every cached answer and opens the sign-in screen. */
export function useLogout() {
  const client = useQueryClient()
  const navigate = useNavigate()
  return useCallback(async () => {
    signedOutByChoice = true
    try {
      await services.auth.logout()
    } finally {
      // Clear first, so the sign-in screen that opens next never sees the old user's answers.
      await client.cancelQueries()
      client.clear()
      navigate(LOGIN_PATH, { replace: true })
    }
  }, [client, navigate])
}

export type Gate =
  | { kind: 'loading' }
  | { kind: 'failed'; error: unknown }
  | { kind: 'sign-in' }
  | { kind: 'redirect'; to: string }
  | { kind: 'allow' }

/**
 * What a guarded route does with the state of the `me` query. Data first: a background refresh that fails (a
 * forced error, a lost connection) must not throw the screen away. `needsCompany` false is the company setup
 * itself: it is for a signed-in user who has no company yet, and a user who has one is sent to Главная.
 */
export function gateFor(
  me: { data: Me | undefined; isPending: boolean; error: unknown },
  needsCompany: boolean,
): Gate {
  if (!me.data) {
    if (me.isPending) return { kind: 'loading' }
    if (isApiError(me.error) && me.error.code === 'unauthorized') return { kind: 'sign-in' }
    return { kind: 'failed', error: me.error }
  }
  if (needsCompany && !hasCompany(me.data)) return { kind: 'redirect', to: ONBOARDING_PATH }
  if (!needsCompany && hasCompany(me.data)) return { kind: 'redirect', to: '/' }
  return { kind: 'allow' }
}
