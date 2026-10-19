# Docura: draft backlog

Status: **draft**, cut to 40 mvp tasks on 2026-10-19 (spec decision D5): 5 tasks moved to post-MVP and 15 merged into others. Milestones M0–M6 are the same as in `docs/process.md` and `replica/architecture.md`. Each task is GitHub issue #N with the same number. When a task becomes an issue, the pm grooms it into `docs/task-template.md`
(acceptance criteria, out of scope, constraints) and qa adds test cases (`docs/process.md`). Scope follows `docs/spec.md`.

Each task is sized for **one session**: one person or agent can implement it and the qa-engineer can verify it in the running app of its milestone.

Format of each task:
- **number · title · label**
- one-line **Goal**
- a short **Description**, which names screens (S-IDs from `replica/recon.md`), spec sections and the tasks it depends on

## Milestones

| milestone | name | open tasks | mvp | post-mvp |
| --- | --- | --- | --- | --- |
| M0 | Repo and tooling | T01, T02, T04 | 3 | 0 |
| M1 | Frontend with mock services | T07, T10, T11, T12, T14, T15, T16, T17, T18, T19, T21, T22, T24, T27, T28, T30, T31, T32 | 18 | 0 |
| M2 | openapi.yaml | T34 | 1 | 0 |
| M3 | Backend in memory | T36, T37, T38, T39, T41, T42, T43, T44, T45 | 9 | 0 |
| M4 | SQLite with SQLAlchemy and Alembic | T47, T49, T50, T51 | 4 | 0 |
| M5 | Connect frontend and backend | T52, T54, T55 | 3 | 0 |
| M6 | Hardening and real testing | T59, T60 | 2 | 0 |
| P | Post-MVP (after M6) | T06, T26, T56, T57, T58, T61, T62, T63, T64, T65, T66, T67, T68, T69, T70, T71, T72, T73, T74, T75, T76, T77, T78 | 0 | 23 |
| | **open total** | **63** | **40** | **23** |
| — | Merged into other tasks (closed as not planned) | 15 | | |

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

### T02 · Repository hygiene, README and issue templates · `mvp`
**Goal:** the repo behaves the same on Windows and Linux, a newcomer knows where to start, and issues are created in the agreed shape.
**Description:**
- `.gitattributes` (LF for text files, binary for PNG) and `.editorconfig`.
- `README.md` with the one-paragraph pitch, links to `docs/` and `AGENTS.md`, and the planned folders; `contracts/` with a short README.
- Two issue templates, copied from `docs/task-template.md` and `docs/process.md`: `.github/ISSUE_TEMPLATE/task.md` (Goal, Acceptance criteria, Out of scope, Constraints, Test cases) and `user-test-bug.md` (Goal, Description). The labels already exist.

Merged from T03.

### T04 · Shared test vectors and seed data · `mvp`
**Goal:** the frontend and backend prove the same maths against one set of expected results and start from the same realistic data.
**Description:**
- `contracts/test-vectors/` with JSON cases and a README describing the format:
  - `totals.json`: half-up rounding, VAT on and off, per-line VAT, comma quantities
  - `prepayment.json`: % and ₸ prepayments, the remainder, the cap at the quote total
  - `bin-iin.json`: valid and invalid
  - `iik.json`: mod-97
  - `amount-in-words.json`: 0, 1, 2, 5, 21, 1 000 000, tiyn declension
- `contracts/fixtures/seed.json`: a VAT-payer company (ИП Сейткали Б.) and a non-VAT company, 3 clients with Kazakh and Russian names, 8 catalogue items, and documents in every MVP status (draft, sent, signed, expired, invoice partly paid and overdue, act issued).

Values come from T01 and spec §6; test data from `docs/team/qa.md`; no real personal data. Merged from T05. Depends on T01.

---

## M1 · Frontend with mock services

The design agent generates all the MVP screens at once from `replica/design/brief.md` (T07). The rest of M1 wires each screen to the
mock services and brings it up to `replica/design/components.md`.

### T07 · Generate the frontend from the design brief, import it and align it with AGENTS.md · `mvp`
**Goal:** a first React + TypeScript version of every MVP screen exists in `frontend/` and follows the repo's commands, folders and dependency rules.
**Description:**
- Run `replica/design/brief.md` in the chosen tool (Claude Design, v0 or Lovable), export the code into `frontend/` and commit it as generated. List any screens the tool skipped as follow-ups in the issue.
- Add the npm scripts from AGENTS.md: `dev`, `test`, `typecheck`, `lint`, `build`; `gen:api` stays a stub until T34.
- Create `src/services`, `src/domain`, `src/documents` and `src/i18n`.
- Audit `package.json` against the agreed list. Remove what isn't needed, and ask about anything else.
- Remove direct `fetch` calls and external services.

Merged from T08.

### T10 · App shell: tokens, fonts, navigation and t() · `mvp`
**Goal:** a user can reach every MVP screen on a phone and on desktop, in Russian, with Docura's tokens and with Russian, Kazakh and ₸ rendering correctly.
**Description:**
- Wire up `tokens.css` and the Tailwind mapping from `replica/design/`; load Onest and IBM Plex Mono with the cyrillic, cyrillic-ext and latin-ext subsets; add the `.dc-money`, `.dc-code` and `.dc-label` helpers; use `minmax(0,1fr)` grids; replace raw hex and default shadcn styling.
- Phone: TabBar (Главная · Документы · [+] · Клиенты · Ещё) and the [+] create sheet. Desktop (≥ 1024 px): Sidebar. TopBar on both.
- Routes for all MVP screens, with the Документы segmented control (КП · Счета · Акты).
- `t()` with a Russian dictionary and an `Intl.PluralRules('ru')` helper; every visible string goes through it.

Merged from T09.

### T11 · Services interfaces, types and error codes · `mvp`
**Goal:** every screen gets its data through one typed services layer.
**Description:**
- `src/services/contracts.ts`: auth, company, clients, articles, documents, payments, dashboard, public; shapes as in `replica/architecture.md`.
- `types.ts`.
- `ApiError` with the agreed codes.
- `index.ts` picks the implementation from `VITE_API_MODE`; the http implementation stays a stub that throws until M5.

### T12 · Domain: money, totals, validators and amount in words · `mvp`
**Goal:** the editor shows totals that are correct to the tiyn, requisites are validated, and documents can print sums in words.
**Description:**
- `src/domain/money.ts` and `totals.ts`: parse "12,5" and "18 500", integer tiyn, line net/VAT/gross with half-up rounding, document totals, the prepayment VAT split, and `Intl ru-KZ` formatting.
- `binIin.ts`, `iik.ts` and `amountInWords.ts` (тенге and тиын declension), and `searchKey()`: casefold, then ё → е.
- Vitest runs all five files in `contracts/test-vectors/`.

Merged from T13. Depends on T04.

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
- ИИН/БИН and ИИК are validated inline (T12).

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

### T19 · Quote editor: client, lines, VAT toggle and totals (S07) · `mvp`
**Goal:** a quote with a client, lines and correct totals can be built one-handed and saved.
**Description:**
- The client picker sheet with quick-create.
- LineItem cards with collapsed and expanded views: title, work/material, QuantityInput with a unit chip, MoneyInput.
- Add from the catalogue (2 taps per line) or by hand, with "Сохранить в каталог". Reorder with ↑↓; delete with undo.
- The "НДС 16 %" switch, locked "Без НДС" for non-VAT payers; the ink totals bar; validity; note.
- An explicit "Сохранить" button saves the draft.

Merged from T20. Autosave, the offline copy, the version-conflict banner and the status banners are post-MVP polish. Spec §6.

### T21 · Quote and invoice renderers, live preview and print (S08) · `mvp`
**Goal:** the owner sees exactly what the client will see and print, for quotes and invoices.
**Description:**
- `src/documents/QuoteDoc` and `InvoiceDoc`: the A4 layout in pt, with company and client requisites, lines, and Без НДС / НДС / Итого (or "Без НДС").
- The invoice adds ИИК, БИК, Кбе, КНП, the prepayment line, the due date and the total in words.
- Phone: a preview screen. Desktop: a sticky 520 px preview next to the form.
- "Скачать PDF" through `window.print()` with print CSS.

Rendered from seed data, so it doesn't wait for T27.

### T22 · Quotes list, quote detail and sharing the link (S06, S13, S09) · `mvp`
**Goal:** the owner finds any quote, sees where it stands and sends its link to the client.
**Description:**
- The КП list, newest first, with status badges.
- The detail screen: status, document view and the signature block when signed; signed quotes offer Выставить счёт and Создать акт.
- "Отправить" issues a draft (number assigned), then opens the share sheet: WhatsApp (`wa.me/{phone}?text=`) and "Копировать ссылку", with an editable message that has the amount, validity and link, written fresh in Russian.

Merged from T23. Filter chips, search, the event timeline, SMS and email sharing are post-MVP polish; duplicate and cancel are post-MVP (spec D5).

### T24 · Public link: view and finger signature (S11) · `mvp`
**Goal:** a client with no account understands the document on their phone and signs it with a finger.
**Description:**
- `/p/:token` without the app chrome: company block (logo, name, БИН, phone link), title, number, amount, validity, lines as cards, "Скачать PDF".
- States: loading, already signed, expired, revoked.
- Signing sheet: name, SignaturePad (`signature_pad`, ink #14213D), blank detection, a cropped PNG ≤ 200 KB, the two required consent checkboxes, and the version check (409 → "Документ изменён").
- Success screen: "Подписано на экране …". Mock `public.sign` with `method: 'drawn'`.

Merged from T25. Decline, hand-over mode and the typed signature (T26) are post-MVP (spec D5). Spec §7.

### T27 · Convert a signed quote to an invoice (S14) · `mvp`
**Goal:** a signed quote becomes a payment invoice in three taps.
**Description:**
- The convert sheet: Полная сумма / Предоплата % / Предоплата ₸ / Остаток.
- Mock rules: a full invoice copies the lines, the others make one line; the sum is capped at the quote total (409 `exceeds_quote_total`); `clientRequestId` makes repeats idempotent.
- The new invoice is issued as СЧ-YYYY-NNNN.

Spec §5.

### T28 · Invoices: list and detail (S15, S16) · `mvp`
**Goal:** the owner sees at a glance who owes money and can open any invoice.
**Description:**
- A summary strip with the totals owed and overdue.
- The invoice list, newest first: client, total, number, due date and the derived payment badge ("Оплачен на N%" with a progress bar, "Просрочен N дн.").
- The invoice detail: document view, payment state, balance and payments list; share reuses the share sheet from T22.
- Empty, loading and error states.

Merged from T29. Filter chips, amount search, month groups and the desktop table are post-MVP polish; cancel is post-MVP (spec D5).

### T30 · Record and remove payments (S16) · `mvp`
**Goal:** a payment is recorded in three taps and mistakes can be undone.
**Description:**
- The record-payment sheet: amount pre-filled with the balance, method chips Наличные / Kaspi / Перевод / Карта / Другое, date, note.
- Overpayment is rejected (409); an undo toast removes the payment.
- The derived states update: partly paid, paid, overdue.
- Payments can also be recorded from the list row's swipe or ⋯ menu.

### T31 · Act of completed works: create, screen and Р-1 renderer (S18) · `mvp`
**Goal:** a signed quote becomes an АВР ready to print.
**Description:**
- Create from a signed quote (one active act per quote), with lines and work dates, the reporting period and the contract reference.
- Issue АВР-YYYY-NNNN.
- `src/documents/ActDoc` laid out after form Р-1 (per T01), with "Сдал/Принял" blocks.

The client signing the act on screen is post-MVP (spec D5).

### T32 · Dashboard (S04) · `mvp`
**Goal:** in five seconds the owner knows what came in and what is owed.
**Description:**
- Mock `dashboard` computed from the store.
- KPI tiles for the current month: Получено, Ждём оплаты with the overdue part, Выставлено, КП подписано N из M.
- The "Подписано — выставьте счёт" list.

The "Нужно сделать" rows, recent events, the period selector and the first-run checklist are post-MVP polish.

---

## M2 · openapi.yaml

### T34 · Contract: openapi.yaml and generated TS types · `mvp`
**Goal:** the API is written down exactly as the frontend uses it, and the frontend can't drift from it.
**Description:**
- `contracts/openapi.yaml` (OpenAPI 3.1) for every operation the MVP services use: `/api/health`, auth, `/api/me`, companies with the logo routes, clients, articles, documents (list, create, get, put with `version`, delete, issue, convert, signature), payments, dashboard, and public (get, sign, logo).
- camelCase schemas; money in `…Tiyn`; the `{error:{code,message,fields}}` format; `limit`/`offset` pages; every 409 and 410 code with examples.
- `npm run gen:api` (`openapi-typescript`) writes `src/services/api-types.ts`; `types.ts` is checked against it; the mock compiles; `npm run typecheck` passes.
- The issue maps each services method to one operation.

Merged from T35. Operations for post-MVP features (cancel, duplicate, decline, events, link rotation) are left out.

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

### T39 · Auth, companies and tenant isolation · `mvp`
**Goal:** users can register, log in and identify themselves, and each user sees only their own company's data.
**Description:**
- `POST /auth/register`, `POST /auth/login` (JSON and form), `GET /me`; argon2id through pwdlib; a JWT HS256 token valid for 12 h; an in-process rate limit of 5/min per IP+email.
- Company create, get, patch; logo PUT and GET (PNG/JPEG ≤ 300 KB).
- A `require_member(cid)` dependency; every repository call takes `company_id`; a reusable test helper that hits a route with another company's ids and expects 404.
- Tests: duplicate email, wrong password, expired token.

Merged from T40.

### T41 · Clients and articles endpoints · `mvp`
**Goal:** the clients and catalogue screens have a real API.
**Description:** list, create, get, patch and delete-or-archive for clients; list, create, patch and archive for articles. Search on the `search_key` columns with Kazakh and ё cases; pagination. Tests include tenant isolation.

### T42 · Documents: CRUD, issue and numbering · `mvp`
**Goal:** quotes, invoices and acts follow the state machine on the server.
**Description:**
- Create a draft.
- `PUT` with the version check (409); only drafts can be deleted.
- `issue`: a gap-free counter per company, type and year; snapshots frozen; the share link created.
- The signature PNG.
- Server-side totals recomputation.

Cancel, duplicate and the events endpoint are post-MVP (spec D5).

### T43 · Convert endpoint · `mvp`
**Goal:** a signed quote becomes an invoice or an act on the server, safely.
**Description:**
- `POST …/convert` with `full | percent | amount | remaining` and `act`.
- The cap at the quote total, checked through the version compare-and-set (409 `exceeds_quote_total`).
- `clientRequestId` idempotency; one active act per quote.

Tests cover two concurrent conversions.

### T44 · Public endpoints: view and sign · `mvp`
**Goal:** a client can view and sign through the link, with evidence stored.
**Description:**
- `GET /public/{token}`: whitelisted fields; `noindex` and `no-referrer` headers.
- `POST …/sign`:
  - `method: drawn`, PNG checks;
  - the snapshot and its sha256, the consent texts, IP and user agent;
  - the compare-and-set status change; the unique signature;
  - 409 and 410 codes.
- A rate limit of 60/min per IP and 5/min per token for signing.

Decline and the typed signature are post-MVP (spec D5).

### T45 · Payments, dashboard, contract parity and seed · `mvp`
**Goal:** payments and the dashboard numbers come from the server, the backend provably matches `openapi.yaml`, and it can start with demo data.
**Description:**
- Payments: list, create (overpayment 409, `clientRequestId`) and delete. The derived payment state and balance on invoice reads.
- `GET /dashboard` with the tiles and list that T32 shows, computed in the company's time zone (`Asia/Almaty`, `tzdata`).
- A pytest that compares the paths, methods and status codes of `contracts/openapi.yaml` with `app.openapi()`.
- `uv run python -m app.seed` loads `contracts/fixtures/seed.json` into the configured storage.

Merged from T46.

---

## M4 · SQLite with SQLAlchemy and Alembic

### T47 · SQLAlchemy models, session and initial migration · `mvp`
**Goal:** the database tables exist as typed models that work on SQLite and Postgres, and are created by migrations, never by hand.
**Description:**
- SQLAlchemy 2.0 models for the 12 tables in `replica/schema.sql`; `Uuid`, `JSON`, `LargeBinary`; text + check constraints.
- A `UTCDateTime` TypeDecorator.
- An engine from `DATABASE_URL`, with `PRAGMA foreign_keys=ON` and `check_same_thread=False` only for SQLite.
- Alembic with `render_as_batch=True` and an initial migration. A test compares the migrated SQLite schema with `replica/schema.sql`: tables, columns, constraints, indexes. Any difference is fixed or documented.

Merged from T48.

### T49 · SQL repositories: users, companies, clients, articles · `mvp`
**Goal:** accounts, companies, clients and the catalogue persist in SQLite.
**Description:** the SQLAlchemy implementations of those repository Protocols, the unit of work over `session.begin()`, and the casefolded search columns. They must pass the existing M3 tests with `STORAGE=sql`.

### T50 · SQL repositories: documents, payments, signatures, events · `mvp`
**Goal:** documents and money persist with the same guarantees as in memory.
**Description:**
- Documents with lines, counters, share links, signatures, payments and events.
- The counter-row update for numbering; the version compare-and-set as a conditional `UPDATE`.
- The unique indexes as the backstop; `NO ACTION` and cascade rules as in the schema.

### T51 · One test suite on both storages · `mvp`
**Goal:** memory and SQLite can't silently behave differently.
**Description:**
- Parametrise the API tests over `STORAGE=memory` and `sql` (a fresh SQLite file per test).
- Add a restart test: data written, server restarted, data still there.
- If time allows: run the migration and the full suite once against a local PostgreSQL (`DATABASE_URL=postgresql+psycopg://…`, dev dependency `psycopg[binary]`) and record the result in the issue.

---

## M5 · Connect frontend and backend

### T52 · http services for every screen · `mvp`
**Goal:** every screen works against the real backend exactly as it did on the mock.
**Description:**
- `src/services/http`: a fetch client, the bearer token, `ApiError` mapping, `VITE_API_MODE=http`, a Vite proxy for `/api`.
- Every service: auth, company (including the logo upload), clients, articles, documents, payments, dashboard, public.
- Signature and logo images fetched as blobs with auth; `clientRequestId` on payments and conversions; polling every 15 s on a sent quote.
- The mock stays selectable. Every M1 screen is checked in http mode.

Merged from T53.

### T54 · Phone on the LAN and share links · `mvp`
**Goal:** a link sent by WhatsApp opens on another person's phone.
**Description:** `PUBLIC_BASE_URL`, uvicorn on `0.0.0.0` and `vite --host`. Document the setup in README (Windows firewall included). The share link opens the public page from a second phone on the same network.

### T55 · End-to-end on a real phone, with the 360 px and wording audit · `mvp`
**Goal:** the core loop works for real on SQLite, and every screen keeps the design rules, before anyone outside tests it.
**Description:**
- On a real phone against SQLite: sign up → company → client → quote → share by WhatsApp → the client signs on a second phone → invoice (prepayment and remainder) → payments → act → dashboard.
- Every screen at 360 and 1280 px: no horizontal scroll; at most 2 buttons per row; 48 px targets; visible focus, keyboard order, labelled icon buttons; no "юридически значимая", "ЭЦП" or "legally binding".
- File a `user-test-bug` for every defect found.

Merged from T33.

---

## M6 · Hardening and real testing

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

Moved here from the MVP on 2026-10-19 (spec decision D5): T06, T26, T56, T57, T58.

### T06 · CI workflow · `post-mvp`
**Goal:** every push runs the checks, so red never reaches main unnoticed.
**Description:** a GitHub Actions workflow:
- frontend: `npm ci`, `typecheck`, `test`, `build`
- backend: `uv sync`, `ruff`, `pytest`

Each job runs only when its folder exists. Uses `actions/checkout`, `actions/setup-node` and `astral-sh/setup-uv`; confirm these actions with the user first (AGENTS.md rule 2).

### T26 · Typed-name signature (S11) · `post-mvp`
**Goal:** a client who can't draw on a screen can still sign.
**Description:**
- A Нарисовать / Ввести имя segmented control in the signing sheet.
- The typed name is rendered to PNG by the app and sent with `method: 'typed'`. Same consents and evidence.
- The wording is always "Подпись на экране". Spec decision D1.

### T56 · Security, data safety and personal-data texts · `post-mvp`
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

### T57 · Printing check: КП, счёт, АВР · `post-mvp`
**Goal:** documents print and save as PDF correctly from phones and desktops.
**Description:**
- Print all three documents from mobile Chrome, Safari (iOS) and desktop Chrome.
- A4 margins, page breaks inside long tables, fonts with ₸ and Kazakh letters, amounts in words.
- Fix the print CSS.

### T58 · Performance budget on a mid-range phone · `post-mvp`
**Goal:** the app and the public page open quickly on mobile data.
**Description:** measure on a mid-range Android or Chrome's slow-4G profile; record the numbers in the issue:
- the public page shows its content fast, with fonts loading only the needed subsets;
- the JS bundle size;
- no blocking requests.

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

---

## Merged into other tasks (closed as not planned)

Merged on 2026-10-19 (spec decision D5). The issues stay on GitHub with their numbers, closed as not planned with the comment "Merged into #N"; their scope now lives in the surviving task.

| task | title | merged into |
| --- | --- | --- |
| T03 | GitHub issue templates | T02 |
| T05 | Shared seed data | T04 |
| T08 | Align the generated app with AGENTS.md | T07 |
| T09 | Design tokens, fonts and layout rules | T10 |
| T13 | Domain: validators and amount in words | T12 |
| T20 | Quote editor: VAT, totals, validity, autosave and states (S07) | T19 |
| T23 | Send sheet (S09) | T22 |
| T25 | Drawn signature with consents (S11) | T24 |
| T29 | Invoice detail and cancel (S16) | T28 |
| T33 | M1 audit: 360 px, accessibility, wording, vertical slice on a phone | T55 |
| T35 | Contract: documents, public, payments, dashboard; generated TS types | T34 |
| T40 | Companies, logo and tenant isolation | T39 |
| T46 | Contract parity test and seed command | T45 |
| T48 | Alembic initial migration | T47 |
| T53 | http services: clients, articles, documents, payments, dashboard, public | T52 |
