// The services layer contract (replica/architecture.md, "Services layer contract").
//
// Every screen gets its data through `services` from `src/services`; nothing calls the backend or
// reads the mock store directly (AGENTS.md rule 1). There are two implementations of `Services`:
// `mock` (default, in the browser, #14 and #18) and `http` (M5, #52), chosen by VITE_API_MODE.
//
// Rules for both implementations:
//   - Every method returns a Promise and rejects with `ApiError` (./errors) on failure.
//   - They work on the active company, which is the signed-in user's company (one per user in the MVP),
//     so screens never pass a company id. Another company's ids are `not_found`.
//   - Money is integer tiyn, quantities are thousandths, rates are basis points, dates are `YYYY-MM-DD`
//     (./types). Totals follow the domain rules of src/domain and the backend.
//   - Only the MVP methods are here (docs/spec.md, D5).

import type {
  Article,
  ArticleInput,
  ArticleListParams,
  AuthSession,
  Client,
  ClientDetail,
  ClientInput,
  ClientListParams,
  Company,
  CompanyInput,
  ConvertInput,
  Dashboard,
  DashboardParams,
  Document,
  DocumentInput,
  DocumentListParams,
  DocumentSummary,
  DocumentUpdateInput,
  Id,
  LoginInput,
  Me,
  Page,
  Payment,
  PaymentInput,
  PaymentResult,
  PublicDocument,
  PublicSignInput,
  RegisterInput,
} from './types'

export interface AuthService {
  /** Creates the user and signs them in. `validation_error` for a bad or taken email. */
  register(input: RegisterInput): Promise<AuthSession>
  /** `unauthorized` for a wrong email or password; `rate_limited` after too many tries. */
  login(input: LoginInput): Promise<AuthSession>
  /** The signed-in user and their companies. `unauthorized` when signed out. */
  me(): Promise<Me>
  /** Forgets the session. Never fails. */
  logout(): Promise<void>
}

export interface CompanyService {
  /** Creates the company of the signed-in user (onboarding). */
  create(input: CompanyInput): Promise<Company>
  /** The active company. `not_found` before onboarding is done. */
  get(): Promise<Company>
  /** Updates requisites, VAT and defaults. Documents already issued keep their snapshot. */
  update(patch: Partial<CompanyInput>): Promise<Company>
  /** PNG or JPEG, at most 300 KB; `validation_error` otherwise. */
  uploadLogo(file: Blob): Promise<void>
  /** A URL an `<img>` can show, or null when there is no logo. */
  logoUrl(): Promise<string | null>
}

export interface ClientsService {
  list(params?: ClientListParams): Promise<Page<Client>>
  /** The client with their documents. */
  get(id: Id): Promise<ClientDetail>
  create(input: ClientInput): Promise<Client>
  /** Documents already issued keep their client snapshot. */
  update(id: Id, patch: Partial<ClientInput>): Promise<Client>
  /** Deletes an unused client, archives one that has documents. */
  remove(id: Id): Promise<void>
}

export interface ArticlesService {
  list(params?: ArticleListParams): Promise<Page<Article>>
  create(input: ArticleInput): Promise<Article>
  /** Existing document lines are untouched: they hold copies. */
  update(id: Id, patch: Partial<ArticleInput>): Promise<Article>
  /** Archives the item. */
  remove(id: Id): Promise<void>
}

export interface DocumentsService {
  list(params?: DocumentListParams): Promise<Page<DocumentSummary>>
  get(id: Id): Promise<Document>
  /** Creates a draft quote, invoice or act. A repeated `clientRequestId` returns the existing document. */
  create(input: DocumentInput): Promise<Document>
  /** Replaces an editable document, lines included. `version_conflict` when `input.version` is stale; `document_locked` when it can no longer be edited. */
  update(id: Id, input: DocumentUpdateInput): Promise<Document>
  /** Deletes a draft. `document_locked` for anything else. */
  remove(id: Id): Promise<void>
  /** Leaves draft: assigns the number, freezes the snapshots, creates the public link (`shareUrl`). */
  issue(id: Id): Promise<Document>
  /** From a signed quote: an invoice (`full`, `percent`, `amount`, `remaining`) or an act. `exceeds_quote_total` when invoices would pass the quote total. */
  convert(id: Id, input: ConvertInput): Promise<Document>
  /** The client's signature image (PNG) of a signed document. */
  signatureBlob(id: Id): Promise<Blob>
}

export interface PaymentsService {
  /** Payments on an invoice, oldest first. */
  list(documentId: Id): Promise<Payment[]>
  /** Records a payment by hand. `overpayment` when it passes the invoice balance. A repeated `clientRequestId` returns the existing payment. */
  create(documentId: Id, input: PaymentInput): Promise<PaymentResult>
  /** Removes a wrong entry. */
  remove(paymentId: Id): Promise<void>
}

export interface DashboardService {
  /** KPIs for the period; defaults to the current month in the company's time zone. */
  get(params?: DashboardParams): Promise<Dashboard>
}

/** The client's side of a shared link: no account, no bearer token; the token in the link is the credential. */
export interface PublicService {
  /** `link_revoked` for a withdrawn link, `not_found` for an unknown token, `rate_limited` when hammered. */
  get(token: string): Promise<PublicDocument>
  /**
   * Signs a quote with the finger signature ("Подпись на экране").
   * `version_conflict` when the document changed, `already_signed` when it already is
   * (the screen treats that as success), `link_expired` after `validUntil`.
   */
  sign(token: string, input: PublicSignInput): Promise<PublicDocument>
}

export interface Services {
  auth: AuthService
  company: CompanyService
  clients: ClientsService
  articles: ArticlesService
  documents: DocumentsService
  payments: PaymentsService
  dashboard: DashboardService
  public: PublicService
}
