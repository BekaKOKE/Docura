import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'
import './styles/index.css'

// The development panel's styles: loaded in development only, so `npm run build` has none of the panel (#14 AC 5).
if (import.meta.env.DEV) void import('./dev/dev.css')

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
