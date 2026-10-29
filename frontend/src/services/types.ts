// Domain types of the services layer (replica/architecture.md, "Services layer contract" and "API";
// replica/schema.sql for the columns). They are the wire shapes: camelCase, as in contracts/fixtures/seed.json.
//
// Conventions (replica/architecture.md, "Wire format"):
//   money        integer tiyn in fields named `...Tiyn` (1 ₸ = 100 tiyn). Never a float.
//   quantities   integer thousandths in `qtyMilli` (2500 = 2.5).
//   rates        integer basis points in `...Bp` (1600 = 16.00 %).
//   dates        `YYYY-MM-DD` strings: calendar days in the company's time zone.
//   timestamps   ISO 8601 strings in UTC, ending in `Z`.
//   ids          UUID strings.
// Totals are computed by src/domain (#12) and by the backend; these types only carry them.

/** UUID string. */
export type Id = string
/** `YYYY-MM-DD`, a calendar day in the company's time zone. */
export type IsoDate = string
/** ISO 8601 timestamp in UTC, e.g. `2026-10-15T06:20:00Z`. */
export type IsoTimestamp = string
/** Integer tiyn (1 ₸ = 100 tiyn). */
export type Tiyn = number
/** Integer thousandths: 2500 is 2.5. */
export type QtyMilli = number
/** Integer basis points: 1600 is 16.00 %. */
export type BasisPoints = number

export type Currency = 'KZT'

/** A page of a list. `total` counts every match, not just `items`. */
export interface Page<T> {
  items: T[]
  total: number
}

export interface PageParams {
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------- auth

export type Locale = 'ru' | 'kk'

export interface User {
  id: Id
  email: string
  fullName: string
  locale: Locale
}

export interface RegisterInput {
  email: string
  password: string
  fullName: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthSession {
  accessToken: string
  user: User
}

/** The signed-in user and their companies (one in the MVP). */
export interface Me {
  user: User
  companies: Company[]
}

// ---------------------------------------------------------------- company

export type LegalForm = 'ip' | 'too' | 'ao' | 'other'

export interface CompanyInput {
  legalForm: LegalForm
  legalName: string
  /** 12 digits; the checksum is validated by src/domain. */
  binIin: string
  address: string
  phone?: string | null
  email?: string | null
  /** "Сдал" on the АВР. */
  directorName: string
  directorPosition: string
  vatPayer: boolean
  vatCertificate?: string | null
  bankName?: string | null
  /** KZ IBAN, 20 characters. */
  iik?: string | null
  bik?: string | null
  /** 2 digits. */
  kbe?: string | null
  /** Default КНП, 3 digits. */
  defaultKnp?: string | null
  /** IANA name, never a fixed offset. Defaults to `Asia/Almaty`. */
  timezone?: string
  /** Defaults to 14. */
  quoteValidityDays?: number
  /** Defaults to 5. */
  invoiceDueDays?: number
}

export interface Company {
  id: Id
  legalForm: LegalForm
  legalName: string
  binIin: string
  address: string
  phone: string | null
  email: string | null
  directorName: string
  directorPosition: string
  vatPayer: boolean
  vatCertificate?: string | null
  bankName: string | null
  iik: string | null
  bik: string | null
  kbe: string | null
  defaultKnp: string | null
  timezone: string
  quoteValidityDays: number
  invoiceDueDays: number
  currency: Currency
  /** True once a logo was uploaded; `company.logoUrl()` then returns a URL. */
  hasLogo: boolean
}

// ---------------------------------------------------------------- clients

export type ClientKind = 'person' | 'company'

export interface ClientInput {
  kind: ClientKind
  name: string
  /** Optional; validated when given. */
  binIin?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

export interface Client {
  id: Id
  companyId: Id
  kind: ClientKind
  name: string
  binIin: string | null
  contactName?: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes?: string | null
  /** `name` casefolded with ё → е: what the search compares against. */
  searchName: string
  /** Set when the client is archived (a client with documents is archived, not deleted). */
  archivedAt: IsoTimestamp | null
}

/** A client with their documents, newest first. */
export interface ClientDetail extends Client {
  documents: DocumentSummary[]
}

export interface ClientListParams extends PageParams {
  /** Search text, matched against `searchName`. */
  q?: string
  /** `true` lists archived clients, `false` or omitted only active ones. */
  archived?: boolean
}

// ---------------------------------------------------------------- articles (catalogue)

export type ArticleKind = 'service' | 'material'

export interface ArticleInput {
  kind: ArticleKind
  title: string
  description?: string | null
  /** шт, м, м², м³, п.м., кг, т, л, ч, смена, компл., услуга */
  unit: string
  unitPriceTiyn: Tiyn
}

export interface Article {
  id: Id
  companyId: Id
  kind: ArticleKind
  title: string
  /** `title` casefolded with ё → е. */
  searchTitle: string
  description?: string | null
  unit: string
  unitPriceTiyn: Tiyn
  archivedAt: IsoTimestamp | null
}

export interface ArticleListParams extends PageParams {
  q?: string
  kind?: ArticleKind
}

// ---------------------------------------------------------------- documents

export type DocumentType = 'quote' | 'invoice' | 'act'

/**
 * quote: draft → sent → signed | declined; invoice: draft → issued; act: draft → issued → signed.
 * `cancelled` is allowed on all three (schema.sql); the MVP has no screen that sets it.
 */
export type DocumentStatus = 'draft' | 'sent' | 'issued' | 'signed' | 'declined' | 'cancelled'

/** Derived from payments and `dueDate`, never stored. Invoices only. */
export type PaymentState = 'unpaid' | 'partial' | 'paid' | 'overdue'

/** How an invoice was made from a quote. */
export type InvoiceBasis = 'full' | 'percent' | 'amount' | 'remaining'

export interface PaymentSummary {
  state: PaymentState
  paidTiyn: Tiyn
  /** `grossTiyn` minus `paidTiyn`. */
  balanceTiyn: Tiyn
}

/** The requisites of the client as printed. Frozen once the document is issued or signed. */
export interface ClientSnapshot {
  kind: ClientKind
  name: string
  binIin: string | null
  contactName?: string | null
  phone: string | null
  email: string | null
  address: string | null
}

/** The requisites of the company as printed. Frozen once the document is issued or signed. */
export interface CompanySnapshot {
  legalForm: LegalForm
  legalName: string
  binIin: string
  address: string
  phone: string | null
  email?: string | null
  directorName: string
  directorPosition: string
  vatPayer: boolean
  vatCertificate?: string | null
  bankName: string | null
  iik: string | null
  bik: string | null
  kbe: string | null
  defaultKnp?: string | null
}

export interface DocumentLineInput {
  /** The catalogue item the line was copied from, if any. The line keeps its own copy of title, unit and price. */
  articleId?: Id | null
  kind: ArticleKind
  title: string
  description?: string | null
  unit: string
  qtyMilli: QtyMilli
  unitPriceTiyn: Tiyn
  /** Line discount in basis points. The MVP has no screen for it; defaults to 0. */
  discountBp?: BasisPoints
  /** Act only: "дата выполнения работ" of the Р-1 form. */
  workDate?: IsoDate | null
}

export interface DocumentLine {
  id: Id
  /** 0-based order within the document. */
  position: number
  articleId: Id | null
  kind: ArticleKind
  title: string
  description?: string | null
  unit: string
  qtyMilli: QtyMilli
  unitPriceTiyn: Tiyn
  discountBp: BasisPoints
  /** Before VAT. */
  netTiyn: Tiyn
  vatTiyn: Tiyn
  grossTiyn: Tiyn
  workDate?: IsoDate | null
}

/** A row of a document list. */
export interface DocumentSummary {
  id: Id
  companyId: Id
  type: DocumentType
  status: DocumentStatus
  /** `КП-2026-0001`, `СЧ-2026-0001`, `АВР-2026-0001`; null while the document is a draft. */
  number: string | null
  issueDate: IsoDate
  /** Quote only. */
  validUntil: IsoDate | null
  /** Invoice only. */
  dueDate: IsoDate | null
  clientId: Id
  /** From the client snapshot, so lists need no second call. */
  clientName: string
  /** The quote an invoice or an act was made from. */
  sourceDocumentId: Id | null
  currency: Currency
  netTiyn: Tiyn
  vatTiyn: Tiyn
  grossTiyn: Tiyn
  /** Bumped on every save; sent back on update to detect `version_conflict`. */
  version: number
  issuedAt: IsoTimestamp | null
  signedAt: IsoTimestamp | null
  /** A sent quote whose `validUntil` is before today in the company's time zone. Derived. */
  isExpired: boolean
  /** Invoices only; null for quotes and acts. */
  payment: PaymentSummary | null
}

/** The sign-on-screen evidence shown next to a signed document. Always called "Подпись на экране". */
export interface SignatureSummary {
  method: SignatureMethod
  signerName: string
  signedAt: IsoTimestamp
  documentVersion: number
}

export type SignatureMethod = 'drawn' | 'typed'

/** A full document: lines, totals, link, signature summary, payment state and the documents made from it. */
export interface Document extends DocumentSummary {
  periodFrom: IsoDate | null
  periodTo: IsoDate | null
  contractRef: string | null
  clientSnapshot: ClientSnapshot
  companySnapshot: CompanySnapshot
  /** Invoices made from a quote: how. */
  basis: InvoiceBasis | null
  /** Basis points for `percent`, tiyn for `amount`. */
  basisValue: number | null
  vatEnabled: boolean
  /** Copied onto the document, so a later rate change doesn't rewrite it. */
  vatRateBp: BasisPoints
  notes: string | null
  terms: string | null
  cancelledAt: IsoTimestamp | null
  lines: DocumentLine[]
  /** The public link `{PUBLIC_BASE_URL}/p/{token}`; null while the document is a draft. */
  shareUrl: string | null
  signature: SignatureSummary | null
  /** Invoices and acts made from this document (quotes only). */
  children: DocumentSummary[]
}

export interface DocumentInput {
  type: DocumentType
  clientId: Id
  /** Defaults to today in the company's time zone. */
  issueDate?: IsoDate
  validUntil?: IsoDate | null
  dueDate?: IsoDate | null
  periodFrom?: IsoDate | null
  periodTo?: IsoDate | null
  contractRef?: string | null
  vatEnabled: boolean
  lines: DocumentLineInput[]
  notes?: string | null
  terms?: string | null
  /** Idempotency key: a replay returns the existing document. */
  clientRequestId?: Id
}

/** Replaces an editable document, lines included. `version` is the one the editor loaded. */
export interface DocumentUpdateInput extends DocumentInput {
  version: number
}

export interface DocumentListParams extends PageParams {
  type?: DocumentType
  status?: DocumentStatus
  paymentState?: PaymentState
  clientId?: Id
  /** Search text: number or client name. */
  q?: string
  /** Issue date, inclusive. */
  from?: IsoDate
  /** Issue date, inclusive. */
  to?: IsoDate
}

/**
 * What to make from a signed quote.
 * - an act copies the quote lines (one active act per quote);
 * - an invoice is `full` (copies the lines), `percent` (basis points), `amount` (tiyn) or `remaining`
 *   (the quote total minus every non-cancelled invoice already made from it).
 */
export type ConvertInput = {
  /** Issue the new document at once instead of leaving a draft. */
  issue?: boolean
  /** Idempotency key: a replay returns the existing document. */
  clientRequestId: Id
} & (
  | { target: 'act' }
  | { target: 'invoice'; basis: 'full' | 'remaining' }
  | { target: 'invoice'; basis: 'percent'; basisValue: BasisPoints }
  | { target: 'invoice'; basis: 'amount'; basisValue: Tiyn }
)

export type DocumentEventType =
  | 'created'
  | 'updated'
  | 'issued'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'converted'
  | 'payment_added'
  | 'payment_removed'
  | 'cancelled'
  | 'link_rotated'

export interface DocumentEvent {
  id: Id
  documentId: Id
  type: DocumentEventType
  actorKind: 'user' | 'client' | 'system'
  /** Event details, e.g. the payment amount. */
  data: Record<string, unknown>
  at: IsoTimestamp
}

// ---------------------------------------------------------------- payments

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'kaspi' | 'other'

export interface PaymentInput {
  /** Greater than 0. */
  amountTiyn: Tiyn
  method: PaymentMethod
  paidOn: IsoDate
  note?: string | null
  /** Idempotency key: a replay returns the existing payment. */
  clientRequestId: Id
}

export interface Payment {
  id: Id
  companyId: Id
  documentId: Id
  amountTiyn: Tiyn
  currency: Currency
  method: PaymentMethod
  paidOn: IsoDate
  note: string | null
}

/** What recording a payment returns: the payment and the invoice's new state. */
export interface PaymentResult {
  payment: Payment
  paymentState: PaymentState
  balanceTiyn: Tiyn
}

// ---------------------------------------------------------------- dashboard

export interface DashboardParams {
  /** Defaults to the first day of the current month in the company's time zone. */
  from?: IsoDate
  /** Defaults to the last day of that month. */
  to?: IsoDate
}

export interface CountAndTotal {
  count: number
  grossTiyn: Tiyn
}

export interface CountAndBalance {
  count: number
  balanceTiyn: Tiyn
}

/** An activity row with the document it belongs to, so the dashboard needs no second call. */
export interface DashboardEvent extends DocumentEvent {
  documentType: DocumentType
  documentNumber: string | null
  clientName: string
}

export interface Dashboard {
  from: IsoDate
  to: IsoDate
  /** Sent quotes not yet signed. */
  awaitingSignature: CountAndTotal
  /** Quotes signed in the period. */
  signed: CountAndTotal
  /** Signed quotes as a share of the quotes decided in the period, 0 to 1; null when none were decided. */
  acceptanceRate: number | null
  /** Gross of invoices issued in the period (by `issueDate`). */
  invoicedTiyn: Tiyn
  /** Payments received in the period (by `paidOn`). */
  cashedTiyn: Tiyn
  /** Issued invoices not fully paid, with the part that is past its due date. */
  outstanding: CountAndBalance & { overdue: CountAndBalance }
  /** Signed quotes not fully invoiced, top 5. */
  toInvoice: DocumentSummary[]
  /** The last 10 events. */
  recentEvents: DashboardEvent[]
}

// ---------------------------------------------------------------- public (the client, no account)

/** The client's view of a document: whitelisted fields only (no internal notes, no other documents). */
export interface PublicDocument {
  type: DocumentType
  status: DocumentStatus
  number: string | null
  issueDate: IsoDate
  validUntil: IsoDate | null
  dueDate: IsoDate | null
  periodFrom: IsoDate | null
  periodTo: IsoDate | null
  contractRef: string | null
  clientSnapshot: ClientSnapshot
  companySnapshot: CompanySnapshot
  vatEnabled: boolean
  vatRateBp: BasisPoints
  currency: Currency
  netTiyn: Tiyn
  vatTiyn: Tiyn
  grossTiyn: Tiyn
  notes: string | null
  terms: string | null
  lines: DocumentLine[]
  /** Sent back on sign to detect `version_conflict`. */
  version: number
  /** True while the client can still sign: right type and status, and the quote not expired. */
  canSign: boolean
  isExpired: boolean
  signature: SignatureSummary | null
  /** URL of the company logo, or null. */
  logoUrl: string | null
  /** URL of the client's drawn signature (an image), or null while the quote is not signed. */
  signatureImageUrl: string | null
}

export interface PublicSignInput {
  signerName: string
  /** The drawn signature as a base64 PNG (≤ 200 KB decoded), without the `data:` prefix. */
  signaturePng: string
  /** "Подпись на экране" consent. */
  consentAccepted: true
  /** Consent to process personal data (name, signature, IP). */
  personalDataConsent: true
  /** The `version` of the document the client saw. */
  version: number
}
