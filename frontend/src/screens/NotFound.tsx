import { useEffect } from 'react'
import { Link } from 'react-router'
import { SCREEN_MAP_PATH } from '../app/screens'
import { t } from '../i18n/t'

export function NotFound() {
  useEffect(() => {
    document.title = t('app.pageTitle', { title: t('notFound.title') })
  }, [])

  return (
    <div className="page" data-screen="not-found">
      <h1>{t('notFound.title')}</h1>
      <p className="muted">{t('notFound.text')}</p>
      <Link className="btn btn-primary btn-block" to="/">
        <span className="dc-label">{t('notFound.home')}</span>
      </Link>
      <Link className="btn btn-secondary btn-block" to={SCREEN_MAP_PATH}>
        <span className="dc-label">{t('placeholder.allScreens')}</span>
      </Link>
    </div>
  )
}
