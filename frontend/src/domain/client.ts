// The rules for a client's fields, shared by the form (instant feedback) and the mock service (the same
// check on save, as the backend will do). Returns dictionary keys, not text: the caller shows them through t(),
// so no visible string lives in the domain (AGENTS.md rule 6).

import type { ClientErrorKey } from '../i18n/clients'
import { validateIinBin } from './binIin'

export const CLIENT_LIMITS = {
  name: 300,
  contactName: 200,
  phone: 32,
  email: 254,
  address: 2000,
} as const

export type ClientField = 'name' | 'binIin' | 'phone' | 'email' | 'contactName' | 'address'
export type ClientFieldErrors = Partial<Record<ClientField, ClientErrorKey>>

/** The fields the rules look at. Everything but the name may be missing or blank. */
export interface ClientDraft {
  name: string
  binIin?: string | null
  phone?: string | null
  email?: string | null
  contactName?: string | null
  address?: string | null
}

/** A typed ИИН/БИН without the spaces people put in the middle ("880715 301 453"). */
export function normalizeBinIin(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '')
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Digits with the usual separators; 10 to 15 digits covers +7 and 8 numbers and international ones.
const PHONE_CHARS = /^[+\d\s().-]+$/

/** Which rule a non-empty ИИН/БИН breaks, or null when it is valid (the checksum is `validateIinBin`). */
export function binIinError(value: string): ClientErrorKey | null {
  if (value === '') return null
  if (!/^\d+$/.test(value)) return 'client.error.binIinDigits'
  if (value.length !== 12) return 'client.error.binIinLength'
  return validateIinBin(value) === null ? null : 'client.error.binIinChecksum'
}

export function phoneError(value: string): ClientErrorKey | null {
  if (value === '') return null
  const digits = value.replace(/\D/g, '').length
  return PHONE_CHARS.test(value) && digits >= 10 && digits <= 15 ? null : 'client.error.phoneInvalid'
}

export function emailError(value: string): ClientErrorKey | null {
  return value === '' || EMAIL_PATTERN.test(value) ? null : 'client.error.emailInvalid'
}

/** The error of one field, or null. Blank optional fields are fine; the name is required. */
export function clientFieldError(field: ClientField, raw: string | null | undefined): ClientErrorKey | null {
  const value = field === 'binIin' ? normalizeBinIin(raw) : (raw ?? '').trim()
  switch (field) {
    case 'name':
      if (value === '') return 'client.error.nameRequired'
      return value.length > CLIENT_LIMITS.name ? 'client.error.nameLong' : null
    case 'binIin':
      return binIinError(value)
    case 'phone':
      return value.length > CLIENT_LIMITS.phone ? 'client.error.fieldLong' : phoneError(value)
    case 'email':
      return value.length > CLIENT_LIMITS.email ? 'client.error.fieldLong' : emailError(value)
    case 'contactName':
    case 'address':
      return value.length > CLIENT_LIMITS[field] ? 'client.error.fieldLong' : null
  }
}

const FIELDS: readonly ClientField[] = ['name', 'binIin', 'phone', 'email', 'contactName', 'address']

/** Every field's error; an empty object means the client can be saved. */
export function validateClient(draft: ClientDraft): ClientFieldErrors {
  const errors: ClientFieldErrors = {}
  for (const field of FIELDS) {
    const error = clientFieldError(field, draft[field])
    if (error) errors[field] = error
  }
  return errors
}
