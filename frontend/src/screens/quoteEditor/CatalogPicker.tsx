import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, Package, Search, SearchX, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '../../i18n/t'
import { services, type Article, type ArticleKind } from '../../services'
import { BottomSheet } from '../../shell/BottomSheet'
import { errorText } from '../clients/errorText'
import { Banner, ListSkeleton, Money } from '../clients/parts'
import './pickers.css'

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 250
const SKELETON_ROWS = 5
const KINDS: readonly ArticleKind[] = ['service', 'material']

/** «Работа · м²»: the small line under an item's title. */
export function articleMetaLine(article: Pick<Article, 'kind' | 'unit'>): string {
  return `${t(`catalog.kind.${article.kind}`)} · ${article.unit}`
}

/** The kind chip a tap lands on: tapping the active one clears the filter. */
export function nextKind(current: ArticleKind | undefined, tapped: ArticleKind): ArticleKind | undefined {
  return current === tapped ? undefined : tapped
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

function ArticleRow({ article, onPick }: { article: Article; onPick: (article: Article) => void }) {
  return (
    <li>
      <button type="button" className="pk-row" data-with-price="" onClick={() => onPick(article)}>
        <span className="pk-row-text">
          <span className="pk-row-title">{article.title}</span>
          <span className="pk-row-meta">
            <span>
              {t(`catalog.kind.${article.kind}`)} · <span className="pk-nowrap">{article.unit}</span>
            </span>
          </span>
        </span>
        <span className="pk-row-price">
          <Money tiyn={article.unitPriceTiyn} />
          <span className="pk-per pk-nowrap">/ {article.unit}</span>
        </span>
      </button>
    </li>
  )
}

interface BodyProps {
  onPick: (article: Article) => void
}

function CatalogPickerBody({ onPick }: BodyProps) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ArticleKind | undefined>(undefined)
  const q = useDebounced(text.trim(), SEARCH_DELAY_MS)

  const list = useQuery({
    queryKey: ['articles', 'picker', { q, kind: kind ?? null }],
    queryFn: () => services.articles.list({ q, kind, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const data = list.data
  const filtering = q !== '' || kind !== undefined
  const errorBanner = list.isError ? (
    <Banner
      tone="danger"
      title={t('qe.catalog.error')}
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
    body = errorBanner ? null : <ListSkeleton rows={SKELETON_ROWS} label={t('catalog.loading')} />
  } else if (data.total === 0 && !filtering) {
    body = <Note icon={Package} text={t('qe.catalog.empty')} />
  } else if (data.total === 0) {
    body = <Note icon={SearchX} text={t('qe.catalog.none')} />
  } else {
    body = (
      <ul className="card pk-list" aria-busy={list.isPlaceholderData || undefined}>
        {data.items.map((article) => (
          <ArticleRow key={article.id} article={article} onPick={onPick} />
        ))}
      </ul>
    )
  }

  return (
    <div className="pk-body">
      <div className="cl-search" role="search">
        <Search aria-hidden="true" />
        <input
          type="search"
          className="cl-control"
          aria-label={t('qe.catalog.searchLabel')}
          placeholder={t('qe.catalog.search')}
          value={text}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => setText(event.target.value)}
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
            onClick={() => setKind(nextKind(kind, option))}
          >
            {kind === option && <Check aria-hidden="true" />}
            <span className="dc-label">{t(`catalog.filter.${option}`)}</span>
          </button>
        ))}
      </div>
      {errorBanner}
      {body}
    </div>
  )
}

export interface CatalogPickerProps {
  open: boolean
  onClose: () => void
  /** One tap, one line: the screen adds it and closes the sheet itself. */
  onPick: (article: Article) => void
}

// S07 picker: add a line from the catalogue (components.md "LineItem > From catalogue").
export function CatalogPicker({ open, onClose, onPick }: CatalogPickerProps) {
  return (
    <BottomSheet open={open} title={t('qe.catalog.sheet')} onClose={onClose}>
      <CatalogPickerBody onPick={onPick} />
    </BottomSheet>
  )
}
