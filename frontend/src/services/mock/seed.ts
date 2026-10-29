// The seed: contracts/fixtures/seed.json, shared with the backend seed command (#45). It lives outside
// frontend/ on purpose (one file, two readers), so it is imported by relative path and never copied.

import seedFile from '../../../../contracts/fixtures/seed.json'
import { newId, newToken } from './ids'
import type {
  DocumentCounter,
  StoredArticle,
  StoredClient,
  StoredCompany,
  StoredDocument,
  StoredPayment,
  StoredShareLink,
  StoredSignature,
  StoreData,
  StoredUser,
} from './storeTypes'

/** The dev password of every seed user (contracts/README.md, "Dev logins"). Never reuse it anywhere real. */
export const DEV_PASSWORD = 'docura-dev-2026'

/** The seed file: the users have no password, the store gives them `DEV_PASSWORD`. */
export interface SeedFile {
  version: number
  referenceDate: string
  users: Omit<StoredUser, 'password'>[]
  companies: StoredCompany[]
  clients: StoredClient[]
  articles: StoredArticle[]
  documents: StoredDocument[]
  documentCounters: DocumentCounter[]
  shareLinks: StoredShareLink[]
  signatures: StoredSignature[]
  payments: StoredPayment[]
}

// The JSON import is typed by its literals; SeedFile is the shape the store relies on, and seed.test.ts checks it.
export const seed = seedFile as unknown as SeedFile

/**
 * The seed has a link for its quotes only. Every issued document has one on the backend (that is what "Отправить" shares),
 * so an issued invoice or act of the seed gets its link here, with a token of its own.
 */
function withShareLinks(documents: readonly StoredDocument[], links: readonly StoredShareLink[]): StoredShareLink[] {
  const made = [...links]
  for (const doc of documents) {
    if (doc.status === 'draft' || made.some((link) => link.documentId === doc.id)) continue
    made.push({
      id: newId(),
      companyId: doc.companyId,
      documentId: doc.id,
      token: newToken(),
      expiresAt: null,
      revokedAt: null,
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      createdAt: doc.issuedAt ?? `${doc.issueDate}T00:00:00Z`,
    })
  }
  return made
}

/** A fresh copy of the seed as store state: nobody signed in, every seed user with the dev password. */
export function createSeedData(): StoreData {
  const copy = structuredClone(seed)
  return {
    schemaVersion: 1,
    seedVersion: copy.version,
    users: copy.users.map((user) => ({ ...user, password: DEV_PASSWORD })),
    companies: copy.companies,
    clients: copy.clients,
    articles: copy.articles,
    documents: copy.documents,
    documentCounters: copy.documentCounters,
    shareLinks: withShareLinks(copy.documents, copy.shareLinks),
    signatures: copy.signatures,
    payments: copy.payments,
    session: null,
  }
}
