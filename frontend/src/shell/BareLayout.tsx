import { Outlet } from 'react-router'
import { DevToolsLauncher } from '../dev/DevTools'

// Screens without app chrome: sign-up, sign-in, onboarding and the client's public page.
export function BareLayout() {
  return (
    <main id="main" className="bare">
      {import.meta.env.DEV && <DevToolsLauncher floating />}
      <Outlet />
    </main>
  )
}
