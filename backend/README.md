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

- `app/errors.py`: `ApiError` and the `{"error": {"code", "message", "fields"}}` handlers.
- `app/schemas/base.py`: `CamelModel`, the base of every wire model (camelCase JSON).
- `app/domain/`: pure business rules, tested on `../contracts/test-vectors/`; it imports no FastAPI or storage code.
