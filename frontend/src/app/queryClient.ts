import { QueryClient } from '@tanstack/react-query'

// The one place server state is cached. Screens read it with useQuery and change it with useMutation, always
// through `services`.
//
// retry is off: a failed call must show its error with a "Повторить" button at once, not be quietly tried again
// (the dev panel forces one error, and a silent retry would swallow it). Focus refetching is off too, so
// closing the dev panel does not refetch a list behind the user's back.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})
