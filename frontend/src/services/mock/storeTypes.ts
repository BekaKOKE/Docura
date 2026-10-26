// The rows the mock store keeps. They follow contracts/fixtures/seed.json (and replica/schema.sql):
// camelCase, integer tiyn, ids are UUID strings, every row of a company carries `companyId`.
// Derived fields (a document's clientName, isExpired, payment state, children, shareUrl) are not stored;
// the services that read documents compute them (#18).

import type {
  Article,
  ArticleKind,
  BasisPoints,
  Client,
  ClientSnapshot,
  Company,
  CompanySnapshot,
  Currency,
  DocumentStatus,
  DocumentType,
  Id,
  InvoiceBasis,
  IsoDate,
  IsoTimestamp,
  Locale,
  Payment,
  QtyMilli,
  SignatureMethod,
  Tiyn,
} from '../types'

/** Mock only: the real API keeps an argon2id hash and never returns it. */
export interface StoredUser {
  id: Id
  email: string
  fullName: string
  locale: Locale
  /** The user's company; null until onboarding creates it. One company per user in the MVP. */
  companyId: Id | null
  role: 'owner'
  password: string
}

/** A company as stored. `hasLogo` is absent in the seed, which means false. */
export type StoredCompany = Omit<Company, 'hasLogo'> & { hasLogo?: boolean }

export interface StoredDocumentLine {
  id: Id
  position: number
  articleId: Id | null
  kind: ArticleKind
  title: string
  description?: string | null
  unit: string
  /** The quantity as typed, kept by the seed for display; `qtyMilli` is the value. */
  qtyText?: string
  qtyMilli: QtyMilli
  unitPriceTiyn: Tiyn
  discountBp: BasisPoints
  netTiyn: Tiyn
  vatTiyn: Tiyn
  grossTiyn: Tiyn
  workDate?: IsoDate | null
}

export interface StoredDocument {
  id: Id
  companyId: Id
  type: DocumentType
  status: DocumentStatus
  number: string | null
  issueDate: IsoDate
  validUntil: IsoDate | null
  dueDate: IsoDate | null
  periodFrom: IsoDate | null
  periodTo: IsoDate | null
  contractRef: string | null
  clientId: Id
  clientSnapshot: ClientSnapshot
  companySnapshot: CompanySnapshot
  sourceDocumentId: Id | null
  currency: Currency
  netTiyn: Tiyn
  vatTiyn: Tiyn
  grossTiyn: Tiyn
  version: number
  issuedAt: IsoTimestamp | null
  signedAt: IsoTimestamp | null
  cancelledAt: IsoTimestamp | null
  basis: InvoiceBasis | null
  basisValue: number | null
  vatEnabled: boolean
  vatRateBp: BasisPoints
  notes: string | null
  terms: string | null
  lines: StoredDocumentLine[]
  /** The idempotency key the document was created with (`create` replays return it). Absent in the seed. */
  clientRequestId?: Id | null
}

export interface DocumentCounter {
  companyId: Id
  type: DocumentType
  year: number
  lastNumber: number
}

export interface StoredShareLink {
  id: Id
  companyId: Id
  documentId: Id
  token: string
  expiresAt: IsoTimestamp | null
  revokedAt: IsoTimestamp | null
  viewCount: number
  firstViewedAt: IsoTimestamp | null
  lastViewedAt: IsoTimestamp | null
  createdAt: IsoTimestamp
}

export interface StoredSignature {
  id: Id
  companyId: Id
  documentId: Id
  shareLinkId: Id
  method: SignatureMethod
  signerRole: 'client'
  signerName: string
  /** The drawn signature, a PNG as base64 (no `data:` prefix). */
  imagePngBase64: string | null
  imageSha256: string | null
  documentSha256: string
  documentVersion: number
  documentSnapshot: unknown
  consentText: string
  ip: string | null
  userAgent: string | null
  signedAt: IsoTimestamp
}

export type StoredClient = Client
export type StoredArticle = Article
export type StoredPayment = Payment

export interface Session {
  userId: Id
  accessToken: string
}

/** Everything the mock keeps, and exactly what is saved under `docura.mock.v1`. */
export interface StoreData {
  /** The layout of this object. Bump it when the shape changes; an old save is then dropped for the seed. */
  schemaVersion: 1
  /** `version` of the seed file this state grew from; a newer seed replaces the save. */
  seedVersion: number
  users: StoredUser[]
  companies: StoredCompany[]
  clients: StoredClient[]
  articles: StoredArticle[]
  documents: StoredDocument[]
  documentCounters: DocumentCounter[]
  shareLinks: StoredShareLink[]
  signatures: StoredSignature[]
  payments: StoredPayment[]
  session: Session | null
}

/** The collections whose rows belong to one company and are only reachable through `ScopedDb`. */
export type ScopedCollection = 'clients' | 'articles' | 'documents' | 'payments' | 'shareLinks' | 'signatures'

export type RowOf<K extends ScopedCollection> = StoreData[K][number]
