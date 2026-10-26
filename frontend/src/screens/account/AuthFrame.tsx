import { useEffect, type ReactNode } from 'react'
import { t } from '../../i18n/t'

// The page around the sign-up and sign-in forms: the product name, the screen's title, one line of purpose.
// No app chrome (BareLayout): the user has no account to navigate yet.
export function AuthFrame({
  screen,
  title,
  lead,
  children,
}: {
  screen: string
  title: string
  lead: string
  children: ReactNode
}) {
  useEffect(() => {
    document.title = t('app.pageTitle', { title })
  }, [title])

  return (
    <div className="page auth" data-screen={screen}>
      <p className="auth-brand">{t('app.name')}</p>
      <h1>{title}</h1>
      <p className="muted">{lead}</p>
      {children}
    </div>
  )
}
