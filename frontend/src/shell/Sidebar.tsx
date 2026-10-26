import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { sidebarItems, type NavSection } from '../app/nav'
import { t } from '../i18n/t'

// Desktop navigation (1024 px and wider), 248 px: the create button on top, then the seven sections.
export function Sidebar({ current }: { current: NavSection | null }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">{t('app.name')}</div>
      <Link className="btn btn-primary btn-block" to="/quotes/new">
        <Plus aria-hidden="true" />
        <span className="dc-label">{t('nav.createQuote')}</span>
      </Link>
      <nav aria-label={t('nav.main')}>
        <ul className="sidebar-list">
          {sidebarItems.map(({ section, to, label, icon: Icon }) => (
            <li key={section}>
              <Link
                className="sidebar-link"
                to={to}
                aria-current={current === section ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span className="dc-label">{t(label)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
