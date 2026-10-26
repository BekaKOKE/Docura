// Stored rows to the wire shapes of ../types. Services return these, never the stored rows themselves
// (a stored user has a password; a stored company may lack the fields the wire shape requires).

import type { Company, User } from '../types'
import type { StoredCompany, StoredUser } from './storeTypes'

export function toUser(user: StoredUser): User {
  return { id: user.id, email: user.email, fullName: user.fullName, locale: user.locale }
}

export function toCompany(company: StoredCompany): Company {
  return {
    ...company,
    phone: company.phone ?? null,
    email: company.email ?? null,
    bankName: company.bankName ?? null,
    iik: company.iik ?? null,
    bik: company.bik ?? null,
    kbe: company.kbe ?? null,
    defaultKnp: company.defaultKnp ?? null,
    hasLogo: company.hasLogo ?? false,
  }
}
