import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, Package, Search, SearchX, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '../../i18n/t'
import { services, type Article, type ArticleKind } from '../../services'
import { errorText } from '../clients/errorText'
import { Banner, EmptyState, ListSkeleton, Money } from '../clients/parts'
import './catalog.css'

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 250
const SKELETON_ROWS = 5
const KINDS: readonly ArticleKind[] = ['service', 'material']

/** The value after it has stopped changing for `delay` ms, so a request goes out per pause, not per letter. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

function ArticleRow({ article }: { article: Article }) {
  return (
    <li>
      <div className="ct-row">
        <span className="ct-row-text">
          <span className="ct-row-title">{article.title}</span>
          <span className="ct-row-meta">
            {t(`catalog.kind.${article.kind}`)} · <span className="ct-nowrap">{article.unit}</span>
          </span>
        </span>
        <span className="ct-row-price">
          <Money tiyn={article.unitPriceTiyn} />
          <span className="ct-per ct-nowrap">/ {article.unit}</span>
        </span>
      </div>
    </li>
  )
}

// S24: the catalogue. A list of works and materials with search and a kind filter; the form that creates,
// edits and archives an item is opened from here.
export function CatalogScreen() {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ArticleKind | undefined>(undefined)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const q = useDebounced(text.trim(), SEARCH_DELAY_MS)

  const list = useQuery({
    queryKey: ['articles', 'list', { q, kind: kind ?? null, limit }],
    queryFn: () => services.articles.list({ q, kind, limit }),
    placeholderData: keepPreviousData,
  })

  const data = list.data
  const searching = q !== ''
  const nothingYet = data?.total === 0 && !searching && kind === undefined
  const countText =
    data && (searching || kind !== undefined) && data.total > 0
      ? t('catalog.found', { count: String(data.total) })
      : ''

  // A failed refetch keeps the rows already on screen and shows the banner above them (components.md, "error").
  const errorBanner = list.isError ? (
    <Banner
      tone="danger"
      title={t('catalog.error.title')}
      action={
        <button type="button" className="btn btn-secondary" onClick={() => void list.refetch()}>
          <span className="dc-label">{t('catalog.retry')}</span>
        </button>
      }
    >
      {errorText(list.error)}
    </Banner>
  ) : null

  let body
  if (!data) {
    body = errorBanner ? null : <ListSkeleton rows={SKELETON_ROWS} label={t('catalog.loading')} />
  } else if (nothingYet) {
    body = <EmptyState icon={Package} title={t('catalog.empty.title')} text={t('catalog.empty.text')} />
  } else if (data.total === 0 && searching) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('catalog.noResults.title')}
        text={t('catalog.noResults.text', { q })}
        action={
          <button type="button" className="btn btn-secondary" onClick={() => setText('')}>
            <span className="dc-label">{t('catalog.noResults.reset')}</span>
          </button>
        }
      />
    )
  } else if (data.total === 0) {
    body = (
      <EmptyState
        icon={Package}
        title={t('catalog.noKind.title')}
        text={t('catalog.noKind.text')}
        action={
          <button type="button" className="btn btn-secondary" onClick={() => setKind(undefined)}>
            <span className="dc-label">{t('catalog.noKind.reset')}</span>
          </button>
        }
      />
    )
  } else {
    body = (
      <>
        <ul className="card cl-list" aria-busy={list.isPlaceholderData || undefined}>
          {data.items.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </ul>
        {data.total > data.items.length && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            <span className="dc-label">{t('catalog.more')}</span>
          </button>
        )}
      </>
    )
  }

  return (
    <div className="page" data-screen="S24">
      <h1 className="cl-sr-only">{t('screen.S24.title')}</h1>

      {!nothingYet && (
        <div className="cl-toolbar">
          <div className="cl-search" role="search">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="cl-control"
              aria-label={t('catalog.search.label')}
              placeholder={t('catalog.search.placeholder')}
              value={text}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(event) => {
                setText(event.target.value)
                setLimit(PAGE_SIZE)
              }}
            />
            {text !== '' && (
              <button type="button" className="icon-btn" aria-label={t('catalog.search.clear')} onClick={() => setText('')}>
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="cl-chips" role="group" aria-label={t('catalog.filter.label')}>
            {KINDS.map((option) => (
              <button
                key={option}
                type="button"
                className="cl-chip"
                aria-pressed={kind === option}
                onClick={() => {
                  setKind(kind === option ? undefined : option)
                  setLimit(PAGE_SIZE)
                }}
              >
                {kind === option && <Check aria-hidden="true" />}
                <span className="dc-label">{t(`catalog.filter.${option}`)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Always in the page, so screen readers hear the count change; visible only while there is something to say. */}
      <p className={countText ? 'cl-count' : 'cl-sr-only'} aria-live="polite">
        {countText}
      </p>

      {errorBanner}
      {body}
    </div>
  )
}
