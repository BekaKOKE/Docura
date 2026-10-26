import { Link } from 'react-router'
import { displayPath, purposeKey, SCREEN_MAP_PATH, titleKey, type Screen } from '../app/screens'
import { formatIssues, t } from '../i18n/t'

// The page every MVP screen shows until its own M1 issue builds the content.
export function Placeholder({ screen, path }: { screen: Screen; path: string }) {
  const Icon = screen.icon
  return (
    <main className="page" data-screen={screen.id}>
      <span className="screen-id dc-code">{screen.id}</span>
      <h1>{t(titleKey(screen.id))}</h1>
      <p className="muted">{t(purposeKey(screen.id))}</p>
      <section className="card">
        <div className="card-body">
          <div className="fact">
            <span className="fact-label">{t('placeholder.route')}</span>
            <span className="fact-value dc-code">{displayPath(screen, path)}</span>
          </div>
          <p className="hint">
            <Icon aria-hidden="true" />
            <span>
              {t(screen.issues.length > 1 ? 'placeholder.comesInMany' : 'placeholder.comesIn', {
                issues: formatIssues(screen.issues),
              })}
            </span>
          </p>
        </div>
      </section>
      <Link className="btn btn-secondary btn-block" to={SCREEN_MAP_PATH}>
        <span className="dc-label">{t('placeholder.allScreens')}</span>
      </Link>
    </main>
  )
}
