# Docura

Docura is a mobile-first web app for small businesses in Kazakhstan that do work for clients: plumbers, electricians, finishers,
repair and installation crews. It takes one job through its paperwork on a phone: a quote (КП) that the client signs on screen
from a WhatsApp link, then a payment invoice (счёт на оплату) and a completion act (АВР) made from the signed quote without
retyping, and payments tracked by hand. The UI is in Russian, amounts are in tenge (₸).

## Status (20.10.2026)

**Planning is done; no application code exists yet.**

Done:
- **Idea and research:** the brainstorm ([docs/brainstorm.md](docs/brainstorm.md)), and under `replica/` the recon of the reference
  product, the feature matrix, the architecture, the database schema and the design system (tokens, components, design brief).
- **Project rules:** the spec ([docs/spec.md](docs/spec.md), decisions D1–D7), the process ([docs/process.md](docs/process.md)), the task
  template, the four role files in `docs/team/`, and [AGENTS.md](AGENTS.md).
- **Backlog:** 82 issues in [the issue list](https://github.com/BekaKOKE/Docura/issues): 67 groomed (40 `mvp`, 27 `post-mvp`) and 15 merged
  into others (closed as not planned). Task TNN in [docs/tasks.md](docs/tasks.md) is issue #NN.
- **Test cases:** 253 qa test cases, posted as a “Test cases:” comment on each of the 40 `mvp` issues.
- **M0, repo and tooling:** #2 (repo hygiene, README, issue templates) and #4 (shared test vectors and seed data in `contracts/`) are
  closed after a QA PASS. #1 (Kazakhstan rules checked against official sources, [docs/kz-rules.md](docs/kz-rules.md)) is implemented
  and pushed, and stays open until its QA verdict.

Not done yet:
- M1 frontend with mock services
- M2 `openapi.yaml`
- M3 in-memory backend
- M4 SQLite with SQLAlchemy and Alembic
- M5 frontend connected to the backend
- M6 hardening and real testing

**Next step:** finish M0 (the QA verdict on #1), then start M1 with #7 (generate the frontend from the design brief) and #11 (the
services layer), following [docs/process.md](docs/process.md).

## Start here

| document | what it holds |
| --- | --- |
| [docs/spec.md](docs/spec.md) | what we build and what we don't; it wins on scope |
| [docs/process.md](docs/process.md) | how an issue moves from idea to closed, and the milestones M0–M6 |
| [docs/tasks.md](docs/tasks.md) | the backlog; task TNN is GitHub issue #NN |
| [AGENTS.md](AGENTS.md) | commands, the fixed stack and the rules every agent and person follows |

## Folders

```
frontend/        React + TypeScript (Vite). All backend calls go through src/services (mock | http)   (planned, M1)
contracts/       openapi.yaml + test-vectors/ + fixtures/, shared by frontend and backend          (contracts/README.md)
backend/         FastAPI app managed with uv: app/, migrations/ (Alembic), tests/               (planned, M3)
docs/            spec, process, backlog, team roles
replica/         recon, architecture, schema, design system (planning inputs, not shipped)
```

`frontend/` and `backend/` don't exist yet; the first issues of M1 and M3 create them. The commands they must provide are in
[AGENTS.md](AGENTS.md#commands).
