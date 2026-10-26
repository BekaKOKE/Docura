import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { queryClient } from '../app/queryClient'
import { routes } from '../app/routes'
import { meKey } from '../app/session'
import type { Me } from '../services'

// Rendering helpers for the tests that look at the app's HTML. The routes sit behind a sign-in (#15), so a page
// is rendered the way it looks for a signed-in user with a company: the `me` answer is put in the cache first.

export const SIGNED_IN: Me = {
  user: { id: 'u-1', email: 'seitkali@example.kz', fullName: 'Сейткали Бекзат', locale: 'ru' },
  companies: [
    {
      id: 'c-1',
      legalForm: 'ip',
      legalName: 'ИП Сейткали Б.',
      binIin: '850312300121',
      address: 'г. Алматы, ул. Сәтбаев, 22',
      phone: '+7 701 555 12 34',
      email: null,
      directorName: 'Сейткали Бекзат',
      directorPosition: 'Индивидуальный предприниматель',
      vatPayer: true,
      bankName: null,
      iik: null,
      bik: null,
      kbe: null,
      defaultKnp: null,
      timezone: 'Asia/Almaty',
      quoteValidityDays: 14,
      invoiceDueDays: 5,
      currency: 'KZT',
      hasLogo: false,
    },
  ],
}

export const SIGNED_IN_NO_COMPANY: Me = { ...SIGNED_IN, companies: [] }

/**
 * Resets the app's one query cache to "this user is signed in" (`null`: nobody has asked yet, so the session is
 * still being checked). The routes sit under the singleton cache (QueryProvider), so tests seed that one.
 */
export function seedCache(me: Me | null = SIGNED_IN, seed?: (client: QueryClient) => void): QueryClient {
  queryClient.clear()
  if (me) queryClient.setQueryData(meKey, me)
  seed?.(queryClient)
  return queryClient
}

/** A component that is rendered outside the routes (a sheet) still needs the cache around it. */
export function withClient(node: ReactNode, me: Me | null = SIGNED_IN): ReactNode {
  return <QueryClientProvider client={seedCache(me)}>{node}</QueryClientProvider>
}

/** Who is signed in when a page is opened the usual way: nobody on sign-up and sign-in, no company yet on the setup, else a full account. */
export function meFor(url: string): Me | null {
  const path = url.split('?')[0]
  if (path === '/login' || path === '/register') return null
  return path === '/onboarding' ? SIGNED_IN_NO_COMPANY : SIGNED_IN
}

/** The HTML of the app at `url`, for the user `meFor` picks unless `me` says otherwise (null: still checking). */
export function renderApp(
  url: string,
  me: Me | null | undefined = undefined,
  seed?: (client: QueryClient) => void,
): string {
  seedCache(me === undefined ? meFor(url) : me, seed)
  const router = createMemoryRouter(routes, { initialEntries: [url] })
  return renderToString(<RouterProvider router={router} />)
}
