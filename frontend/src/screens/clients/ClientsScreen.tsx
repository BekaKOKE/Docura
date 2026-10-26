import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Search, SearchX, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { t, tCount } from '../../i18n/t'
import { services, type Client } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { ClientForm } from './ClientForm'
import { Banner, EmptyState, ListSkeleton } from './parts'
import { errorText } from './errorText'

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 250
const SKELETON_ROWS = 5

/** The value after it has stopped changing for `delay` ms, so a request goes out per pause, not per letter. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

function ClientRow({ client }: { client: Client }) {
  const contacts = [client.phone, client.email].filter((value): value is string => Boolean(value))
  return (
    <li>
      <Link className="cl-row" to={`/clients/${client.id}`}>
        <span className="cl-row-text">
          <span className="cl-row-title">{client.name}</span>
          <span className="cl-row-meta">
            {client.kind === 'company' && <span>{t('clients.kind.company')}</span>}
            {client.phone && <span className="cl-nowrap">{client.phone}</span>}
            {client.email && <span className="cl-wrap">{client.email}</span>}
            {client.archivedAt && <span>{t('clients.row.archived')}</span>}
            {contacts.length === 0 && client.kind === 'person' && !client.archivedAt && (
              <span>{t('clients.row.noContacts')}</span>
            )}
          </span>
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>
    </li>
  )
}

// S22: the clients list with search, the archive filter and the create form (opened by "?new=1", which the [+] sheet sets).
export function ClientsScreen() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const formOpen = params.get('new') === '1'

  const [text, setText] = useState('')
  const [archived, setArchived] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [created, setCreated] = useState<string | null>(null)
  const q = useDebounced(text.trim(), SEARCH_DELAY_MS)

  const list = useQuery({
    queryKey: ['clients', 'list', { q, archived, limit }],
    queryFn: () => services.clients.list({ q, archived, limit }),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (!created) return
    const timer = setTimeout(() => setCreated(null), 6000)
    return () => clearTimeout(timer)
  }, [created])

  const setForm = (open: boolean) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (open) next.set('new', '1')
        else next.delete('new')
        return next
      },
      { replace: !open },
    )

  function onSaved(client: Client) {
    void queryClient.invalidateQueries({ queryKey: ['clients'] })
    setText('')
    setArchived(false)
    setLimit(PAGE_SIZE)
    setCreated(client.name)
    setForm(false)
  }

  const data = list.data
  const searching = q !== ''
  const nothingYet = data?.total === 0 && !searching && !archived
  const countText =
    data && searching && data.total > 0 ? t('clients.found', { count: tCount('count.client', data.total) }) : ''
  const addButton = (
    <button type="button" className="btn btn-primary btn-block cl-add" onClick={() => setForm(true)}>
      <UserPlus aria-hidden="true" />
      <span className="dc-label">{t('clients.add')}</span>
    </button>
  )

  // A failed refetch keeps the rows already on screen and shows the banner above them (components.md, "error").
  const errorBanner = list.isError ? (
    <Banner
      tone="danger"
      title={t('clients.error.title')}
      action={
        <button type="button" className="btn btn-secondary" onClick={() => void list.refetch()}>
          <span className="dc-label">{t('clients.retry')}</span>
        </button>
      }
    >
      {errorText(list.error)}
    </Banner>
  ) : null

  let body
  if (!data) {
    body = errorBanner ? null : <ListSkeleton rows={SKELETON_ROWS} label={t('clients.loading')} />
  } else if (nothingYet) {
    body = <EmptyState icon={Users} title={t('clients.empty.title')} text={t('clients.empty.text')} action={addButton} />
  } else if (data.total === 0 && searching) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('clients.noResults.title')}
        text={t('clients.noResults.text', { q })}
        action={
          <button type="button" className="btn btn-secondary" onClick={() => setText('')}>
            <span className="dc-label">{t('clients.noResults.reset')}</span>
          </button>
        }
      />
    )
  } else if (data.total === 0) {
    body = <EmptyState icon={Users} title={t('clients.emptyArchive.title')} text={t('clients.emptyArchive.text')} />
  } else {
    body = (
      <>
        <ul className="card cl-list" aria-busy={list.isPlaceholderData || undefined}>
          {data.items.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))}
        </ul>
        {data.total > data.items.length && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            <span className="dc-label">{t('clients.more')}</span>
          </button>
        )}
      </>
    )
  }

  return (
    <div className="page" data-screen="S22">
      <h1 className="cl-sr-only">{t('screen.S22.title')}</h1>

      {created && <Banner tone="success">{t('clients.created', { name: created })}</Banner>}
      {data && !nothingYet && addButton}

      {!nothingYet && (
        <div className="cl-toolbar">
          <div className="cl-search" role="search">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="cl-control"
              aria-label={t('clients.search.label')}
              placeholder={t('clients.search.placeholder')}
              value={text}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(event) => {
                setText(event.target.value)
                setLimit(PAGE_SIZE)
              }}
            />
            {text !== '' && (
              <button type="button" className="icon-btn" aria-label={t('clients.search.clear')} onClick={() => setText('')}>
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="cl-chips" role="group" aria-label={t('clients.filter.label')}>
            <button
              type="button"
              className="cl-chip"
              aria-pressed={archived}
              onClick={() => {
                setArchived((value) => !value)
                setLimit(PAGE_SIZE)
              }}
            >
              {archived && <Check aria-hidden="true" />}
              <span className="dc-label">{t('clients.filter.archive')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Always in the page, so screen readers hear the count change; visible only while there is something to say. */}
      <p className={countText ? 'cl-count' : 'cl-sr-only'} aria-live="polite">
        {countText}
      </p>

      {errorBanner}
      {body}

      <BottomSheet open={formOpen} title={t('clientForm.title.new')} onClose={() => setForm(false)}>
        <ClientForm onSaved={onSaved} onCancel={() => setForm(false)} />
      </BottomSheet>
    </div>
  )
}
