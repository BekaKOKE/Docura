import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { queryClient } from './queryClient'

// Wraps every route in the query cache, so a screen rendered on its own in a test needs no extra setup.
export function QueryProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}
