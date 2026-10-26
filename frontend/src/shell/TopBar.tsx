import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { t } from '../i18n/t'

interface TopBarProps {
  title: string
  /** When set, a back button leads the bar (detail and full-screen screens on a phone). */
  onBack?: () => void
  /** Trailing actions: one primary action and the overflow menu, later. */
  children?: ReactNode
}

// Page header: 56 px on a phone, 64 px on desktop with the title on the left and the actions on the right.
export function TopBar({ title, onBack, children }: TopBarProps) {
  return (
    <header className="topbar" data-back={onBack ? 'true' : undefined}>
      {onBack && (
        <button type="button" className="icon-btn topbar-back" aria-label={t('nav.back')} onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </button>
      )}
      <div className="topbar-title">{title}</div>
      {children && <div className="topbar-actions">{children}</div>}
    </header>
  )
}
