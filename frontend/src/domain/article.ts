// The rules for a catalogue item, shared by the form (instant feedback) and the mock service (the same
// check on save, as the backend will do). Returns dictionary keys, not text: the caller shows them through t(),
// so no visible string lives in the domain (AGENTS.md rule 6).

import type { ArticleErrorKey } from '../i18n/catalog'
import { parsePriceTiyn } from './money'

/** The units a catalogue item can have, in the order the form offers them (spec §4.3, schema.sql). */
export const ARTICLE_UNITS = ['шт', 'м', 'м²', 'м³', 'п.м.', 'кг', 'т', 'л', 'ч', 'смена', 'компл.', 'услуга'] as const
export type ArticleUnit = (typeof ARTICLE_UNITS)[number]

export const ARTICLE_KINDS = ['service', 'material'] as const

export const ARTICLE_LIMITS = { title: 300, description: 2000 } as const

export type ArticleField = 'title' | 'kind' | 'unit' | 'unitPriceTiyn'
export type ArticleFieldErrors = Partial<Record<ArticleField, ArticleErrorKey>>

export function isArticleUnit(value: unknown): value is ArticleUnit {
  return typeof value === 'string' && (ARTICLE_UNITS as readonly string[]).includes(value)
}

export type PriceParse = { ok: true; tiyn: number } | { ok: false; error: ArticleErrorKey }

// A minus sign the way people type it: hyphen-minus, the real minus U+2212, en and em dashes.
const MINUS = /^[-−–—]\s*/

/**
 * What a typed price means. "18 500" → 1850000 tiyn, "18500,50" and "18500.5" → 1850050.
 * A negative number and anything that isn't a number get different messages: the first is a slip of the sign,
 * the second is a typo. Zero is a valid price.
 */
export function parsePriceInput(text: string): PriceParse {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, error: 'article.error.priceRequired' }
  if (MINUS.test(trimmed)) {
    const rest = trimmed.replace(MINUS, '')
    return { ok: false, error: parsePriceTiyn(rest) === null ? 'article.error.priceFormat' : 'article.error.priceNegative' }
  }
  const tiyn = parsePriceTiyn(trimmed)
  return tiyn === null ? { ok: false, error: 'article.error.priceFormat' } : { ok: true, tiyn }
}

export function titleError(value: string | null | undefined): ArticleErrorKey | null {
  const title = (value ?? '').trim()
  if (title === '') return 'article.error.titleRequired'
  return title.length > ARTICLE_LIMITS.title ? 'article.error.titleLong' : null
}

export function unitError(value: string | null | undefined): ArticleErrorKey | null {
  return isArticleUnit(value) ? null : 'article.error.unitInvalid'
}

export function priceTiynError(value: unknown): ArticleErrorKey | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return 'article.error.priceFormat'
  return value < 0 ? 'article.error.priceNegative' : null
}

/** The fields a save looks at (the shape of `ArticleInput`). */
export interface ArticleDraft {
  kind: string
  title: string
  unit: string
  unitPriceTiyn: number
}

/** Every field's error; an empty object means the item can be saved. */
export function validateArticle(draft: ArticleDraft): ArticleFieldErrors {
  const errors: ArticleFieldErrors = {}
  const title = titleError(draft.title)
  if (title) errors.title = title
  if (!(ARTICLE_KINDS as readonly string[]).includes(draft.kind)) errors.kind = 'article.error.kindInvalid'
  const unit = unitError(draft.unit)
  if (unit) errors.unit = unit
  const price = priceTiynError(draft.unitPriceTiyn)
  if (price) errors.unitPriceTiyn = price
  return errors
}
