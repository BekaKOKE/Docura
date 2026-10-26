import { useEffect, type ComponentType } from 'react'
import { useSearchParams } from 'react-router'
import { pickScreen, titleKey, type Screen, type ScreenId } from '../app/screens'
import { t } from '../i18n/t'
import { ClientCard } from './clients/ClientCard'
import { ClientsScreen } from './clients/ClientsScreen'
import { NotFound } from './NotFound'
import { Placeholder } from './Placeholder'

// The screens whose content is built. The rest show the Placeholder until the issue named on it lands.
const built: Partial<Record<ScreenId, ComponentType>> = {
  S22: ClientsScreen,
  S23: ClientCard,
}

// One route can carry several screens that differ only by query (S15 and S21 share /documents/invoices).
export function ScreenRoute({ candidates, path }: { candidates: readonly Screen[]; path: string }) {
  const [search] = useSearchParams()
  const screen = pickScreen(candidates, search)

  useEffect(() => {
    if (screen) document.title = t('app.pageTitle', { title: t(titleKey(screen.id)) })
  }, [screen])

  if (!screen) return <NotFound />
  const Content = built[screen.id]
  return Content ? <Content /> : <Placeholder screen={screen} path={path} />
}
