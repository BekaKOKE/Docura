# Architecture: Docura (a rebuild of Khosmos's core features for Kazakhstan)

Inputs: `replica/recon.md`, `replica/features.csv`. Schema: `replica/schema.sql`, tested on SQLite 3.45 and PostgreSQL 18.
Date: 2026-10-19

## MVP scope

As set by the user. Screen, flow and feature IDs refer to `recon.md`.

| in the MVP | screens | flows |
| --- | --- | --- |
| Sign up, log in, one company with KZ requisites | S01, S02, S03, S28 | F01, F14 (partly) |
| Clients | S22, S23 (simple) | F12 |
| Item catalogue | S24 | F13 |
| Quote (КП) in KZT, VAT 16% toggle | S06, S07, S08, S13 | F02 |
| Public link with finger signature, remote or handed over on site | S09, S10, S11 | F02, F03 |
| Quote → счёт на оплату (full, %, amount, remainder) | S14, S15, S16 | F04 |
| Quote → акт выполненных работ (form Р-1 layout) | S18 | F07 |
| Manual payment tracking | S16, S21 | F05 |
| Simple dashboard | S04 | F10 |
| Russian UI | all | — |

Post-MVP, in build order (see P1–P5): SMS codes, Kazakh language, team roles + accountant access, Kaspi, ЭЦП/NCALayer, ЭСФ.

**Recon must-haves that ride along at no extra cost.** These go beyond your list, so veto any you don't want:

- **Open tracking.** The public GET already exists, so it only adds a counter.
- **Live preview.** The same renderer serves the preview, the public page and print.
- **Drafts and sequential numbering.** The legal documents need them anyway.
- **Line reorder.** Lines have a `position` column; the UI can use up and down buttons.
- **Line discount.** It is a column and one term in the formula, and it's in the schema now so no migration is needed later. The UI for it is optional.
- **Cancel and duplicate.**

**Recon must-haves left out of the MVP:**

- photos (needs file storage)
- push and email notifications (no email in v1)
- credit notes
- subscription billing (no Stripe in v1)
- bilingual PDFs (Kazakh is post-MVP)
- SMS codes, team roles, Kazakh (your post-MVP list)

## Stack

Fixed by the course assignment. Additions stay inside that stack and are marked *(added)*.

| layer | choice | why |
| --- | --- | --- |
| web | React + TypeScript, built from the design references in `replica/design/` (`docs/design-approach.md`). *(added)* Vite, React Router, TanStack Query, `signature_pad` | Your stack. TanStack Query gives caching and the polling that the "quote signed?" check needs. `signature_pad` is a small, proven canvas pad |
| services layer | `frontend/src/services/`: one interface, two implementations, `mock` and `http`, picked by `VITE_API_MODE` | Your rule: every backend call goes through it. The mock lets the whole UI be built before the API exists |
| API contract | `contracts/openapi.yaml` (OpenAPI 3.1), written by hand from the services interface. *(added)* `openapi-typescript` generates the TS types | Build order step 2. One contract shared by the mock, the http client and FastAPI |
| backend | Python 3.12, FastAPI, uv. *(added)* `pydantic-settings`, `fastapi[standard]` (uvicorn, multipart) | Your stack. Sync endpoints with SQLAlchemy's sync engine are simpler and fast enough for one tenant per phone |
| database | SQLite through SQLAlchemy 2.0 ORM, `DATABASE_URL`. *(added)* Alembic with `render_as_batch=True` | Your stack. Alembic makes "Postgres later" a change of URL, not a rewrite. Batch mode works around SQLite's ALTER TABLE limits |
| storage switch | `STORAGE=memory\|sql`: repository interfaces with an in-memory and an SQLAlchemy implementation | Build order steps 3 and 4. The same service code and the same tests run on both |
| auth | Email + password, argon2id (`pwdlib`), JWT HS256 (`PyJWT`) bearer token, 12 h, `OAuth2PasswordBearer` | No third-party auth. Bearer tokens work in Swagger UI and from any device (the recon's "multisession" for free) |
| payments | none | No Stripe in v1. Client payments are recorded by hand (cash, transfer, card, Kaspi, other) |
| email | none | Documents go out as a link through WhatsApp (`wa.me/?text=`), `mailto:` or copy. WhatsApp is the main channel in KZ. Password reset waits until email exists |
| jobs | none | "Expired" and "overdue" are computed when read, so nothing has to run on a timer |
| files | Logo and signature PNGs as `bytea`/BLOB in the database, size-capped | Avoids file storage in v1. Photos (post-MVP) go to disk or object storage, not the database |
| PDF | The browser prints the shared React document renderer (A4 print CSS). "Скачать PDF" calls `window.print()` | One renderer for preview, public page and PDF, and it works with the mock. Server-side PDF is post-MVP if it's needed |
| hosting | Local for the course: `uv run uvicorn` + `npm run dev` with a Vite proxy. No Docker | Your rule. For production, KZ personal-data law requires storage on servers in Kazakhstan (Law on Personal Data, art. 12). Check it before choosing a host |

Repository layout:

```
contracts/
  openapi.yaml                      the API contract (M2)
  test-vectors/                     shared JSON cases: totals, prepayment split, ИИН/БИН, amount in words
frontend/
  src/services/contracts.ts         the Services interface: auth, company, clients, articles, documents, payments, dashboard, public
  src/services/types.ts             domain types (hand-written in M1, checked against generated api-types.ts from M2)
  src/services/mock/                in-memory state in localStorage ("docura.mock.v1"), fixtures, 150–400 ms latency, error injection
  src/services/http/                fetch client, bearer token, error mapping
  src/services/index.ts             export const services = VITE_API_MODE === 'http' ? http : mock
  src/domain/                       money.ts, totals.ts, amountInWords.ts, binIin.ts, iik.ts, format.ts  (pure, tested on the shared vectors)
  src/documents/                    QuoteDoc, InvoiceDoc, ActDoc: A4 renderers used by preview, public page and print
  src/i18n/ru.ts                    every string goes through t() from day one, so Kazakh is a file later, not a rewrite
backend/
  pyproject.toml, uv.lock
  app/main.py, app/config.py        Settings: DATABASE_URL, STORAGE, JWT_SECRET, PUBLIC_BASE_URL, CORS_ORIGINS
  app/api/                          routers: auth, companies, clients, articles, documents, payments, dashboard, public
  app/schemas/                      Pydantic models matching openapi.yaml (camelCase aliases)
  app/domain/                       totals, numbering, state machine, validators: pure Python, same test vectors
  app/services/                     use cases: issue, sign, convert, record payment. They take a unit of work
  app/repositories/                 base.py (Protocols), memory.py, sql.py
  app/db/                           models.py, session.py, types.py (UTCDateTime)
  migrations/                       Alembic
  tests/                            API suite parametrised over STORAGE=memory and sql
```

### Services layer contract (the seam the whole build order relies on)

```ts
// frontend/src/services/contracts.ts (shape, not final code)
export interface Services {
  auth: AuthService;            // register, login, me, logout
  company: CompanyService;      // create, get, update, uploadLogo, logoUrl
  clients: ClientsService;      // list({q, archived, limit, offset}), get, create, update, remove
  articles: ArticlesService;    // list({q, kind}), create, update, remove
  documents: DocumentsService;  // list, get, create, update(version), remove, issue, rotateLink,
                                // cancel, duplicate, convert, events, signatureBlob
  payments: PaymentsService;    // list(documentId), create, remove
  dashboard: DashboardService;  // get({from, to})
  public: PublicService;        // get(token), sign(token, input), decline(token, reason)
}
// Both implementations throw ApiError { status, code, message, fields? }.
// codes: validation_error, unauthorized, not_found, version_conflict, document_locked,
//        exceeds_quote_total, overpayment, already_signed, link_expired, link_revoked, rate_limited
```

Rules for the mock:

1. It runs the same state machine and the same `src/domain` totals the backend has, so the UI can't depend on behaviour the API won't have.
2. It can raise every error code above. A dev-only toggle forces `version_conflict`, `link_expired` and so on, so every one of those states can be built and checked.
3. `/p/:token` works in mock mode, in the same browser.

Wire format: JSON in camelCase (Pydantic `alias_generator=to_camel`). Money is integer tiyn in fields named `…Tiyn`. Dates are `YYYY-MM-DD`, timestamps ISO 8601 UTC (`Z`), ids UUID strings. Lists return `{items, total}` with `limit`/`offset`.
Errors use `{"error": {"code", "message", "fields"}}`, through custom handlers for `HTTPException` and `RequestValidationError`.

## Schema

Tables: 12 (`users`, `companies`, `memberships`, `clients`, `articles`, `documents`, `document_lines`, `document_counters`,
`share_links`, `signatures`, `payments`, `document_events`). Access rules are **data-layer checks, not RLS**: SQLite has no RLS, and
the same code must run on Postgres.

The full DDL with comments is in `replica/schema.sql`. Decisions:

- **One `documents` table for КП, счёт and АВР.** They share numbering, lines, totals, the renderer and the list screen.
  `type` is `quote|invoice|act`, and check constraints tie each type to its own statuses and fields.
  - quote: `draft → sent → signed | declined`, plus `cancelled`
  - invoice: `draft → issued`, plus `cancelled`. The payment state (`unpaid | partial | paid | overdue`) is **derived** from payments and `due_date`, never stored
  - act: `draft → issued → signed`, plus `cancelled`
- **Portable types only.** UUIDs are made in Python, not by `gen_random_uuid()`. Status fields are text plus a check, not native enums. JSON is written whole and read whole, never queried inside. No partial indexes, no `RETURNING` dependence, no SQLite pragmas in the schema itself.
- **Money.** `bigint` tiyn plus `currency = 'KZT'`. Quantities are `qty_milli` (thousandths), rates are basis points (`vat_rate_bp = 1600`). Nothing is float or numeric: SQLite stores numeric as float.
- **Times.** `timestamptz` in UTC through a `UTCDateTime` TypeDecorator, which rejects naive datetimes on write and attaches UTC on read (SQLite stores no zone). Business dates (`issue_date`, `due_date`, `paid_on`) are `date` in the company's time zone.
- **Snapshots.** `client_snapshot` and `company_snapshot` (JSON) refresh on every save while a document is editable and freeze when it's signed or issued. Editing a client later never changes an issued счёт.
- **Owner column.** Every row carries `company_id`, child rows included, so every repository query filters on it the same way.
- **`on delete`.** The rules are decided at the top of `schema.sql`. Deleting a company cascades through everything it owns. Clients and quotes that are referenced are protected with `no action`, which is checked at the end of the statement, so the company cascade still works on both databases. Only drafts can be deleted; that's an app rule.
- **Hard constraints the recon found, enforced in the database:**
  - `documents_number_uq (company_id, type, number)`: no duplicate document numbers. Drafts have `NULL` and don't collide.
  - `signatures_document_role_uq (document_id, signer_role)`: a document can't be signed twice, even by two taps in parallel.
  - `payments_request_uq` and `documents_request_uq (company_id, client_request_id)`: a retried request doesn't create a second payment or invoice.
  - `documents_totals_ck` (gross = net + vat), `documents_vat_ck` (no VAT when the toggle is off), `amount_tiyn > 0`.
- **SQLite runtime settings, in code, not schema:**
  - `PRAGMA foreign_keys = ON` on every connection, through an SQLAlchemy `connect` event; without it SQLite ignores the FKs.
  - `check_same_thread=False`, only when the URL starts with `sqlite`.

Post-MVP tables are listed at the bottom of `schema.sql`: `sign_challenges`, `esf_records`, `invitations`, `client_notes`, `document_photos`, `exports`.
`memberships.role` and `signatures.method` already allow the post-MVP values, so team roles and SMS or ЭЦП signing don't need to touch existing rows.

### Domain rules (implemented twice, in `frontend/src/domain` and `backend/app/domain`, and tested on the same `contracts/test-vectors`)

- **Line totals, integers only, round half up to the tiyn:**
  - `net = round(qty_milli × unit_price_tiyn × (10000 − discount_bp) / (1000 × 10000))`
  - `vat = vat_enabled ? round(net × vat_rate_bp / 10000) : 0`
  - `gross = net + vat`

  VAT is per line, as ЭСФ will want later. Document totals are the sums of the lines. The server recomputes on every save and is the source of truth; the client computes the same numbers for the live editor.
- **VAT toggle.** If the company isn't a VAT payer, the toggle is off and locked, and documents print "Без НДС". If it is, the toggle defaults to on at 16%. The rate is copied onto each document, so a future rate change doesn't rewrite old documents.
- **Conversions from a signed quote:**
  - `full`: an invoice that copies the lines.
  - `percent` / `amount`: a one-line prepayment invoice, "Предоплата N% по КП № … от …".
  - `remaining`: a one-line invoice for the quote total minus every non-cancelled invoice already made from it.

  For one-line invoices, `gross` is exact and VAT is split back out: `vat = round(gross × rate / (10000 + rate))`, `net = gross − vat`. The sum of the invoices can never exceed the quote total. An act copies the quote lines; one active act per quote in the MVP.
- **Numbering.** `КП-2026-0001`, `СЧ-2026-0001`, `АВР-2026-0001`, per company, type and year of `issue_date`. A number is assigned when the document leaves draft, from `document_counters` in the same transaction, so abandoned drafts leave no gaps.
- **Validators.**
  - ИИН/БИН: 12 digits, weights 1–11 mod 11; if the result is 10, weights 3–11,1,2; still 10 means invalid. ИИН verified against MVD order No. 521 ([docs/kz-rules.md, row 6](../docs/kz-rules.md#the-seven-rules)); the БИН rules are still to be checked.
  - ИИК: 20 characters, `KZ`, IBAN mod-97.
  - КНП: 3 digits. Кбе: 2 digits.
- **Amount in words.** The счёт and АВР print "сумма прописью" in tenge and tiyn, Russian declension, tiyn as two digits ([docs/kz-rules.md, row 4](../docs/kz-rules.md#the-seven-rules)). Lives in `src/domain/amountInWords.ts`, with test vectors.
- **Locking.**
  - A quote can be edited while `draft` or `sent`; every save bumps `version`. It's frozen once signed, declined or cancelled.
  - Invoices and acts can be edited only as drafts. After that, cancel and re-issue.
  - An invoice with payments can't be cancelled until its payments are removed.

## API

All routes are under `/api`. Company routes are `/api/companies/{cid}/…` and pass a `require_member(cid)` dependency; in the MVP, member means owner.
Every repository method takes `company_id` from that dependency, never from the request body. Another company's ids return **404**, not 403, so a probe can't learn whether something exists.

Routes: 38.

### F01, F14: account and company

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET /api/health` | liveness | public | — | `{ok}` | — |
| `POST /api/auth/register` | create a user, return a token | public, rate-limited | `{email, password, fullName}` | `{accessToken, user}` | F01 |
| `POST /api/auth/login` | check the password | public, rate-limited | `{email, password}` (also form-encoded for Swagger) | `{accessToken, user}` | F01 |
| `GET /api/me` | current user and their companies | user | — | `{user, companies[]}` | F01 |
| `POST /api/companies` | create a company and the owner membership | user | `CompanyInput` (legal form, name, ИИН/БИН, address, phone, director, VAT payer, bank, ИИК, БИК, Кбе, КНП) | `Company` | F01 |
| `GET /api/companies/{cid}` | read | member | — | `Company` | F14 |
| `PATCH /api/companies/{cid}` | update requisites, VAT, defaults | owner | `Partial<CompanyInput>` | `Company` | F14 |
| `PUT /api/companies/{cid}/logo` | upload a logo (PNG/JPEG ≤ 300 KB) | owner | multipart `file` | 204 | F14 |
| `GET /api/companies/{cid}/logo` | logo bytes | member | — | image | F14 |

### F12, F13: clients and catalogue

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET …/clients` | list and search on `search_name` | member | `q, archived, limit, offset` | `Page<Client>` | F12, F02 |
| `POST …/clients` | create (also inline from the quote editor) | member | `ClientInput` | `Client` | F12, F02 |
| `GET …/clients/{id}` | read, with a summary of their documents | member | — | `ClientDetail` | F12 |
| `PATCH …/clients/{id}` | update. Already-issued documents keep their snapshot | member | `Partial<ClientInput>` | `Client` | F12 |
| `DELETE …/clients/{id}` | delete if unused, archive if referenced | member | — | 204 | F12 |
| `GET …/articles` | list and search | member | `q, kind, limit, offset` | `Page<Article>` | F13, F02 |
| `POST …/articles` | create | member | `ArticleInput` (kind, title, description, unit, unitPriceTiyn) | `Article` | F13 |
| `PATCH …/articles/{id}` | update. Existing lines are untouched (they hold copies) | member | `Partial<ArticleInput>` | `Article` | F13 |
| `DELETE …/articles/{id}` | archive | member | — | 204 | F13 |

### F02–F07: documents, signing, conversion

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET …/documents` | list with filters | member | `type, status, paymentState, clientId, q, from, to, limit, offset` | `Page<DocumentSummary>` | F04, F05, F10 |
| `POST …/documents` | create a draft quote, invoice or act | member | `DocumentInput {type, clientId, issueDate?, validUntil?, dueDate?, periodFrom?, periodTo?, contractRef?, vatEnabled, lines[], notes?, terms?, clientRequestId?}` | `Document` | F02 |
| `GET …/documents/{id}` | full document: lines, totals, link, signature summary, payment state, children | member | — | `Document` | F02–F07 |
| `PUT …/documents/{id}` | replace an editable document, lines included | member | `DocumentInput + version` | `Document` · 409 `version_conflict` / `document_locked` | F02 |
| `DELETE …/documents/{id}` | delete a draft | member | — | 204 · 409 if not a draft | F02 |
| `POST …/documents/{id}/issue` | assign the number, freeze snapshots, status `sent` (quote) or `issued`, create the share link | member | `{}` | `Document` with `shareUrl` | F02, F03, F04, F07 |
| `POST …/documents/{id}/link` | rotate the link: revoke the old token, make a new one | member | — | `{shareUrl}` | F03 |
| `POST …/documents/{id}/cancel` | cancel a sent or issued document | member | `{reason?}` | `Document` · 409 if the invoice has payments | F06 |
| `POST …/documents/{id}/duplicate` | new draft copy with today's dates | member | — | `Document` | F02 |
| `POST …/documents/{id}/convert` | signed quote → invoice (`full\|percent\|amount\|remaining`) or act | member | `{target, basis?, basisValue?, issue?: true, clientRequestId}` | `Document` · 409 `exceeds_quote_total` | F04, F07 |
| `GET …/documents/{id}/events` | timeline | member | — | `DocumentEvent[]` | F10 |
| `GET …/documents/{id}/signature` | the client's signature image | member | — | `image/png` | F02 |

### F05, F10: payments and dashboard

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET …/documents/{id}/payments` | payments on an invoice | member | — | `Payment[]` | F05 |
| `POST …/documents/{id}/payments` | record a payment | member | `{amountTiyn, method, paidOn, note?, clientRequestId}` | `{payment, paymentState, balanceTiyn}` · 409 `overpayment` | F05 |
| `DELETE …/payments/{pid}` | remove a wrong entry (logged as an event) | owner | — | 204 | F05 |
| `GET …/dashboard` | KPIs for the period. Defaults to the current month in the company's time zone | member | `from, to` | see below | F10 |

Dashboard payload:

- `awaitingSignature {count, grossTiyn}`
- `signed {count, grossTiyn}` and the `acceptanceRate` for the period
- `invoicedTiyn` (by `issue_date`)
- `cashedTiyn` (by `paid_on`)
- `outstanding {count, balanceTiyn}` and its `overdue` subset
- `toInvoice[]`: signed quotes not fully invoiced, top 5
- `recentEvents[]`: last 10

### F02, F03: public (the client, no account)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `GET /api/public/{token}` | the client's view of the document. Counts a view unless the caller is a member of the company | token holder, rate-limited | — | `PublicDocument` (whitelisted fields, `version`, `canSign`) · 410 `link_revoked` | F02, F03 |
| `GET /api/public/{token}/logo` | company logo | token holder | — | image | F03 |
| `POST /api/public/{token}/sign` | sign a quote (status `sent`) or an act (status `issued`) | token holder, rate-limited | `{signerName, signaturePng (base64), consentAccepted: true, personalDataConsent: true, version}` | `PublicDocument` · 409 `version_conflict` / `already_signed` · 410 `link_expired` | F02, F03, F07 |
| `POST /api/public/{token}/decline` | the client declines a quote | token holder | `{reason?}` | `PublicDocument` | F03 |

**On-site signing (F02) reuses the public route.** "Подписать сейчас" issues the quote if it's still a draft, then opens `/p/{token}?handover=1` full screen on the tradesperson's phone.
The request carries the owner's token, so no view is counted, and the `signed` event records `{handover: true}`. That gives one signing path, one evidence format and one set of tests.

**Signing transaction.**

1. Load the link (not revoked) and the document.
2. Check the type and status, `version` equal to the client's, and for a quote `valid_until ≥ today` in the company's time zone.
3. Validate the PNG: magic bytes, ≤ 200 KB decoded. The blank-pad check runs on the client.
4. Insert the `signatures` row with the canonical JSON snapshot, its sha256, the consent texts, IP and user agent.
5. `UPDATE documents SET status='signed', signed_at=…, version=version+1 WHERE id=? AND version=?`. Zero rows → rollback, 409.
6. Write the `signed` event.

Webhooks in: none in v1. Webhooks out: none in v1.
Jobs: none in v1. Post-MVP: payment reminders (daily, 09:00 Asia/Almaty), IS ESF status poll (every 10 min while submissions are pending), SMS delivery callbacks.
External APIs: none in v1. Post-MVP, only official public APIs with the user's own keys: IS ESF API, NCALayer (local), a KZ SMS provider.
Never Khosmos's endpoints.

## The parts that bite

- **Time zones.** Kazakhstan has been one zone, UTC+5, since 2024-03-01, with no DST. Store the IANA name `Asia/Almaty`, never a fixed offset. Python on Windows needs the `tzdata` package for `zoneinfo`, and an old `tzdata` still gives Almaty +6. Pin a recent one. "Today", "this month", expiry and overdue are all computed in the company's zone. Timestamps are UTC.
- **Money.** Integer tiyn, half-up per line, the same algorithm in TS and Python, both tested on `contracts/test-vectors/totals.json`. Russian users type `2,5`: qty and price inputs accept a comma and a dot. Display uses `Intl.NumberFormat('ru-KZ')` with the ₸ sign.
- **Idempotency.**
  - Create document, convert and record payment take a `clientRequestId`. A replay returns the existing row with 200.
  - Signing is protected by the unique index plus the version compare-and-set; a repeat returns `already_signed`, and the UI treats it as success.
- **Races. One rule:** every write that depends on reading a document's state does a compare-and-set on `documents.version`.
  - This covers signing vs. editing, two conversions together pushing past the quote total, and a payment vs. a cancel.
  - It's portable: no `SELECT … FOR UPDATE`, which SQLite ignores, and the in-memory repo copies it with one lock.
  - Numbering serialises on the `document_counters` row update inside the same transaction.
- **Rate limits.** An in-process token bucket: `/api/auth/*` 5/min per IP+email, `/api/public/*` 60/min per IP, sign 5/min per token. It's per-process, which is fine for one uvicorn worker. It needs Redis if it ever scales out.
- **File sizes.** FastAPI has no default body limit. Reject `Content-Length` over 512 KB on JSON routes with 413, signature PNG over 200 KB, logo over 300 KB. Photos are post-MVP and will need streaming to disk.
- **Search.** SQLite `lower()` and `LIKE` fold ASCII only, so `Иван` wouldn't match `иван`. The app stores `search_name = name.casefold().replace('ё', 'е')` and queries with `LIKE` on that, which is the same on both databases. Sorting is by code point: Russian sorts correctly, Kazakh letters (ә ғ қ ң ө ұ ү һ і) sort after я. Acceptable for v1.
- **Fonts.** Even in a Russian-only UI, client names contain Kazakh letters. The document font must cover Cyrillic Extended (Noto Sans, Inter or PT Sans), or АВР and счёт print empty boxes.
- **Realtime.** None. The quote screen polls every 15 s while the status is `sent` and the tab is visible (TanStack Query `refetchInterval`), so "Подписано" shows up without websockets.
- **Offline.** Not in the MVP. The open editor keeps an unsaved copy in localStorage so a dropped connection on site doesn't lose a quote. That's a per-device convenience, not sync.
- **Public links.**
  - 256-bit tokens. The page sends `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`.
  - The payload is whitelisted: no internal notes, no other documents.
  - Links can be rotated. Viewing never expires; signing stops at `valid_until`.
  - **`PUBLIC_BASE_URL` must be reachable from the client's phone.** A link to `localhost` won't open over WhatsApp. For tests on a real phone, run `uvicorn --host 0.0.0.0` and `vite --host` on the LAN.
- **Legal weight of the signature.** In the MVP a drawn signature with an IP, user agent, timestamp and document hash is evidence of acceptance, not an ЭЦП. The UI says "Подпись на экране" and never "юридически значимая ЭЦП". SMS codes (P1) and ЭЦП (P5) strengthen it. Have a KZ lawyer review this before any marketing.
- **Personal data (KZ).** The public page asks for consent to process personal data (name, signature, IP) before signing. Deleting an account cascades the tenant. A client with documents is archived, not deleted, because documents are accounting records. Production hosting must be in Kazakhstan.
- **Multi-tenancy.** The company id in the path, a membership check, and `company_id` passed into every repository call. The API suite runs every route with another company's ids and expects 404.
- **SQLite → Postgres.**
  - Keep `PRAGMA foreign_keys=ON`.
  - Use batch-mode Alembic.
  - No JSON queries, no SQLite-only functions.
  - Run the suite against Postgres before calling it portable: `DATABASE_URL=postgresql+psycopg://…`, dev dependency `psycopg[binary]`. PostgreSQL 18 is already installed on this machine.
- **Mock drift.** The mock has to be retired as the source of truth once `openapi.yaml` exists. From M2 on, the TS types come from the contract and the backend has a parity test (`contracts/openapi.yaml` vs `app.openapi()`: paths, methods, status codes). Anything the UI uses that the contract lacks fails the build.
- **Printing.** `window.print()` output differs between mobile Chrome and Safari. Test the three A4 layouts on both. If they fall short, server-side PDF (e.g. WeasyPrint or fpdf2) is the fallback, post-MVP.

## Build order

Your order, with the skill's vertical-slice-first rule inside M1. The milestones match `docs/process.md`; the task-level
breakdown is `docs/tasks.md`.

**M0: repo and tooling** (nothing to click yet)
- Kazakhstan tax and document rules verified against official sources (`docs/kz-rules.md`).
- Shared `contracts/test-vectors/` and `contracts/fixtures/seed.json`, CI, issue templates, repo hygiene.

**M1: frontend with the mock service**
1. *Vertical slice, ugly, end to end on mock data.*
   - Screens: S01 → S03 → S07 (one client created inline, lines typed by hand) → S09 (copy link) → S11 (sign) → S13 (status "signed") → S14 (convert, full) → S16 (record payment) → S04 (numbers change).
   - Services used: `auth`, `company.create`, `clients.create`, `documents.create/get/issue/convert`, `public.get/sign`, `payments.create`, `dashboard.get`.
   - Proves the services seam, the domain module and the signing UX.
2. *The rest of the MVP screens:*
   - S06, S15 and an acts list, with filters.
   - S24 and the article picker in S07.
   - S22, S23.
   - S18: act editor and the Р-1 print layout.
   - S10: hand-over mode.
   - S08: print layouts for all three documents, with amount in words.
   - S28 with the logo, S21 (unpaid filter).
   - Cancel, duplicate, decline. Partial invoices (`percent`, `amount`, `remaining`). Events timeline.
   - Every error state (`version_conflict`, `link_expired`, `exceeds_quote_total`, `overpayment`, `validation_error`) and empty state.
   - Exit: every MVP flow is clickable on a phone, and the domain tests pass on the shared vectors.

**M2: `contracts/openapi.yaml`**
- Write it from `services/contracts.ts` and `types.ts`: 38 operations, the schemas, the error codes.
- Generate `src/services/api-types.ts`, then make the mock and the hand-written types compile against it.
- Tables: none. Routes: all 38, on paper.

**M3: backend, in memory (`STORAGE=memory`)**
- FastAPI app, routers, Pydantic schemas, `app/domain`, services with the unit of work, memory repositories.
- Auth and the rate limiter.
- pytest API suite: the flows, tenant isolation, version races, idempotent replays, the contract parity test.
- Tables: none, dicts shaped like the 12 tables. Routes: all 38.

**M4: backend on SQLite (`STORAGE=sql`)**
- SQLAlchemy models, the `UTCDateTime` type, the FK pragma.
- Alembic initial migration matching `schema.sql`.
- SQL repositories.
- The same suite, parametrised over memory and SQLite; one manual run on Postgres.
- Tables: all 12. Routes: unchanged.

**M5: connect the frontend**
- `http` services, the bearer token, error mapping, a Vite proxy for `/api`. Set `VITE_API_MODE=http`.
- Rerun the M1 vertical slice by hand on a real phone over the LAN, with the public link opened from WhatsApp.
- Exit: every MVP feature works end to end. Mark `clone = yes` in `features.csv` for the rows shipped.

**M6: hardening and real testing**
- Security limits, a printing check on phones and desktop, a performance budget, data safety and the consent texts.
- Sessions with real tradespeople and their clients on their own phones; every problem becomes a `user-test-bug` issue.

**Post-MVP, in this order:**
- **P1 SMS codes:** `sign_challenges`, a KZ SMS provider and its delivery webhook, `signatures.method = 'sms'`. Strengthens remote signing first.
- **P2 Kazakh:** `kk` strings, `users.locale`, bilingual document templates.
- **P3 Team roles + accountant access:**
  - `invitations`, plus the permission flags on `memberships`.
  - Repository checks for: own documents only, client base hidden, locked prices.
  - A read-only accountant role with CSV `exports`.
- **P4 Kaspi:** a Kaspi Pay link or QR stored on the invoice and shown on the public page. No public API was found, so payments stay manual, with method `kaspi`.
- **P5 ЭЦП and ЭСФ:**
  - NCALayer: the browser talks to the local NCALayer websocket, desktop only, to sign the АВР.
  - Then ЭСФ through the official IS ESF API: `esf_records`, a status poll job, buyer confirmation for corrections.
  - Read MinFin order No. 629 and the API spec first.
- **Then** the should-haves in `features.csv` (photos, notifications, credit notes, reports, cover page), then the fixes replica-entrepreneur finds.

**Riskiest parts of the MVP:**
1. Money maths written twice, in TS and Python. Shared test vectors from day one.
2. Signing integrity: version races, evidence and the honest legal wording.
3. Keeping SQLite and Postgres equivalent. Test on both in M4.
