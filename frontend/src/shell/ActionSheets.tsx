import { Link } from 'react-router'
import { createItems, moreItems, type SheetItem } from '../app/nav'
import { t } from '../i18n/t'
import { BottomSheet } from './BottomSheet'

interface SheetProps {
  open: boolean
  onClose: () => void
}

function SheetLinks({ items, onClose }: { items: readonly SheetItem[]; onClose: () => void }) {
  return (
    <ul className="sheet-list">
      {items.map(({ id, to, label, hint, icon: Icon }) => (
        <li key={id}>
          <Link className="sheet-row" to={to} onClick={onClose}>
            <Icon aria-hidden="true" />
            <span className="sheet-row-text">
              <span className="sheet-row-label dc-label">{t(label)}</span>
              {hint && <span className="sheet-row-hint">{t(hint)}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// The centre [+] of the TabBar: КП, Клиент, Работа в каталог.
export function CreateSheet({ open, onClose }: SheetProps) {
  return (
    <BottomSheet open={open} title={t('create.title')} onClose={onClose}>
      <SheetLinks items={createItems} onClose={onClose} />
    </BottomSheet>
  )
}

// The last tab of the TabBar: Каталог, Компания, Выйти.
export function MoreSheet({ open, onClose }: SheetProps) {
  return (
    <BottomSheet open={open} title={t('more.title')} onClose={onClose}>
      <SheetLinks items={moreItems} onClose={onClose} />
    </BottomSheet>
  )
}
