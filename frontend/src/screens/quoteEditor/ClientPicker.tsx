import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, SearchX, UserPlus, Users, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '../../i18n/t'
import { services, type Client } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { ClientForm } from '../clients/ClientForm'
import { errorText } from '../clients/errorText'
import { Banner, ListSkeleton } from '../clients/parts'
import './pickers.css'

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 250
const SKELETON_ROWS = 5

export type ClientMetaPart =
  | { key: 'company'; text: string }
  | { key: 'phone'; text: string }
  | { key: 'email'; text: string }
  | { key: 'none'; text: string }

/**
 * The small line under a client's name, in order: «Компания», phone, e-mail. A person without a phone and an
 * e-mail gets «Контакты не указаны» so the row never looks broken (a company with no contacts shows its tag).
 */
export function clientMetaParts(client: Pick<Client, 'kind' | 'phone' | 'email'>): ClientMetaPart[] {
  const parts: ClientMetaPart[] = []
  if (client.kind === 'company') parts.push({ key: 'company', text: t('clients.kind.company') })
  if (client.phone) parts.push({ key: 'phone', text: client.phone })
  if (client.email) parts.push({ key: 'email', text: client.email })
  if (parts.length === 0) parts.push({ key: 'none', text: t('clients.row.noContacts') })
  return parts
}

/** The value after it has stopped changing for `delay` ms, so a request goes out per pause, not per letter. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

function Note({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="cl-empty" role="status">
      <Icon aria-hidden="true" />
      <p>{text}</p>
    </div>
  )
}

function ClientRow({ client, onPick }: { client: Client; onPick: (client: Client) => void }) {
  return (
    <li>
      <button type="button" className="pk-row" onClick={() => onPick(client)}>
        <span className="pk-row-text">
          <span className="pk-row-title">{client.name}</span>
          <span className="pk-row-meta">
            {clientMetaParts(client).map((part) => (
              <span key={part.key} className={part.key === 'phone' ? 'pk-nowrap' : part.key === 'email' ? 'pk-wrap' : undefined}>
                {part.text}
              </span>
            ))}
          </span>
        </span>
      </button>
    </li>
  )
}

interface BodyProps {
  onPick: (client: Client) => void
}

// The two views live in this component's state; the BottomSheet unmounts it on close, so a reopened sheet starts on the list.
function ClientPickerBody({ onPick }: BodyProps) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'list' | 'create'>('list')
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), SEARCH_DELAY_MS)

  const list = useQuery({
    queryKey: ['clients', 'picker', { q }],
    queryFn: () => services.clients.list({ q, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  if (view === 'create') {
    return (
      <>
        <div className="pk-back">
          <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
            <ArrowLeft aria-hidden="true" />
            <span className="dc-label">{t('qe.client.back')}</span>
          </button>
        </div>
        <ClientForm
          onCancel={() => setView('list')}
          onSaved={(client) => {
            void queryClient.invalidateQueries({ queryKey: ['clients'] })
            onPick(client)
          }}
        />
      </>
    )
  }

  const data = list.data
  const searching = q !== ''
  const errorBanner = list.isError ? (
    <Banner
      tone="danger"
      title={t('qe.client.error')}
      action={
        <button type="button" className="btn btn-secondary" onClick={() => void list.refetch()}>
          <span className="dc-label">{t('state.retry')}</span>
        </button>
      }
    >
      {errorText(list.error)}
    </Banner>
  ) : null

  let body
  if (!data) {
    body = errorBanner ? null : <ListSkeleton rows={SKELETON_ROWS} label={t('clients.loading')} />
  } else if (data.total === 0 && !searching) {
    body = <Note icon={Users} text={t('qe.client.empty')} />
  } else if (data.total === 0) {
    body = <Note icon={SearchX} text={t('qe.client.none')} />
  } else {
    body = (
      <ul className="card pk-list" aria-busy={list.isPlaceholderData || undefined}>
        {data.items.map((client) => (
          <ClientRow key={client.id} client={client} onPick={onPick} />
        ))}
      </ul>
    )
  }

  return (
    <>
      <div className="pk-body">
        <div className="cl-search" role="search">
          <Search aria-hidden="true" />
          <input
            type="search"
            className="cl-control"
            aria-label={t('qe.client.searchLabel')}
            placeholder={t('qe.client.search')}
            value={text}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setText(event.target.value)}
          />
          {text !== '' && (
            <button type="button" className="icon-btn" aria-label={t('clients.search.clear')} onClick={() => setText('')}>
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        {errorBanner}
        {body}
      </div>
      <div className="pk-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={() => setView('create')}>
          <UserPlus aria-hidden="true" />
          <span className="dc-label">{t('qe.client.new')}</span>
        </button>
      </div>
    </>
  )
}

export interface ClientPickerProps {
  open: boolean
  onClose: () => void
  /** The screen closes the sheet itself after this. */
  onPick: (client: Client) => void
}

// S07 picker: choose an existing client or create one without leaving the quote (components.md "PickerSheet").
export function ClientPicker({ open, onClose, onPick }: ClientPickerProps) {
  return (
    <BottomSheet open={open} title={t('qe.client.sheet')} onClose={onClose}>
      <ClientPickerBody onPick={onPick} />
    </BottomSheet>
  )
}
