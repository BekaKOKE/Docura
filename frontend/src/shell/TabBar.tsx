import { Ellipsis, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { tabIcons, type TabId } from '../app/nav'
import { t } from '../i18n/t'

interface TabBarProps {
  current: TabId | null
  homeTo: string
  documentsTo: string
  clientsTo: string
  createOpen: boolean
  moreOpen: boolean
  onCreate: () => void
  onMore: () => void
}

// Phone navigation (below 1024 px): Главная · Документы · [+] · Клиенты · Ещё. 64 px plus the safe area.
export function TabBar({
  current,
  homeTo,
  documentsTo,
  clientsTo,
  createOpen,
  moreOpen,
  onCreate,
  onMore,
}: TabBarProps) {
  const links = [
    { id: 'home', to: homeTo, label: t('nav.home'), icon: tabIcons.home },
    { id: 'documents', to: documentsTo, label: t('nav.documents'), icon: tabIcons.documents },
    { id: 'clients', to: clientsTo, label: t('nav.clients'), icon: tabIcons.clients },
  ] as const
  const [home, documents, clients] = links.map(({ id, to, label, icon: Icon }) => (
    <Link key={id} className="tab" to={to} aria-current={current === id ? 'page' : undefined}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Link>
  ))

  return (
    <nav className="tabbar" aria-label={t('nav.main')}>
      {home}
      {documents}
      <button
        type="button"
        className="tab-create"
        aria-label={t('nav.create')}
        aria-haspopup="dialog"
        aria-expanded={createOpen}
        onClick={onCreate}
      >
        <Plus aria-hidden="true" />
      </button>
      {clients}
      <button
        type="button"
        className={current === 'more' ? 'tab tab-current' : 'tab'}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={onMore}
      >
        <Ellipsis aria-hidden="true" />
        <span>{t('nav.more')}</span>
      </button>
    </nav>
  )
}
