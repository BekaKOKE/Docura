import { Outlet } from 'react-router'

// Screens without app chrome: sign-up, sign-in, onboarding and the client's public page.
export function BareLayout() {
  return (
    <main id="main" className="bare">
      <Outlet />
    </main>
  )
}
