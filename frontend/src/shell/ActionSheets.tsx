import { Link } from 'react-router'
import { createItems, moreItems, type SheetItem } from '../app/nav'
import { useLogout } from '../app/session'
import { t } from '../i18n/t'
import { BottomSheet } from './BottomSheet'

interface SheetProps {
  open: boolean
  onClose: () => void
}

function SheetRowContent({ item }: { item: SheetItem }) {
  const Icon = item.icon
  return (
    <>
      <Icon aria-hidden="true" />
      <span className="sheet-row-text">
        <span className="sheet-row-label dc-label">{t(item.label)}</span>
        {item.hint && <span className="sheet-row-hint">{t(item.hint)}</span>}
      </span>
    </>
  )
}

function SheetLinks({
  items,
  onClose,
  onAction,
}: {
  items: readonly SheetItem[]
  onClose: () => void
  onAction?: (action: NonNullable<SheetItem['action']>) => void
}) {
  return (
    <ul className="sheet-list">
      {items.map((item) => (
        <li key={item.id}>
          {item.action ? (
            <button
              type="button"
              className="sheet-row"
              onClick={() => {
                onClose()
                onAction?.(item.action!)
              }}
            >
              <SheetRowContent item={item} />
            </button>
          ) : (
            <Link className="sheet-row" to={item.to} onClick={onClose}>
              <SheetRowContent item={item} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

// The centre [+] of the TabBar: quote, client, catalogue item.
export function CreateSheet({ open, onClose }: SheetProps) {
  return (
    <BottomSheet open={open} title={t('create.title')} onClose={onClose}>
      <SheetLinks items={createItems} onClose={onClose} />
    </BottomSheet>
  )
}

// The last tab of the TabBar: catalogue, company, sign out. "Выйти" really ends the session (#15 AC 1).
export function MoreSheet({ open, onClose }: SheetProps) {
  const logout = useLogout()
  return (
    <BottomSheet open={open} title={t('more.title')} onClose={onClose}>
      <SheetLinks items={moreItems} onClose={onClose} onAction={() => void logout()} />
    </BottomSheet>
  )
}
