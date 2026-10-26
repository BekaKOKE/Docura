import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { pickScreen, titleKey, type Screen } from '../app/screens'
import { t } from '../i18n/t'
import { NotFound } from './NotFound'
import { Placeholder } from './Placeholder'

// One route can carry several screens that differ only by query (S15 and S21 share /documents/invoices).
export function ScreenRoute({ candidates, path }: { candidates: readonly Screen[]; path: string }) {
  const [search] = useSearchParams()
  const screen = pickScreen(candidates, search)

  useEffect(() => {
    if (screen) document.title = t('app.pageTitle', { title: t(titleKey(screen.id)) })
  }, [screen])

  if (!screen) return <NotFound />
  return <Placeholder screen={screen} path={path} />
}
