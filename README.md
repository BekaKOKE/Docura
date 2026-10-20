# Docura

Docura is a mobile-first web app for small businesses in Kazakhstan that do work for clients: plumbers, electricians, finishers,
repair and installation crews. It takes one job through its paperwork on a phone: a quote (КП) that the client signs on screen
from a WhatsApp link, then a payment invoice (счёт на оплату) and a completion act (АВР) made from the signed quote without
retyping, and payments tracked by hand. The UI is in Russian, amounts are in tenge (₸).

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
