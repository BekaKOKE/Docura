// The mock CompanyService: onboarding creates the signed-in user's company, then settings read and change it.
// Everything runs on the company of the session (the store's scoped access), so there is no company id to
// pass and another company's rows can't be reached. The rules are the ones of the form (src/domain/company.ts).

import {
  cleanCompanyValue,
  COMPANY_FIELDS,
  validateCompanyField,
  type CompanyField,
} from '../../domain/company'
import { detectLogoType, LOGO_HEAD_BYTES, LOGO_MAX_BYTES, logoProblem } from '../../domain/logo'
import { t } from '../../i18n/t'
import type { CompanyService } from '../contracts'
import { ApiError } from '../errors'
import type { Company, CompanyInput, LegalForm } from '../types'
import { newId } from './ids'
import { toCompany } from './mappers'
import type { MockRuntime } from './runtime'
import type { StoredCompany } from './storeTypes'

export const LEGAL_FORMS: readonly LegalForm[] = ['ip', 'too', 'ao', 'other']
export const DEFAULT_TIMEZONE = 'Asia/Almaty'
export const DEFAULT_QUOTE_VALIDITY_DAYS = 14
export const DEFAULT_INVOICE_DUE_DAYS = 5

const validationError = (fields: Record<string, string>, message = t('apiError.validation_error')) =>
  new ApiError({ code: 'validation_error', message, fields })

/** The value of a text field of the input as the form rules read it: empty for null or missing. */
function textOf(input: Partial<CompanyInput>, field: CompanyField): string | undefined {
  const value = input[field]
  if (value === undefined) return undefined
  return value === null ? '' : String(value)
}

/** The fields of `input` that break a rule, keyed by field name. `requireAll` checks the fields that are missing too (create). */
function problems(input: Partial<CompanyInput>, requireAll: boolean): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const field of COMPANY_FIELDS) {
    const raw = textOf(input, field) ?? (requireAll && field !== 'quoteValidityDays' ? '' : undefined)
    if (raw === undefined) continue
    const key = validateCompanyField(field, raw)
    if (key) fields[field] = t(key)
  }
  const form = input.legalForm
  if (form === undefined ? requireAll : !LEGAL_FORMS.includes(form)) fields.legalForm = t('company.error.legalForm')
  return fields
}

/** The text fields of `input` as stored: cleaned, and null when an optional one is empty. */
function cleaned(input: Partial<CompanyInput>): Partial<StoredCompany> {
  const out: Record<string, unknown> = {}
  for (const field of COMPANY_FIELDS) {
    const raw = textOf(input, field)
    if (raw === undefined) continue
    const value = cleanCompanyValue(field, raw)
    if (field === 'quoteValidityDays') out[field] = Number(value)
    else if (field === 'bankName' || field === 'iik' || field === 'bik' || field === 'kbe' || field === 'defaultKnp' || field === 'phone') {
      out[field] = value === '' ? null : value
    } else out[field] = value
  }
  if (input.legalForm !== undefined) out.legalForm = input.legalForm
  if (input.vatPayer !== undefined) out.vatPayer = Boolean(input.vatPayer)
  if (input.email !== undefined) out.email = input.email === null || input.email.trim() === '' ? null : input.email.trim()
  if (input.vatCertificate !== undefined) out.vatCertificate = input.vatCertificate
  if (input.timezone !== undefined) out.timezone = input.timezone
  if (input.invoiceDueDays !== undefined) out.invoiceDueDays = input.invoiceDueDays
  return out as Partial<StoredCompany>
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

export function createMockCompany(getRuntime: () => MockRuntime): CompanyService {
  return {
    create(input) {
      const runtime = getRuntime()
      return runtime.call((): Company => {
        const fields = problems(input, true)
        if (Object.keys(fields).length > 0) throw validationError(fields)
        return runtime.store.writeAll((data) => {
          const user = data.session ? data.users.find((u) => u.id === data.session?.userId) : undefined
          if (!user) throw new ApiError({ code: 'unauthorized', message: t('apiError.unauthorized') })
          if (user.companyId) throw validationError({}, t('company.error.exists'))
          const defaults: Partial<StoredCompany> = {
            phone: null,
            email: null,
            bankName: null,
            iik: null,
            bik: null,
            kbe: null,
            defaultKnp: null,
            timezone: DEFAULT_TIMEZONE,
            quoteValidityDays: DEFAULT_QUOTE_VALIDITY_DAYS,
            invoiceDueDays: DEFAULT_INVOICE_DUE_DAYS,
          }
          // `cleaned` has every required field: `problems` refused the input otherwise.
          const company = {
            ...defaults,
            ...cleaned(input),
            id: newId(),
            currency: 'KZT',
            hasLogo: false,
          } as StoredCompany
          data.companies.push(company)
          user.companyId = company.id
          return toCompany(company)
        })
      })
    },

    get() {
      const runtime = getRuntime()
      return runtime.call((): Company => runtime.store.read((db) => toCompany(db.company())))
    },

    update(patch) {
      const runtime = getRuntime()
      return runtime.call((): Company => {
        const fields = problems(patch, false)
        if (Object.keys(fields).length > 0) throw validationError(fields)
        return runtime.store.write((db) => {
          const company = db.company()
          Object.assign(company, cleaned(patch))
          return toCompany(company)
        })
      })
    },

    uploadLogo(file) {
      const runtime = getRuntime()
      return runtime.call(async (): Promise<void> => {
        const head = new Uint8Array(await file.slice(0, LOGO_HEAD_BYTES).arrayBuffer())
        const problem = logoProblem(file.size, head)
        if (problem) {
          throw validationError({ logo: t(problem === 'type' ? 'logo.error.type' : 'logo.error.size') })
        }
        const type = detectLogoType(head)
        const bytes = new Uint8Array(await file.arrayBuffer())
        // The size was checked on the Blob; a Blob that lies about its size can't get past this.
        if (bytes.length > LOGO_MAX_BYTES) throw validationError({ logo: t('logo.error.size') })
        const dataUrl = `data:${type};base64,${bytesToBase64(bytes)}`
        runtime.store.write((db) => {
          const company = db.company()
          company.logoDataUrl = dataUrl
          company.hasLogo = true
        })
      })
    },

    logoUrl() {
      const runtime = getRuntime()
      return runtime.call((): string | null => runtime.store.read((db) => db.company().logoDataUrl ?? null))
    },
  }
}
