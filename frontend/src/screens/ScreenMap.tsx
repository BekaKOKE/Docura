import { useEffect } from 'react'
import { Link } from 'react-router'
import { displayPath, groupKey, screenGroups, screens, titleKey } from '../app/screens'
import { formatIssues, t } from '../i18n/t'

// Lists every MVP screen with its address, so the whole scaffold can be walked without knowing the routes.
export function ScreenMap() {
  useEffect(() => {
    document.title = t('app.pageTitle', { title: t('map.title') })
  }, [])

  return (
    <div className="page" data-screen="map">
      <h1>{t('map.title')}</h1>
      <p className="muted">{t('map.lead')}</p>
      {screenGroups.map((group) => (
        <section key={group} className="group" aria-labelledby={`group-${group}`}>
          <h2 id={`group-${group}`}>{t(groupKey(group))}</h2>
          <ul className="card map-list">
            {screens
              .filter((s) => s.group === group)
              .map((s) => {
                const Icon = s.icon
                return (
                  <li key={s.id}>
                    <Link className="map-row" to={s.example}>
                      <Icon aria-hidden="true" />
                      <span className="map-row-text">
                        <span className="map-row-title">{t(titleKey(s.id))}</span>
                        <span className="map-row-meta">
                          <span className="dc-code">{s.id}</span>
                          <span className="dc-code">{displayPath(s, s.paths[0])}</span>
                          <span>
                            {t(s.issues.length > 1 ? 'map.issuesMany' : 'map.issues', {
                              issues: formatIssues(s.issues),
                            })}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </div>
  )
}
