import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { DevToolsLauncher } from '../dev/DevTools'
import { t } from '../i18n/t'
import { errorText } from './errorText'

// The states every data screen shares: loading, a failed call with "Повторить", a banner. Screens put their
// own empty state next to these (components.md, Skeleton, Banner, EmptyState).

/** The page frame for states that show before the app chrome exists (checking the session). */
export function FullPage({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="bare">
      {import.meta.env.DEV && <DevToolsLauncher floating />}
      {children}
    </main>
  )
}

export function PageLoading({ screen }: { screen?: string }) {
  return (
    <div className="page" data-screen={screen} role="status" aria-busy="true" aria-label={t('state.loading')} data-state="loading">
      <span className="sr-only">{t('state.loading')}</span>
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <div className="skeleton skeleton-block" aria-hidden="true" />
      <div className="skeleton skeleton-block" aria-hidden="true" />
    </div>
  )
}

/** A failed call: the message in words and a button that tries again. */
export function ErrorState({
  error,
  onRetry,
  retrying,
  screen,
}: {
  error: unknown
  onRetry: () => void
  retrying?: boolean
  /** The screen this state stands in for (its data-screen), so it is still told apart. */
  screen?: string
}) {
  return (
    <div className="page" data-screen={screen} data-state="error">
      <div className="banner banner-danger" role="alert">
        <CircleAlert aria-hidden="true" />
        <p>{errorText(error)}</p>
      </div>
      <button type="button" className="btn btn-secondary btn-block" onClick={onRetry} aria-busy={retrying || undefined}>
        <span className="dc-label">{t('state.retry')}</span>
      </button>
    </div>
  )
}

export function Banner({
  tone,
  children,
  action,
}: {
  tone: 'danger' | 'success'
  children: ReactNode
  action?: ReactNode
}) {
  const Icon = tone === 'danger' ? CircleAlert : CircleCheck
  return (
    <div className={`banner banner-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div className="banner-text">{children}</div>
      {action}
    </div>
  )
}

/** A failed save or sign-in: the message above the form and, when trying again can help, a "Повторить" button. */
export function ProblemBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Banner
      tone="danger"
      action={
        onRetry && (
          <button type="button" className="btn btn-secondary banner-action" onClick={onRetry}>
            <span className="dc-label">{t('state.retry')}</span>
          </button>
        )
      }
    >
      <p>{message}</p>
    </Banner>
  )
}
