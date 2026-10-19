# Docura: draft backlog

Status: **draft**. Milestones M0–M6 are the same as in `docs/process.md` and `replica/architecture.md`. These are not GitHub issues yet. When a task becomes an issue, the pm grooms it into `docs/task-template.md`
(acceptance criteria, out of scope, constraints) and qa adds test cases (`docs/process.md`). Scope follows `docs/spec.md`.

Each task is sized for **one session**: one person or agent can implement it and the qa-engineer can verify it in the running app of its milestone.

Format of each task:
- **number · title · label**
- one-line **Goal**
- a short **Description**, which names screens (S-IDs from `replica/recon.md`), spec sections and the tasks it depends on

## Milestones

| milestone | name | tasks | mvp | post-mvp |
| --- | --- | --- | --- | --- |
| M0 | Repo and tooling | T01–T06 | 6 | 0 |
| M1 | Frontend with mock services | T07–T33 | 27 | 0 |
| M2 | openapi.yaml | T34–T35 | 2 | 0 |
| M3 | Backend in memory | T36–T46 | 11 | 0 |
| M4 | SQLite with SQLAlchemy and Alembic | T47–T51 | 5 | 0 |
| M5 | Connect frontend and backend | T52–T55 | 4 | 0 |
| M6 | Hardening and real testing | T56–T60 | 5 | 0 |
| P | Post-MVP (after M6) | T61–T78 | 0 | 18 |
| | **total** | **78** | **60** | **18** |


---

## M0 · Repo and tooling

### T01 · Verify Kazakhstan tax rules against official sources · `mvp`
**Goal:** every tax and document rule the MVP relies on is confirmed against an official source before anyone codes it.
**Description:** check against official sources (kgd.gov.kz, adilet.zan.kz, egov.kz, the National Bank):
- the 16 % VAT rate, and whether construction or repair services have exemptions;
- the 2026 VAT registration threshold;
- what a non-VAT payer must print ("Без НДС");
- the requisites expected on a счёт на оплату (ИИК, БИК, Кбе, КНП codes);
- the current edition of form Р-1 (order No. 562 and amendments);
- the ИИН/БИН checksum algorithm;
- the personal-data localisation rule.

Write `docs/kz-rules.md`, one rule per row: the rule, the source URL, the date checked, and the effect on the spec or architecture. Close or update spec §11 open questions 2 and 3.

### T02 · Repository hygiene and README · `mvp`
**Goal:** the repo behaves the same on Windows and Linux, and a newcomer knows where to start.
**Description:** add `.gitattributes` (LF for text files, binary for PNG), `.editorconfig`, and a `README.md` with the one-paragraph pitch, links to `docs/` and `AGENTS.md`, and the planned folders. Create `contracts/` with a short README.

### T03 · GitHub issue templates · `mvp`
**Goal:** issues are created in the agreed shape without retyping the template.
**Description:** add two templates, copied from `docs/task-template.md` and `docs/process.md`:
- `.github/ISSUE_TEMPLATE/task.md`: Goal, Acceptance criteria, Out of scope, Constraints, Test cases
- `user-test-bug.md`: Goal, Description

The labels `mvp`, `post-mvp` and `user-test-bug` already exist (created 2026-10-19).

### T04 · Shared test vectors for money and validators · `mvp`
**Goal:** the frontend and backend prove the same maths against one set of expected results.
**Description:** `contracts/test-vectors/` with JSON cases and a README describing the format:
- `totals.json`: half-up rounding, VAT on and off, per-line VAT, comma quantities
- `prepayment.json`: % and ₸ prepayments, the remainder, the cap at the quote total
- `bin-iin.json`: valid and invalid
- `iik.json`: mod-97
- `amount-in-words.json`: 0, 1, 2, 5, 21, 1 000 000, tiyn declension

Values come from T01 and spec §6. Depends on T01.

### T05 · Shared seed data · `mvp`
**Goal:** the mock and the backend start from the same realistic data.
**Description:** `contracts/fixtures/seed.json` containing:
- a VAT-payer company (ИП Сейткали Б.) and a non-VAT company
- 3 clients with Kazakh and Russian names
- 8 catalogue items
- documents in every status (draft, sent, signed, declined, expired, invoice partly paid and overdue, act issued)

Use the test data from `docs/team/qa.md`. No real personal data.

### T06 · CI workflow · `mvp`
**Goal:** every push runs the checks, so red never reaches main unnoticed.
**Description:** a GitHub Actions workflow:
- frontend: `npm ci`, `typecheck`, `test`, `build`
- backend: `uv sync`, `ruff`, `pytest`

Each job runs only when its folder exists. Uses `actions/checkout`, `actions/setup-node` and `astral-sh/setup-uv`; confirm these actions with the user first (AGENTS.md rule 2).

---

## M1 · Frontend with mock services

The design agent generates all the MVP screens at once from `replica/design/brief.md` (T07). The rest of M1 wires each screen to the
mock services and brings it up to `replica/design/components.md`.

### T07 · Generate the frontend from the design brief and import it · `mvp`
**Goal:** a first React + TypeScript version of every MVP screen exists in `frontend/`.
**Description:** run `replica/design/brief.md` in the chosen tool (Claude Design, v0 or Lovable), export the code into `frontend/` and commit it as generated. List any screens the tool skipped as follow-ups in the issue.

### T08 · Align the generated app with AGENTS.md · `mvp`
**Goal:** the generated code follows the repo's commands, folders and dependency rules.
**Description:**
- Add the npm scripts from AGENTS.md: `dev`, `test`, `typecheck`, `lint`, `build`; `gen:api` stays a stub until T35.
- Create `src/services`, `src/domain`, `src/documents` and `src/i18n`.
- Audit `package.json` against the agreed list. Remove what isn't needed, and ask about anything else.
- Remove direct `fetch` calls and external services.

### T09 · Design tokens, fonts and layout rules · `mvp`
**Goal:** every screen uses Docura's tokens and renders Russian, Kazakh and ₸ correctly.
**Description:**
- Wire up `tokens.css` and the Tailwind mapping from `replica/design/`.
- Load Onest and IBM Plex Mono with the cyrillic, cyrillic-ext and latin-ext subsets.
- Add the `.dc-money`, `.dc-code` and `.dc-label` helpers.
- Use `minmax(0,1fr)` grids.
- Replace raw hex and default shadcn styling.

Verify with the specimen checks: ₸ drawn by Onest, no horizontal scroll at 360 px.

### T10 · App shell, navigation and t() · `mvp`
**Goal:** a user can reach every MVP screen on a phone and on desktop, all in Russian.
**Description:**
- Phone: TabBar (Главная · Документы · [+] · Клиенты · Ещё) and the [+] create sheet. Desktop (≥ 1024 px): Sidebar. TopBar on both.
- Routes for all MVP screens, with the Документы segmented control (КП · Счета · Акты).
- `t()` with a Russian dictionary and an `Intl.PluralRules('ru')` helper; every visible string goes through it.

### T11 · Services interfaces, types and error codes · `mvp`
**Goal:** every screen gets its data through one typed services layer.
**Description:**
- `src/services/contracts.ts`: auth, company, clients, articles, documents, payments, dashboard, public; shapes as in `replica/architecture.md`.
- `types.ts`.
- `ApiError` with the agreed codes.
- `index.ts` picks the implementation from `VITE_API_MODE`; the http implementation stays a stub that throws until M5.

### T12 · Domain: money, totals and formatting · `mvp`
**Goal:** the editor shows totals that are correct to the tiyn.
**Description:** `src/domain/money.ts` and `totals.ts`: parse "12,5" and "18 500", integer tiyn, line net/VAT/gross with half-up rounding, document totals, the prepayment VAT split, and `Intl ru-KZ` formatting. Vitest runs `contracts/test-vectors/totals.json` and `prepayment.json`. Depends on T04.

### T13 · Domain: validators and amount in words · `mvp`
**Goal:** requisites are validated and documents can print sums in words.
**Description:** `binIin.ts`, `iik.ts` and `amountInWords.ts` (тенге and тиын declension), tested with vitest against `bin-iin.json`, `iik.json` and `amount-in-words.json`. Also `searchKey()`: casefold, then ё → е.

### T14 · Mock store with seed, latency and error injection · `mvp`
**Goal:** the app behaves like a real backend before one exists.
**Description:**
- In-memory state persisted in `localStorage` (`docura.mock.v1`), loaded from `contracts/fixtures/seed.json`.
- 150–400 ms latency.
- A dev-only panel to force any ApiError code, and a "reset data" action.

Depends on T05 and T11.

### T15 · Account and company onboarding on mock (S01, S02, S03, S28) · `mvp`
**Goal:** a new user creates an account, enters the requisites every document prints, and can log back in.
**Description:**
- Register and login forms with validation and error states; mock auth with a fake token; a logged-out guard on app routes; logout under "Ещё".
- The company onboarding form, reused as settings: legal form, name, ИИН/БИН, address, director, VAT payer, bank, ИИК, БИК, Кбе, default КНП, validity days.
- The logo is stored in the mock as a data URL.
- ИИН/БИН and ИИК are validated inline (T13).

### T16 · Clients: list, search, create, edit, archive (S22, S23) · `mvp`
**Goal:** the owner finds or adds a client in seconds.
**Description:**
- The clients list with search through `searchKey`; "Ерке" finds "ерке", and Kazakh letters work.
- A person/company form with an optional ИИН/БИН.
- A simple client record listing their documents.
- A client with documents is archived, not deleted.
- Empty, loading and error states.

### T17 · Catalogue (S24) · `mvp`
**Goal:** frequent works and materials can be picked instead of typed.
**Description:** list, search, create, edit and archive items with kind (work/material), unit (шт, м, м², м³, п.м., кг, т, л, ч, смена, компл., услуга) and a price entered in MoneyInput. Empty state with one action.

### T18 · Mock documents service: quote lifecycle · `mvp`
**Goal:** quotes follow the real state machine even in mock mode.
**Description:**
- Mock `documents` for quotes: create a draft; update with a `version` check (409); `issue` (number КП-YYYY-NNNN with no gaps, snapshots, share token); cancel; duplicate; delete drafts.
- "Expired" is derived from `valid_until`.

Vitest covers the transitions and numbering. Spec §5.

### T19 · Quote editor: client and lines (S07) · `mvp`
**Goal:** a quote with a client and lines can be built one-handed.
**Description:**
- The client picker sheet with quick-create.
- LineItem cards with collapsed and expanded views: title, work/material, QuantityInput with a unit chip, MoneyInput.
- Add from the catalogue (2 taps per line) or by hand, with "Сохранить в каталог".
- Reorder with ↑↓; delete with undo.

### T20 · Quote editor: VAT, totals, validity, autosave and states (S07) · `mvp`
**Goal:** the owner sees correct totals and never loses a draft.
**Description:**
- The "НДС 16 %" switch; locked "Без НДС" for non-VAT payers.
- The ink totals bar; validity segmented control; note.
- Autosave 1.5 s after the last change, with a status line.
- An offline draft copy in localStorage; the version-conflict banner.
- The sent, signed, declined, expired and cancelled variants.
- The action bar hides while the keyboard is open.

Spec §6.

### T21 · Quote and invoice renderers, live preview and print (S08) · `mvp`
**Goal:** the owner sees exactly what the client will see and print, for quotes and invoices.
**Description:**
- `src/documents/QuoteDoc` and `InvoiceDoc`: the A4 layout in pt, with company and client requisites, lines, and Без НДС / НДС / Итого (or "Без НДС").
- The invoice adds ИИК, БИК, Кбе, КНП, the prepayment line, the due date and the total in words.
- Phone: a preview screen. Desktop: a sticky 520 px preview next to the form.
- "Скачать PDF" through `window.print()` with print CSS.

Rendered from seed data, so it doesn't wait for T27.

### T22 · Quotes list and quote detail with timeline (S06, S13) · `mvp`
**Goal:** the owner finds any quote and sees where it stands.
**Description:**
- The КП list: status filter chips, search by client or number, status badges.
- The detail screen: status header, document view, the signature block when signed, an event timeline, and the actions Отправить / Подписать сейчас / Дублировать / Аннулировать (with a Dialog).

### T23 · Send sheet (S09) · `mvp`
**Goal:** the owner sends the quote link through the channel the client uses.
**Description:**
- Sending issues the quote if it's a draft, then opens the sheet: WhatsApp (`wa.me/{phone}?text=`), SMS (`sms:`), email (`mailto:`), copy link.
- The message text is editable, with amount, validity and link, written fresh in Russian.
- A toast confirms the copy.

### T24 · Public signing page: view, states, decline, hand-over mode (S11, S10) · `mvp`
**Goal:** a client with no account understands the document on their phone.
**Description:**
- `/p/:token` without the app chrome: company block (logo, name, БИН, phone link), title, number, amount, validity, lines as cards, "Скачать PDF".
- States: loading, already signed, declined, expired, revoked.
- Decline sheet with an optional reason.
- `?handover=1` mode for signing on the owner's phone.

### T25 · Drawn signature with consents (S11) · `mvp`
**Goal:** the client signs the quote with a finger.
**Description:**
- Signing sheet: name, SignaturePad (`signature_pad`, ink #14213D), blank detection, a cropped PNG ≤ 200 KB, the two required consent checkboxes, and the version check (409 → "Документ изменён").
- Success screen: "Подписано на экране …".
- Mock `public.sign` with `method: 'drawn'`.

Spec §7.

### T26 · Typed-name signature (S11) · `mvp`
**Goal:** a client who can't draw on a screen can still sign.
**Description:**
- A Нарисовать / Ввести имя segmented control in the signing sheet.
- The typed name is rendered to PNG by the app and sent with `method: 'typed'`. Same consents and evidence.
- The wording is always "Подпись на экране". Spec decision D1.

### T27 · Convert a signed quote to an invoice (S14) · `mvp`
**Goal:** a signed quote becomes a payment invoice in three taps.
**Description:**
- The convert sheet: Полная сумма / Предоплата % / Предоплата ₸ / Остаток.
- Mock rules: a full invoice copies the lines, the others make one line; the sum is capped at the quote total (409 `exceeds_quote_total`); `clientRequestId` makes repeats idempotent.
- The new invoice is issued as СЧ-YYYY-NNNN.

Spec §5.

### T28 · Invoice list (S15, S21) · `mvp`
**Goal:** the owner sees at a glance who owes money.
**Description:**
- A summary strip (Ждём / просрочено) and filter chips (Все, Ждут оплаты, Просрочены, Оплачены, Черновики, Аннулированы).
- Search by client, number or exact amount; month groups, sorted as in components.md §4.
- Rows with derived payment badges and a progress bar.
- A desktop table.
- All empty, loading and error states.

### T29 · Invoice detail and cancel (S16) · `mvp`
**Goal:** the owner opens an invoice, shares it, and cancels a wrong one.
**Description:**
- The detail screen: document view, payment state, balance, payments list and timeline.
- Share (reuses the send sheet).
- Аннулировать with a Dialog, blocked while payments exist (409).

### T30 · Record and remove payments (S16) · `mvp`
**Goal:** a payment is recorded in three taps and mistakes can be undone.
**Description:**
- The record-payment sheet: amount pre-filled with the balance, method chips Наличные / Kaspi / Перевод / Карта / Другое, date, note.
- Overpayment is rejected (409); an undo toast removes the payment.
- The derived states update: partly paid, paid, overdue.
- Payments can also be recorded from the list row's swipe or ⋯ menu.

### T31 · Act of completed works: create, screen, Р-1 renderer, signing (S18) · `mvp`
**Goal:** a signed quote becomes an АВР that the client can sign on screen.
**Description:**
- Create from a signed quote (one active act per quote), with lines and work dates, the reporting period and the contract reference.
- Issue АВР-YYYY-NNNN.
- `src/documents/ActDoc` laid out after form Р-1 (per T01), with "Сдал/Принял" blocks.
- The client signs through the public link (drawn or typed).

### T32 · Dashboard (S04) · `mvp`
**Goal:** in five seconds the owner knows what came in, what is owed and what to do.
**Description:**
- Mock `dashboard` computed from the store.
- "Нужно сделать" rows (overdue, signed but not invoiced, waiting for a signature for more than 3 days, expiring soon).
- KPI tiles: Получено, Ждём оплаты with the overdue part, Выставлено, КП подписано N из M.
- The "Подписано — выставьте счёт" list and recent events.
- A period selector.
- First run: a "Начало работы" checklist.

### T33 · M1 audit: 360 px, accessibility, wording, vertical slice on a phone · `mvp`
**Goal:** M1 closes with every screen usable on a real phone and nothing that breaks the design rules.
**Description:** check every screen at 360 and 1280 px:
- no horizontal scroll; at most 2 buttons per row; 48 px targets;
- visible focus, keyboard order, labelled icon buttons;
- no "юридически значимая", "ЭЦП" or "legally binding".

Then run the vertical slice on a real phone over the LAN in mock mode: sign up → company → client → quote → sign → invoice → payment → dashboard. Fix what fails.

---

## M2 · openapi.yaml

### T34 · Contract: auth, companies, clients, articles · `mvp`
**Goal:** the first half of the API is written down exactly as the frontend uses it.
**Description:** `contracts/openapi.yaml` (OpenAPI 3.1):
- `/api/health`, `/api/auth/*`, `/api/me`, `/api/companies/*` with the logo routes, clients, articles
- camelCase schemas; money in `…Tiyn`
- the `{error:{code,message,fields}}` format; `limit`/`offset` pages

Derived from `src/services/contracts.ts` and `replica/architecture.md`.

### T35 · Contract: documents, public, payments, dashboard; generated TS types · `mvp`
**Goal:** the rest of the API is written down, and the frontend can't drift from it.
**Description:**
- Documents: list, create, get, put with `version`, delete, issue, link, cancel, duplicate, convert, events, signature.
- Payments and dashboard.
- Public: get, sign with `method: drawn | typed`, decline, logo.
- Every 409 and 410 code and the examples. 38 operations in total.
- `npm run gen:api` (`openapi-typescript`) writes `src/services/api-types.ts`; `types.ts` is checked against it; the mock compiles; `npm run typecheck` passes.
- The issue maps each services method to one operation.

---

## M3 · Backend in memory

### T36 · Backend scaffold · `mvp`
**Goal:** the backend runs, tests and lints with the commands in AGENTS.md.
**Description:**
- `backend/` with uv and the agreed dependencies.
- `app/main.py`, `config.py` (pydantic-settings: `STORAGE`, `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_BASE_URL`, `CORS_ORIGINS`).
- `/api/health`; the error handlers producing `{error:{…}}`; the camelCase aliases base model.
- pytest with an httpx client fixture; ruff.

### T37 · Python domain and test vectors · `mvp`
**Goal:** the backend computes exactly what the frontend computes.
**Description:** `app/domain`: totals, rounding, the prepayment split, the number format, ИИН/БИН, ИИК, `search_key`, and the status transition tables. pytest runs every file in `contracts/test-vectors/`. No storage code.

### T38 · Repositories, in-memory storage and unit of work · `mvp`
**Goal:** the same service code can run on memory now and on SQL later.
**Description:**
- `app/repositories/base.py` Protocols for every table.
- `memory.py` with a lock-based unit of work (rollback on error) and compare-and-set on `documents.version`.
- `STORAGE=memory` wiring.
- Unit tests for the rollback and the compare-and-set.

### T39 · Auth endpoints · `mvp`
**Goal:** users can register, log in and identify themselves.
**Description:**
- `POST /auth/register`, `POST /auth/login` (JSON and form), `GET /me`.
- argon2id through pwdlib; a JWT HS256 token valid for 12 h.
- An in-process rate limit of 5/min per IP+email.
- Tests: duplicate email, wrong password, expired token.

### T40 · Companies, logo and tenant isolation · `mvp`
**Goal:** each user sees only their own company's data.
**Description:**
- Company create, get, patch; logo PUT and GET (PNG/JPEG ≤ 300 KB).
- A `require_member(cid)` dependency; every repository call takes `company_id`.
- A reusable test helper that hits a route with another company's ids and expects 404.

### T41 · Clients and articles endpoints · `mvp`
**Goal:** the clients and catalogue screens have a real API.
**Description:** list, create, get, patch and delete-or-archive for clients; list, create, patch and archive for articles. Search on the `search_key` columns with Kazakh and ё cases; pagination. Tests include tenant isolation.

### T42 · Documents: CRUD, issue, numbering, cancel, duplicate · `mvp`
**Goal:** quotes, invoices and acts follow the state machine on the server.
**Description:**
- Create a draft.
- `PUT` with the version check (409); only drafts can be deleted.
- `issue`: a gap-free counter per company, type and year; snapshots frozen; the share link created.
- Cancel (blocked while payments exist), duplicate, events, signature PNG.
- Server-side totals recomputation.

### T43 · Convert endpoint · `mvp`
**Goal:** a signed quote becomes an invoice or an act on the server, safely.
**Description:**
- `POST …/convert` with `full | percent | amount | remaining` and `act`.
- The cap at the quote total, checked through the version compare-and-set (409 `exceeds_quote_total`).
- `clientRequestId` idempotency; one active act per quote.

Tests cover two concurrent conversions.

### T44 · Public endpoints: view, sign, decline · `mvp`
**Goal:** a client can view and sign through the link, with evidence stored.
**Description:**
- `GET /public/{token}`: whitelisted fields; `noindex` and `no-referrer` headers.
- `POST …/sign`:
  - `drawn | typed`, PNG checks;
  - the snapshot and its sha256, the consent texts, IP and user agent;
  - the compare-and-set status change; the unique signature;
  - 409 and 410 codes.
- `POST …/decline`.
- A rate limit of 60/min per IP and 5/min per token for signing.

### T45 · Payments and dashboard endpoints · `mvp`
**Goal:** payments and the dashboard numbers come from the server.
**Description:**
- Payments: list, create (overpayment 409, `clientRequestId`) and delete. The derived payment state and balance on invoice reads.
- `GET /dashboard` with the payload from components.md §5, computed in the company's time zone (`Asia/Almaty`, `tzdata`).

### T46 · Contract parity test and seed command · `mvp`
**Goal:** the backend provably matches `openapi.yaml` and can start with demo data.
**Description:**
- A pytest that compares the paths, methods and status codes of `contracts/openapi.yaml` with `app.openapi()`.
- `uv run python -m app.seed` loads `contracts/fixtures/seed.json` into the configured storage.

---

## M4 · SQLite with SQLAlchemy and Alembic

### T47 · SQLAlchemy models and session · `mvp`
**Goal:** the database tables exist as typed models that work on SQLite and Postgres.
**Description:**
- SQLAlchemy 2.0 models for the 12 tables in `replica/schema.sql`; `Uuid`, `JSON`, `LargeBinary`; text + check constraints.
- A `UTCDateTime` TypeDecorator.
- An engine from `DATABASE_URL`, with `PRAGMA foreign_keys=ON` and `check_same_thread=False` only for SQLite.

### T48 · Alembic initial migration · `mvp`
**Goal:** the database is created and upgraded by migrations, never by hand.
**Description:** Alembic with `render_as_batch=True` and an initial migration. A test compares the migrated SQLite schema with `replica/schema.sql`: tables, columns, constraints, indexes. Any difference is fixed or documented.

### T49 · SQL repositories: users, companies, clients, articles · `mvp`
**Goal:** accounts, companies, clients and the catalogue persist in SQLite.
**Description:** the SQLAlchemy implementations of those repository Protocols, the unit of work over `session.begin()`, and the casefolded search columns. They must pass the existing M3 tests with `STORAGE=sql`.

### T50 · SQL repositories: documents, payments, signatures, events · `mvp`
**Goal:** documents and money persist with the same guarantees as in memory.
**Description:**
- Documents with lines, counters, share links, signatures, payments and events.
- The counter-row update for numbering; the version compare-and-set as a conditional `UPDATE`.
- The unique indexes as the backstop; `NO ACTION` and cascade rules as in the schema.

### T51 · One test suite on both storages, and a Postgres run · `mvp`
**Goal:** memory, SQLite and Postgres can't silently behave differently.
**Description:**
- Parametrise the API tests over `STORAGE=memory` and `sql` (a fresh SQLite file per test).
- Add a restart test: data written, server restarted, data still there.
- Run the migration and the full suite once against a local PostgreSQL (`DATABASE_URL=postgresql+psycopg://…`, dev dependency `psycopg[binary]`). Record the result in the issue and fix any SQLite-only behaviour found.

---

## M5 · Connect frontend and backend

### T52 · http services: core, auth and company · `mvp`
**Goal:** the app logs in and manages the company against the real backend.
**Description:**
- `src/services/http`: a fetch client, the bearer token, `ApiError` mapping, `VITE_API_MODE=http`, a Vite proxy for `/api`.
- The auth and company services, including the logo upload.
- The mock stays selectable.

### T53 · http services: clients, articles, documents, payments, dashboard, public · `mvp`
**Goal:** every screen works against the backend exactly as it did on the mock.
**Description:**
- The remaining http services.
- Signature and logo images fetched as blobs with auth.
- `clientRequestId` on payments and conversions.
- Polling every 15 s on a sent quote.

Every M1 screen is checked in http mode.

### T54 · Phone on the LAN and share links · `mvp`
**Goal:** a link sent by WhatsApp opens on another person's phone.
**Description:** `PUBLIC_BASE_URL`, uvicorn on `0.0.0.0` and `vite --host`. Document the setup in README (Windows firewall included). The share link opens the public page from a second phone on the same network.

### T55 · End-to-end vertical slice on a real phone · `mvp`
**Goal:** the core loop works for real on SQLite before anyone outside tests it.
**Description:** on a real phone against SQLite: sign up → company → client → quote → send by WhatsApp → client signs on a second phone (drawn and typed) → invoice (prepayment and remainder) → payments → act signed → dashboard. File a `user-test-bug` for every defect found.

---

## M6 · Hardening and real testing

### T56 · Security, data safety and personal-data texts · `mvp`
**Goal:** the API and the public link resist common abuse, demo data can be backed up, and the consent texts are right.
**Description:**
- Security:
  - body-size limits (413);
  - the `JWT_SECRET` is required outside dev; CORS is locked to the configured origins;
  - the `noindex` and `no-referrer` headers are checked;
  - the rate limits from T39 and T44 have tests;
  - no secrets in the repo;
  - every route is checked for tenant isolation.
- Data: document the SQLite backup and restore (copy with the server stopped), and add a dev reset with seed data.
- Texts: review the consent and "Подпись на экране" texts against spec §7, and list what personal data is stored and where.

### T57 · Printing check: КП, счёт, АВР · `mvp`
**Goal:** documents print and save as PDF correctly from phones and desktops.
**Description:**
- Print all three documents from mobile Chrome, Safari (iOS) and desktop Chrome.
- A4 margins, page breaks inside long tables, fonts with ₸ and Kazakh letters, amounts in words.
- Fix the print CSS.

### T58 · Performance budget on a mid-range phone · `mvp`
**Goal:** the app and the public page open quickly on mobile data.
**Description:** measure on a mid-range Android or Chrome's slow-4G profile; record the numbers in the issue:
- the public page shows its content fast, with fonts loading only the needed subsets;
- the JS bundle size;
- no blocking requests.

### T59 · User testing plan · `mvp`
**Goal:** real testing runs the same way for every participant.
**Description:** `docs/user-testing.md` covering:
- 3–5 tradespeople plus their clients;
- the consent script;
- the tasks, mapped to the spec §3 measures;
- what to record (taps, time, errors, quotes);
- how findings become `user-test-bug` issues (Goal + Description).

### T60 · Run user test sessions and file the findings · `mvp`
**Goal:** the MVP is tried by real users and every problem becomes an issue.
**Description:** run the sessions from T59 on the testers' own phones. File a `user-test-bug` per problem, with the tester's words. Summarise the spec §3 measures against their targets for the pm.

---

## P · Post-MVP (after M6)

The suggested order follows `replica/architecture.md` P1–P5: SMS → Kazakh → team and accountant → Kaspi → smaller extensions → ЭЦП and ЭСФ.
The pm may reorder. Several of these need a new dependency or provider, which needs the user's approval (AGENTS.md rule 2).

### T61 · Choose an SMS provider for Kazakhstan · `post-mvp`
**Goal:** a provider for signing codes is picked on facts, not habit.
**Description:** compare 2–3 providers working in Kazakhstan on price per SMS, sender-name registration, API, delivery reports and data location. Write a recommendation for the user to approve.

### T62 · SMS code before remote signing · `post-mvp`
**Goal:** a remote signature is tied to the client's phone number.
**Description:**
- A `sign_challenges` table and migration.
- Send a 6-digit code (hashed, max attempts, expiry) and verify it before `sign`.
- The OTP input in the signing sheet; a delivery-report webhook.
- `signatures.method` gains `sms`.

Depends on T61.

### T63 · Kazakh UI · `post-mvp`
**Goal:** a Kazakh-speaking user can use the whole app in Kazakh.
**Description:** a `kk` dictionary for every `t()` key, a language switch saved in `users.locale`, Kazakh plurals and dates. The buttons and tab labels are checked at 360 px.

### T64 · Bilingual RU/KK documents · `post-mvp`
**Goal:** КП, счёт and АВР can print in Russian and Kazakh side by side.
**Description:** bilingual titles and labels in the three renderers, amounts in words in both languages, and a per-document language option. Print check as in T57.

### T65 · Team invitations and roles · `post-mvp`
**Goal:** the owner can invite employees and subcontractors.
**Description:** an `invitations` table and routes; invite by email or phone with a role (member, subcontractor, accountant); accept and join; a team screen (S25); removing a member.

### T66 · Permission enforcement · `post-mvp`
**Goal:** members see and do only what their role allows.
**Description:** permission flags on `memberships`, enforced in the repositories:
- own documents only;
- client base hidden;
- locked catalogue prices.

The member permission screen (S26). Tests for every flag.

### T67 · Accountant access and CSV export · `post-mvp`
**Goal:** an accountant gets read-only access and period exports.
**Description:** an `accountant` role that is read-only everywhere, and a CSV export of invoices, payments and acts for a period (S27). The column list is agreed with an accountant.

### T68 · Kaspi payment link and QR · `post-mvp`
**Goal:** a client can pay by Kaspi straight from the invoice.
**Description:** store a Kaspi Pay payment link per invoice (pasted by the owner, since no public API was found), show it as a button and a QR on the public page and the printed счёт, and pre-select "Kaspi" when recording the payment.

### T69 · Open tracking · `post-mvp`
**Goal:** the owner sees whether and when the client opened the quote.
**Description:**
- Count views on `GET /public/{token}`, skipping the owner's own views, and log a `viewed` event at most once per 30 minutes (the `share_links` columns already exist).
- The "Открыт ×N" badge, and a dashboard row for quotes not yet opened.

Spec decision D2.

### T70 · Line discounts · `post-mvp`
**Goal:** the owner can give a discount on a line.
**Description:** expose `discount_bp` in the API and the editor ("Добавить скидку"), and show it in the totals and the three renderers. The test vectors already cover discount maths, so extend them if needed.

### T71 · Photos on documents · `post-mvp`
**Goal:** a quote or act can show up to 10 site photos.
**Description:**
- A file storage decision (disk or object storage), a `document_photos` table.
- Upload with size and type limits, reorder and delete.
- Photos shown on the public page and printed.

### T72 · Notification when a quote is signed · `post-mvp`
**Goal:** the owner learns about a signature without opening the app.
**Description:** choose a channel (email provider or web push), get it approved, and send "КП-… подписан" with a link. Respect an opt-out setting.

### T73 · Credit notes · `post-mvp`
**Goal:** an issued invoice can be corrected without deleting history.
**Description:** a credit note document type by amount or %, linked to its invoice, with its own numbering, renderer and effect on the balance. A schema migration for the new type.

### T74 · Verify ЭСФ rules and IS ESF API access · `post-mvp`
**Goal:** the ЭСФ work starts from the current official rules and real API access.
**Description:** read MinFin order No. 629 (in force 2026-01-01) and the official IS ESF API documentation. Record who must issue ЭСФ, the required fields, buyer confirmation for corrections, registration (biometrics, power of attorney) and test-environment access in `docs/kz-rules.md`.

### T75 · NCALayer research: signing from the browser · `post-mvp`
**Goal:** know exactly how a web app signs with an ЭЦП on a user's desktop.
**Description:** a prototype page that talks to the local NCALayer and signs a test payload. Record the supported browsers and OS, the certificate types (individual/company), the error cases, and that it doesn't work on phones.

### T76 · Sign the АВР with ЭЦП via NCALayer · `post-mvp`
**Goal:** both sides can sign the act with an ЭЦП where it's needed.
**Description:**
- Desktop-only ЭЦП signing of the АВР for the executor and the client.
- Store the CMS signature and verify it on the server.
- `signatures.method` gains `ecp`; the document shows the ЭЦП details.

Depends on T75.

### T77 · Issue ЭСФ through the IS ESF API · `post-mvp`
**Goal:** a VAT-payer company issues the ЭСФ for an invoice from Docura.
**Description:** an `esf_records` table; build the ЭСФ from the invoice, sign it with the company ЭЦП (T75), submit it through the official API, and show the status on the invoice. Desktop only. Depends on T74 and T75.

### T78 · ЭСФ status sync and buyer confirmation · `post-mvp`
**Goal:** the owner sees the real ЭСФ status, including corrections awaiting confirmation.
**Description:** a background job polls IS ESF every 10 minutes for pending submissions and maps the statuses (delivered, confirmed, revoked, error). The flow for corrected or revoked ЭСФ that need the buyer's confirmation (2026 rules) is shown on the invoice.
