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

## Dev logins (seed only)

`fixtures/seed.json` has one user per company. They exist only in development data; never reuse the password anywhere real.

| email | company | password |
| --- | --- | --- |
| seitkali@example.kz | ИП Сейткали Б. (VAT payer) | `docura-dev-2026` |
| nurlanov@example.kz | ИП Нурланов А. (not a VAT payer) | `docura-dev-2026` |

The mock store (#14) accepts these; the backend seed command (#45) stores the password as an argon2id hash.

## Seed states

`seed.json` is pinned to `referenceDate` 2026-10-20 (Asia/Almaty). ИП Сейткали Б. has quotes in draft, sent (КП-2026-0001, the reference quote of 323 930 ₸), signed, and expired (КП-2026-0003, valid until 10.10.2026) states; invoices paid (СЧ-2026-0001), partly paid 40 % (СЧ-2026-0002), unpaid (СЧ-2026-0003) and overdue (СЧ-2026-0004, due 13.10.2026); and an issued act (АВР-2026-0001). Sent quotes and unpaid invoices stay valid until 30.06.2027. Кбе 19 is used for the ИП companies (sector 9, households, as banks code ИП; the NB rules' sector table doesn't name ИП, see `docs/kz-rules.md` row 4).
