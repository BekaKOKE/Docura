import { t } from '../../i18n/t'
import { CompanyForm } from './CompanyForm'
import { valuesFromCompany } from './formValues'
import { useCompany, useLogoUrl } from './queries'
import { ErrorState, PageLoading } from '../ui'

// S28. The company requisites again, as settings: the saved values, changed and saved in place. Documents
// already issued keep their own copy of the requisites (the service's rule), so editing here is safe.
export function SettingsScreen() {
  const company = useCompany()
  const logo = useLogoUrl()

  if (!company.data) {
    if (company.isPending) return <PageLoading screen="S28" />
    return <ErrorState screen="S28" error={company.error} onRetry={() => void company.refetch()} retrying={company.isFetching} />
  }
  // The logo is a second call. If it fails, that is shown with its own retry like any other failed call.
  if (logo.isPending) return <PageLoading screen="S28" />
  if (logo.isError) {
    return <ErrorState screen="S28" error={logo.error} onRetry={() => void logo.refetch()} retrying={logo.isFetching} />
  }

  return (
    <div className="page" data-screen="S28">
      <h1 className="sr-only">{t('screen.S28.title')}</h1>
      <p className="muted">{t('company.settings.lead')}</p>
      <CompanyForm
        key={company.data.id}
        mode="settings"
        initial={valuesFromCompany(company.data)}
        savedLogoUrl={logo.data ?? null}
      />
    </div>
  )
}
