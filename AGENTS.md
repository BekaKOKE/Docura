# AGENTS.md

Guide for every agent and person working in this repo.

**Docura** is a mobile-first web app for small businesses in Kazakhstan: quote (КП) → signature on screen → payment invoice (счёт на оплату) →
completion act (АВР), with manual payment tracking. Russian UI, KZT.

Read before working:

1. `docs/spec.md`: what we build and what we don't. **It wins on scope.**
2. `docs/process.md`: how an issue moves from idea to closed.
3. `docs/team/<your role>.md`: what your role does and doesn't do.
4. `docs/task-template.md`: what a groomed issue looks like.
5. `replica/architecture.md` + `replica/schema.sql`: stack, data model, API, domain rules.
6. `replica/design/components.md` + `replica/design/tokens.json`: UI specs and tokens.

## Repository layout

The folders below are created by the first issues of each iteration. Until then, only `docs/` and `replica/` exist.

```
frontend/        React + TypeScript (Vite). All backend calls go through src/services (mock | http)
contracts/       openapi.yaml + test-vectors/ (money, ИИН/БИН, amount in words), shared by frontend and backend
backend/         FastAPI app managed with uv: app/, migrations/ (Alembic), tests/
docs/            spec, process, task template, team roles
replica/         recon, architecture, schema, design system (planning inputs, not shipped)
```

## Commands

> Status: these are the commands the scaffolding **must** provide. They come from `replica/architecture.md`. If one doesn't work
> yet, the scaffolding issue isn't done: fix it there or ask in the issue. Don't invent a different command.

### Backend (run in `backend/`)

| task | command |
| --- | --- |
| install | `uv sync` |
| dev server, in-memory storage | `uv run uvicorn app.main:app --reload --port 8000` with `STORAGE=memory` |
| dev server on SQLite | `STORAGE=sql DATABASE_URL=sqlite:///./docura.db uv run uvicorn app.main:app --reload --port 8000` |
| API docs | http://127.0.0.1:8000/docs |
| all tests (memory + sqlite) | `uv run pytest` |
| one test | `uv run pytest tests/test_documents.py -k convert` |
| migrations | `uv run alembic upgrade head` · new: `uv run alembic revision --autogenerate -m "short message"` |
| lint and format | `uv run ruff check .` · `uv run ruff format .` |
| phone on the LAN | `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` with `PUBLIC_BASE_URL=http://<your LAN IP>:5173` |

PowerShell sets environment variables differently: `$env:STORAGE="sql"; $env:DATABASE_URL="sqlite:///./docura.db"; uv run uvicorn app.main:app --reload`.

### Frontend (run in `frontend/`)

| task | command |
| --- | --- |
| install | `npm install` (CI: `npm ci`) |
| dev server with mock services (default) | `npm run dev` |
| dev server against the backend | `VITE_API_MODE=http npm run dev` (Vite proxies `/api` to `127.0.0.1:8000`) |
| phone on the LAN | `npm run dev -- --host` |
| unit tests (vitest) | `npm test` · watch: `npm test -- --watch` |
| type check · lint · build | `npm run typecheck` · `npm run lint` · `npm run build` |
| regenerate API types from the contract | `npm run gen:api` (writes `src/services/api-types.ts` from `../contracts/openapi.yaml`) |

### Design tokens

| task | command |
| --- | --- |
| regenerate `tokens.css` and the Tailwind mappings after editing `tokens.json` | `python replica/design/build_tokens.py` |

## Rules

### 1. The stack is fixed (course assignment)

- React + TypeScript frontend; **every backend call goes through `frontend/src/services`**, which has a mock and an http implementation.
- Python FastAPI managed with uv.
- SQLite through the SQLAlchemy ORM, configured by `DATABASE_URL`. **No SQLite-only features**: Postgres must work later.
- **No Stripe, no Docker** in v1.

Don't replace, add or remove a framework, database, ORM, build tool or test runner.

### 2. No new dependencies without asking

Already agreed: in `replica/architecture.md` (Stack) and `replica/design/`. Anything else needs approval first.

| side | agreed packages |
| --- | --- |
| backend | `fastapi[standard]`, `sqlalchemy` 2.x, `alembic`, `pydantic-settings`, `pyjwt`, `pwdlib[argon2]`, `tzdata`. dev: `pytest`, `httpx`, `ruff`, `pyyaml`; optional `psycopg[binary]` for a Postgres test run |
| frontend | `react`, `react-dom`, `typescript`, `vite`, `react-router`, `@tanstack/react-query`, `signature_pad`, `lucide-react`; Tailwind CSS if the design agent uses it (mapping in `replica/design/`). dev: `vitest`, `openapi-typescript`, the linter the scaffold sets up |

To ask, comment on the issue: the package, why it's needed, what it replaces, its licence and size, and the alternative without it. Then **wait for
the user's answer**. Don't add it "for now".

### 3. Tests are required

- Every change to behaviour ships with tests **in the same commit**.
  - Backend: pytest API tests, parametrised over `STORAGE=memory` and `sql`, plus unit tests for `app/domain`.
  - Frontend: vitest for `src/domain` and `src/services/mock`.
- Money, VAT, ИИН/БИН and amount-in-words logic is tested against the shared `contracts/test-vectors/`, in **both** TypeScript and Python.
- Run the full suite before every commit. Never commit red.
- Never delete, skip or weaken a test, or loosen an assertion, to get green. If a test is wrong, say so in the issue and fix it in its own commit.

### 4. Commit often

- Small commits that each leave the build green. One logical change per commit.
- Message: `type(scope): summary` (`feat`, `fix`, `test`, `refactor`, `docs`, `chore`), then a body explaining *why*, then **`Refs #<issue>`**.
- **Never write `Fixes #N`, `Closes #N` or `Resolves #N`.** GitHub would close the issue automatically, and only the qa-engineer closes issues, after PASS.
- Stage files by name; never `git add -A` or `git add .` (plugins write generated files into the repo). Push to `origin main` when the issue's work is finished and green.

### 5. Work only on groomed issues

- No issue, no work.
- An issue is groomed when it has **a label** (`mvp`, `post-mvp` or `user-test-bug`), **Goal, Acceptance criteria, Out of scope and Constraints** filled in by the PM (`docs/task-template.md`), and **a "Test cases" comment from qa**.
- If something is missing, stop and comment on the issue for the PM. Don't fill the gaps yourself.
- Work in the iteration order from `docs/process.md`. Don't build backend code during the frontend-with-mock iteration, and so on.
- Something out of scope that should be done? Comment it, or draft a new issue for the PM. Don't do it in the current one.

### 6. Product rules every change must keep

- **Scope comes from `docs/spec.md`.** Post-MVP features (ЭСФ, ЭЦП, SMS, Kaspi, Kazakh UI, roles, accountant, open tracking, discounts, photos, notifications, credit notes) are not built in the MVP.
- **Money:**
  - integer tiyn; no floats
  - rounding half up per line
  - VAT 16 % per line, with the rate copied onto the document
  - formatted with `Intl.NumberFormat('ru-KZ', {style:'currency', currency:'KZT'})`
  - amounts and document numbers never wrap
- **Signatures:**
  - `drawn` or `typed`
  - always called **"Подпись на экране"**; never "юридически значимая", "имеет юридическую силу", "ЭЦП" or "legally binding"
- **Language:** Russian UI through `t()`. Kazakh letters and ₸ must store, search, render and print correctly. Load the font subsets `cyrillic`, `cyrillic-ext`, `latin-ext`.
- **UI:**
  - phone first, 360 px wide, no horizontal scroll, touch targets of 48 px or more
  - at most 2 buttons side by side on a phone
  - tokens only, never raw hex (`replica/design/components.md` §0)
- **Data:**
  - every query is scoped by `company_id` in the data layer
  - another company's ids return 404
  - UTC timestamps; dates in the company's zone
- **Clean room:** nothing from Khosmos (texts, images, colours, icons, layout, name), and never its private endpoints.

### 7. Roles

Each role is in `docs/team/`: `pm.md`, `qa.md`, `software-engineer.md`, `qa-engineer.md`. Act only within your role. Only the
**qa-engineer** closes issues, and only after a PASS.
