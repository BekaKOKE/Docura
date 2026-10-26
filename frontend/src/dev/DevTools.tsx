import { Wrench } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n/t'
import {
  API_ERROR_CODES,
  API_ERROR_STATUS,
  clearForcedErrors,
  devLogins,
  forceNextError,
  getDevSnapshot,
  mockDevtoolsEnabled,
  resetMockData,
  subscribeDevtools,
} from '../services'
import { BottomSheet } from '../shell/BottomSheet'

// The development panel (#14 AC 3 and 4): force an ApiError code on the next mock call, and reset the data to the
// seed. It exists only when `import.meta.env.DEV` is true and the app runs on the mock; `npm run build` has
// neither this file nor its strings (see tools check in the issue's TC-5).
//
// Its styles (dev.css) are loaded by main.tsx, in development only, so the production build has no panel CSS either.
//
// The launcher is one 48 px icon button. The shell puts it in the TopBar and the bare layout in the corner;
// the panel opens as a BottomSheet, with one full-width button per row, so nothing sits side by side on a phone.

export function DevToolsLauncher({ floating = false }: { floating?: boolean }) {
  // Not in production, and not when the app talks to the real API: nothing there to force.
  if (!import.meta.env.DEV || !mockDevtoolsEnabled) return null
  return <Launcher floating={floating} />
}

function Launcher({ floating }: { floating: boolean }) {
  const [open, setOpen] = useState(false)
  const snapshot = useSyncExternalStore(subscribeDevtools, getDevSnapshot, getDevSnapshot)

  return (
    <>
      <button
        type="button"
        className="icon-btn dev-launcher"
        data-floating={floating ? 'true' : undefined}
        data-armed={snapshot.forced.length > 0 ? 'true' : undefined}
        aria-label={t('dev.open')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Wrench aria-hidden="true" />
      </button>
      {/* In the body, not in the TopBar: the TopBar is a stacking context below the TabBar, and the sheet must cover both. */}
      {open &&
        createPortal(
          <BottomSheet open title={t('dev.title')} onClose={() => setOpen(false)}>
            <DevPanel />
          </BottomSheet>,
          document.body,
        )}
    </>
  )
}

export function DevPanel() {
  const snapshot = useSyncExternalStore(subscribeDevtools, getDevSnapshot, getDevSnapshot)
  const queued = (code: string) =>
    snapshot.forced.filter((item) => item.code === code).reduce((sum, item) => sum + item.remaining, 0)

  function reset() {
    resetMockData()
    // Lists the screens already fetched are stale now: start the app over from the seed.
    window.location.reload()
  }

  return (
    <div className="dev-panel">
      <p className="muted">{t('dev.lead')}</p>

      <section className="dev-section" aria-labelledby="dev-errors">
        <h3 id="dev-errors">{t('dev.errors.title')}</h3>
        <p className="muted">{t('dev.errors.lead')}</p>
        <ul className="dev-list">
          {API_ERROR_CODES.map((code) => {
            const count = queued(code)
            return (
              <li key={code}>
                <button type="button" className="dev-row" data-code={code} onClick={() => forceNextError(code)}>
                  <span className="dev-row-text">
                    <span className="dev-row-code dc-code">
                      {code} · {API_ERROR_STATUS[code]}
                    </span>
                    <span className="dev-row-hint">{t(`apiError.${code}`)}</span>
                  </span>
                  {count > 0 && <span className="dev-row-count">{t('dev.errors.queued', { n: count })}</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {snapshot.forced.length === 0 && <p className="muted">{t('dev.errors.empty')}</p>}
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={snapshot.forced.length === 0}
          onClick={clearForcedErrors}
        >
          <span className="dc-label">{t('dev.errors.clear')}</span>
        </button>
      </section>

      <section className="dev-section" aria-labelledby="dev-data">
        <h3 id="dev-data">{t('dev.data.title')}</h3>
        <ul className="dev-facts">
          <li>{t(snapshot.persistent ? 'dev.data.persistent' : 'dev.data.memoryOnly')}</li>
          {snapshot.session ? (
            <>
              <li>{t('dev.data.signedIn', { email: snapshot.session.email })}</li>
              <li>
                {snapshot.session.companyName
                  ? t('dev.data.company', { name: snapshot.session.companyName })
                  : t('dev.data.noCompany')}
              </li>
              {snapshot.session.counts && <li>{t('dev.data.counts', snapshot.session.counts)}</li>}
            </>
          ) : (
            <li>{t('dev.data.signedOut')}</li>
          )}
        </ul>
        <button type="button" className="btn btn-primary btn-block" onClick={reset}>
          <span className="dc-label">{t('dev.data.reset')}</span>
        </button>
        <p className="muted">{t('dev.data.resetHint')}</p>
      </section>

      <section className="dev-section" aria-labelledby="dev-logins">
        <h3 id="dev-logins">{t('dev.logins.title')}</h3>
        <p className="muted">{t('dev.logins.lead')}</p>
        <ul className="dev-facts">
          {devLogins().map((login) => (
            <li key={login.email}>
              <span className="dc-label">{login.company}</span>
              <span className="dev-login-email dc-code">{login.email}</span>
            </li>
          ))}
        </ul>
        <p className="dev-login-password dc-code">{t('dev.logins.password', { password: devLogins()[0]?.password ?? '' })}</p>
      </section>
    </div>
  )
}
