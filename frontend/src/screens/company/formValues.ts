// The company form as text boxes: the values on screen, how a saved company fills them, and how they become
// the CompanyInput the service saves. The rules for each value are in src/domain/company.ts.

import { cleanCompanyValue } from '../../domain/company'
import type { MessageKey } from '../../i18n/t'
import type { Company, CompanyInput, LegalForm } from '../../services'

export interface CompanyFormValues {
  legalForm: LegalForm
  legalName: string
  binIin: string
  address: string
  phone: string
  directorName: string
  directorPosition: string
  vatPayer: boolean
  bankName: string
  iik: string
  bik: string
  kbe: string
  defaultKnp: string
  quoteValidityDays: string
}

/** The text fields (everything the user types), as a type for the field helpers. */
export type CompanyTextField = Exclude<keyof CompanyFormValues, 'legalForm' | 'vatPayer'>

export const LEGAL_FORM_OPTIONS: readonly { value: LegalForm; label: MessageKey }[] = [
  { value: 'ip', label: 'company.form.ip' },
  { value: 'too', label: 'company.form.too' },
  { value: 'ao', label: 'company.form.ao' },
  { value: 'other', label: 'company.form.other' },
]

export const DEFAULT_KNP = '859'
export const DEFAULT_VALIDITY_DAYS = '14'

/** The position the "Сдал" line of an акт starts from, by legal form; the user can change it. */
export const defaultPositionKey = (form: LegalForm): MessageKey =>
  form === 'ip' ? 'company.position.ip' : 'company.position.director'

export function emptyCompanyValues(): CompanyFormValues {
  return {
    legalForm: 'ip',
    legalName: '',
    binIin: '',
    address: '',
    phone: '',
    directorName: '',
    directorPosition: '',
    vatPayer: false,
    bankName: '',
    iik: '',
    bik: '',
    kbe: '',
    defaultKnp: DEFAULT_KNP,
    quoteValidityDays: DEFAULT_VALIDITY_DAYS,
  }
}

export function valuesFromCompany(company: Company): CompanyFormValues {
  return {
    legalForm: company.legalForm,
    legalName: company.legalName,
    binIin: company.binIin,
    address: company.address,
    phone: company.phone ?? '',
    directorName: company.directorName,
    directorPosition: company.directorPosition,
    vatPayer: company.vatPayer,
    bankName: company.bankName ?? '',
    iik: company.iik ?? '',
    bik: company.bik ?? '',
    kbe: company.kbe ?? '',
    defaultKnp: company.defaultKnp ?? '',
    quoteValidityDays: String(company.quoteValidityDays),
  }
}

/** What the service saves: cleaned text, and null for an optional field left empty. */
export function toCompanyInput(values: CompanyFormValues): CompanyInput {
  const optional = (field: CompanyTextField) => cleanCompanyValue(field, values[field]) || null
  return {
    legalForm: values.legalForm,
    legalName: cleanCompanyValue('legalName', values.legalName),
    binIin: cleanCompanyValue('binIin', values.binIin),
    address: cleanCompanyValue('address', values.address),
    phone: optional('phone'),
    directorName: cleanCompanyValue('directorName', values.directorName),
    directorPosition: cleanCompanyValue('directorPosition', values.directorPosition),
    vatPayer: values.vatPayer,
    bankName: optional('bankName'),
    iik: optional('iik'),
    bik: optional('bik'),
    kbe: optional('kbe'),
    defaultKnp: optional('defaultKnp'),
    quoteValidityDays: Number(cleanCompanyValue('quoteValidityDays', values.quoteValidityDays)),
  }
}
