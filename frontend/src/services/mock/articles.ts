// The mock ArticlesService (#17), on the company-scoped store. Same rules as the API: search on `searchTitle`
// (casefold + ё → е, Kazakh letters kept), items are archived and never deleted, an archived item is no longer
// listed, document lines keep their own copies (they never read the catalogue after they are saved), and
// another company's id is `not_found`.

import { validateArticle, type ArticleDraft } from '../../domain/article'
import { searchKey } from '../../domain/searchKey'
import { t } from '../../i18n/t'
import type { ArticlesService } from '../contracts'
import { ApiError } from '../errors'
import type { Article, ArticleInput, Page } from '../types'
import { newId } from './ids'
import type { MockRuntime } from './runtime'
import type { StoredArticle } from './storeTypes'

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

/** The stored item as the wire shape: every optional field present, nothing but what the type names. */
export function toArticle(row: StoredArticle): Article {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind,
    title: row.title,
    searchTitle: row.searchTitle,
    description: row.description ?? null,
    unit: row.unit,
    unitPriceTiyn: row.unitPriceTiyn,
    archivedAt: row.archivedAt ?? null,
  }
}

/** Throws `validation_error` with a Russian message per bad field when the item can't be saved. */
function assertValid(draft: ArticleDraft): void {
  const fields = Object.entries(validateArticle(draft))
  if (fields.length === 0) return
  throw new ApiError({
    code: 'validation_error',
    message: t('apiError.validation_error'),
    fields: Object.fromEntries(fields.map(([field, key]) => [field, t(key)])),
  })
}

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/** The fields as they are stored: title trimmed, a blank description is null. */
function normalized(input: ArticleInput): Omit<StoredArticle, 'id' | 'companyId' | 'searchTitle' | 'archivedAt'> {
  return {
    kind: input.kind,
    title: input.title.trim(),
    description: blankToNull(input.description),
    unit: input.unit,
    unitPriceTiyn: input.unitPriceTiyn,
  }
}

function clampPage(limit: number | undefined, offset: number | undefined): { limit: number; offset: number } {
  const size = Number.isFinite(limit) ? Math.trunc(limit as number) : DEFAULT_PAGE_SIZE
  const start = Number.isFinite(offset) ? Math.trunc(offset as number) : 0
  return { limit: Math.min(Math.max(size, 1), MAX_PAGE_SIZE), offset: Math.max(start, 0) }
}

export function createMockArticles(getRuntime: () => MockRuntime): ArticlesService {
  return {
    list(params = {}) {
      const runtime = getRuntime()
      return runtime.call((): Page<Article> =>
        runtime.store.read((db) => {
          const query = searchKey(params.q ?? '').trim()
          const matches = db
            .rows('articles')
            .filter((row) => row.archivedAt === null)
            .filter((row) => params.kind === undefined || row.kind === params.kind)
            .filter((row) => query === '' || row.searchTitle.includes(query))
            .sort((a, b) => a.searchTitle.localeCompare(b.searchTitle, 'ru'))
          const { limit, offset } = clampPage(params.limit, params.offset)
          return { items: matches.slice(offset, offset + limit).map(toArticle), total: matches.length }
        }),
      )
    },

    create(input) {
      const runtime = getRuntime()
      return runtime.call((): Article => {
        assertValid(input)
        return runtime.store.write((db) => {
          const fields = normalized(input)
          return toArticle(
            db.insert('articles', { id: newId(), ...fields, searchTitle: searchKey(fields.title), archivedAt: null }),
          )
        })
      })
    },

    update(id, patch) {
      const runtime = getRuntime()
      return runtime.call((): Article =>
        runtime.store.write((db) => {
          const current = toArticle(db.get('articles', id))
          const given = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
          const merged: ArticleInput = { ...current, ...given }
          assertValid(merged)
          const fields = normalized(merged)
          // Document lines hold copies of title, unit and price, so nothing else needs to change here.
          return toArticle(db.patch('articles', id, { ...fields, searchTitle: searchKey(fields.title) }))
        }),
      )
    },

    remove(id) {
      const runtime = getRuntime()
      return runtime.call((): void =>
        runtime.store.write((db) => {
          const row = db.get('articles', id)
          // Archive, never delete (spec §4.3). Archiving twice keeps the first date.
          if (row.archivedAt === null) db.patch('articles', id, { archivedAt: runtime.now().toISOString() })
        }),
      )
    },
  }
}
