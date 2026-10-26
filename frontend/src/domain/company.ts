// The rules of the company form (spec §4.1, #15), shared by the form on screen and by the services that
// save it, so a value that passes in the form passes on save. Each rule returns a dictionary key (never
// text): the caller shows it through t(). ИИН/БИН, ИИК, Кбе and КНП use the validators of #12.

import { validationKey } from '../i18n/validation'
import type { MessageKey } from '../i18n/t'
import { validateIinBin } from './binIin'
import { validateIik } from './iik'
import { normalizeKzPhone } from './phone'
import { validateKbe, validateKnp } from './requisites'

export const COMPANY_FIELDS = [
  'legalName',
  'binIin',
  'address',
  'phone',
  'directorName',
  'directorPosition',
  'bankName',
  'iik',
  'bik',
  'kbe',
  'defaultKnp',
  'quoteValidityDays',
] as const
export type CompanyField = (typeof COMPANY_FIELDS)[number]

/** Fields that can't be empty. The rest are optional: empty is fine, a filled value must be right. */
export const REQUIRED_COMPANY_FIELDS: readonly CompanyField[] = [
  'legalName',
  'binIin',
  'address',
  'directorName',
  'directorPosition',
]

export const VALIDITY_DAYS_MIN = 1
export const VALIDITY_DAYS_MAX = 365

const requiredKey: Partial<Record<CompanyField, MessageKey>> = {
  legalName: 'company.error.legalName',
  address: 'company.error.address',
  directorName: 'company.error.directorName',
  directorPosition: 'company.error.directorPosition',
}

/** What a typed value becomes before it is checked and saved: no stray spaces, ИИК and БИК in capitals. */
export function cleanCompanyValue(field: CompanyField, raw: string): string {
  const value = raw.trim()
  switch (field) {
    case 'binIin':
    case 'kbe':
    case 'defaultKnp':
      return value.replace(/\s/g, '')
    case 'iik':
    case 'bik':
      return value.replace(/\s/g, '').toUpperCase()
    case 'phone':
      return normalizeKzPhone(value) ?? value
    default:
      return value
  }
}

/** The dictionary key of what is wrong with `raw`, or null when it is fine to save. */
export function validateCompanyField(field: CompanyField, raw: string): MessageKey | null {
  const value = cleanCompanyValue(field, raw)
  if (value === '') {
    if (field === 'binIin') return validationKey(validateIinBin(value))
    return REQUIRED_COMPANY_FIELDS.includes(field) ? (requiredKey[field] ?? 'validation.required') : null
  }
  switch (field) {
    case 'binIin':
      return validationKey(validateIinBin(value))
    case 'iik':
      return validationKey(validateIik(value))
    case 'kbe':
      return validationKey(validateKbe(value))
    case 'defaultKnp':
      return validationKey(validateKnp(value))
    case 'bik':
      return /^[A-Z0-9]{8}$/.test(value) ? null : 'company.error.bik'
    case 'phone':
      return normalizeKzPhone(value) === null ? 'company.error.phone' : null
    case 'quoteValidityDays': {
      const days = Number(value)
      const ok = /^\d+$/.test(value) && days >= VALIDITY_DAYS_MIN && days <= VALIDITY_DAYS_MAX
      return ok ? null : 'company.error.validityDays'
    }
    default:
      return null
  }
}

export type CompanyIssues = Partial<Record<CompanyField, MessageKey>>

/** The problems of every field in `values` (a field that isn't there isn't checked). */
export function validateCompanyValues(values: Partial<Record<CompanyField, string>>): CompanyIssues {
  const issues: CompanyIssues = {}
  for (const field of COMPANY_FIELDS) {
    const raw = values[field]
    if (raw === undefined) continue
    const issue = validateCompanyField(field, raw)
    if (issue) issues[field] = issue
  }
  return issues
}
