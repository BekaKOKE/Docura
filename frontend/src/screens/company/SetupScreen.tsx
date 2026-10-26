import { useMemo } from 'react'
import { useEffect } from 'react'
import { t } from '../../i18n/t'
import { useLogout } from '../../app/session'
import { CompanyForm } from './CompanyForm'
import { defaultPositionKey, emptyCompanyValues } from './formValues'

// S03. The first setup after sign-up: the requisites every document prints. Saving creates the company and
// opens Главная (#15 AC 1). It is the same form as the settings (S28).
export function SetupScreen() {
  const logout = useLogout()
  const initial = useMemo(() => {
    const values = emptyCompanyValues()
    return { ...values, directorPosition: t(defaultPositionKey(values.legalForm)) }
  }, [])

  useEffect(() => {
    document.title = t('app.pageTitle', { title: t('screen.S03.title') })
  }, [])

  return (
    <div className="page" data-screen="S03">
      <p className="auth-brand">{t('app.name')}</p>
      <h1>{t('company.setup.title')}</h1>
      <p className="muted">{t('company.setup.lead')}</p>
      <CompanyForm
        mode="setup"
        initial={initial}
        savedLogoUrl={null}
        footer={
          <button type="button" className="btn btn-ghost btn-block" onClick={() => void logout()}>
            <span className="dc-label">{t('nav.logout')}</span>
          </button>
        }
      />
    </div>
  )
}
