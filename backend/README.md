# Docura backend

FastAPI app managed with uv. Run everything from this folder; settings are documented in `.env.example`.

| task | command |
| --- | --- |
| install | `uv sync` |
| dev server, in memory | `STORAGE=memory uv run uvicorn app.main:app --reload --port 8000` |
| API docs | http://127.0.0.1:8000/docs |
| all tests · shared vectors only | `uv run pytest` · `uv run pytest -k vectors` |
| lint · format | `uv run ruff check .` · `uv run ruff format .` |

PowerShell: `$env:STORAGE="memory"; uv run uvicorn app.main:app --reload --port 8000`.

`JWT_SECRET` signs the bearer tokens. Without it (unset or blank) each process makes up a random secret and logs a warning at startup: everyone is signed out on every restart, `--reload` included. **Production must set it** to a long random value, such as `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Its length isn't checked, so a short one is accepted.

- `app/errors.py`: `ApiError` and the `{"error": {"code", "message", "fields"}}` handlers.
- `app/schemas/base.py`: `CamelModel`, the base of every wire model (camelCase JSON).
- `app/domain/`: pure business rules, tested on `../contracts/test-vectors/`; it imports no FastAPI or storage code.
- `app/api/`: the routers. `deps.py` has the signed-in user and `require_member`, which every `/api/companies/{cid}` route takes: another company's id is a 404, like an unknown one.
- `app/services/`: what the routes do, through a unit of work; `app/security.py`: argon2id passwords and the 12 h HS256 token; `app/rate_limit.py`: 5 tries a minute per IP and email on login and on register, in process.
- `tests/tenant_isolation.py`: the tenant-isolation helper for every company route (see its docstring).
- `app/repositories/`: `base.py` holds a Protocol per table and the unit of work, `records.py` the rows, `memory.py` the `STORAGE=memory` implementation. `create_app` puts the storage on `app.state.storage`; `STORAGE=sql` refuses to start until M4.
