# contracts

Files shared by the frontend and the backend, so both sides prove the same behaviour against the same data.

| path | what it is | added by |
| --- | --- | --- |
| `test-vectors/` | JSON cases with expected results for money, VAT, prepayments, ИИН/БИН, ИИК and amount in words. The TypeScript tests (`frontend/src/domain`) and the Python tests (`backend/app/domain`) both run every file here (AGENTS.md rule 3). | #4 (M0) |
| `fixtures/` | `seed.json`: realistic made-up demo data (companies, clients, catalogue, documents in every MVP state) loaded by the mock store and by the backend seed command. No real personal data. | #4 (M0) |
| `openapi.yaml` | the API contract (OpenAPI 3.1), written from the frontend services interface; `npm run gen:api` turns it into `frontend/src/services/api-types.ts`, and the backend has a parity test against it. | #34 (M2) |

Rules:

- Money is integer tiyn (1 ₸ = 100 tiyn), quantities are thousandths (`qty_milli`), rates are basis points (`1600` = 16 %).
- Field names are camelCase, as on the wire.
- A change here changes both sides: update the file, then the TypeScript and Python code, in the same issue.
