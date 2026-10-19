# Process

How work moves from an idea to a closed issue. Every task is a **GitHub issue**. Status is read from the issue's comments, so every
hand-off is a comment with a fixed first line.

## Roles

| role | does | never |
| --- | --- | --- |
| [pm](team/pm.md) | writes and grooms issues, owns scope (`docs/spec.md`), orders the backlog | implements, verifies, closes |
| [qa](team/qa.md) | writes the test cases for a groomed issue, as a comment | implements, verifies the running app, closes |
| [software-engineer](team/software-engineer.md) | implements, writes tests, commits, comments | closes, marks its own work as passed |
| [qa-engineer](team/qa-engineer.md) | verifies every acceptance criterion against the running app, posts PASS or FAIL, **closes after PASS** | implements fixes, closes without a PASS |

One agent or person may hold several roles over time, but never verifies its own implementation.

## Labels

Every issue has **exactly one** of:

| label | meaning |
| --- | --- |
| `mvp` | in the MVP scope of `docs/spec.md` §4 |
| `post-mvp` | in the post-MVP list of `docs/spec.md` §4; not worked on until the MVP is done, unless the user says otherwise |
| `user-test-bug` | a problem found while using the running app, usually in real testing |

The iteration (I1–I6, below) and the priority are written in the issue's **Constraints** section.

## Lifecycle

```
  open ──▶ pm grooms ──▶ qa adds test cases ──▶ software-engineer implements ──▶ qa-engineer verifies ──┬─ PASS ─▶ qa-engineer closes
   ▲          (body)        ("Test cases")        ("Ready for verification")     ("PASS" / "FAIL")      │
   │                                                       ▲                                            │
   │                                                       └──────────── FAIL: back to the engineer ◀────┘
   └── a gap found at any step: comment, and the issue goes back to the pm
```

### 1. pm grooms

The pm fills the issue body from `docs/task-template.md`:
- **Goal**, **Acceptance criteria** (numbered, each one checkable in the running app), **Out of scope**, **Constraints** (iteration, priority, the spec and design sections that apply).
- One label.

The pm makes sure the issue fits `docs/spec.md`; if it changes scope, the spec is updated first. Then the pm comments, starting with **`Groomed`**.

### 2. qa adds test cases

qa reads the acceptance criteria and posts **one comment** starting with **`Test cases`**, in the format in `docs/task-template.md`:
- every criterion is covered by at least one case;
- cases include edge and error cases (empty, long Russian text, Kazakh letters, ₸ amounts, 360 px, a lost connection, a version conflict, whatever applies).

If a criterion can't be tested as written, qa asks the pm in a comment instead.

**An issue is groomed (ready for work) when it has a label, a complete body and the `Test cases` comment.** Nobody implements anything else.

### 3. software-engineer implements

The engineer:
1. Assigns themselves and comments **`In progress`**.
2. Implements in the current iteration's scope, with tests, in small green commits whose messages end with **`Refs #<n>`**. Never `Fixes`/`Closes`/`Resolves`: those would close the issue automatically.
3. Runs the test cases themselves against the running app before handing over.
4. Pushes to `origin main`, then comments **`Ready for verification`**:

```
Ready for verification
Commits: abc1234, def5678
How to run: <exact commands for this iteration>
Tests added: <files / test names>
Notes: <anything the qa-engineer must know; deviations from the issue and why>
```

5. **Does not close the issue.** If blocked (missing decision, a new dependency, a spec conflict), comments **`Blocked`** with the question and stops.

### 4. qa-engineer verifies

The qa-engineer:
1. Pulls `main`, starts the app the way the current iteration runs it (table below), and runs **every** test case.
2. Checks **every** acceptance criterion in the running app; tests passing in CI is not enough.
3. Comments:

```
PASS            (or: FAIL)
Commit verified: abc1234 · Environment: <browser, device / viewport, mode>
| AC | result | evidence |
| 1  | PASS   | TC-1, TC-2: <what was seen> |
| 2  | FAIL   | TC-4: <steps, expected, actual, screenshot> |
```

- **PASS:** every criterion passed. The qa-engineer closes the issue, and is the **only** one who closes issues, **only after a PASS**.
- **FAIL:** the issue stays open, the failing criteria are spelled out with steps, and it goes back to the software-engineer, who fixes it and comments `Ready for verification` again. Repeat.

### Closed issues and regressions

A closed issue is not reopened. If it breaks again, write a new `user-test-bug` issue that links to it.

### Definition of done

- Every acceptance criterion PASSes in the running app, verified by the qa-engineer.
- The full test suite is green on the verified commit.
- Commits reference the issue.
- `docs/spec.md` and `replica/architecture.md` (or `contracts/openapi.yaml`) are updated if the behaviour or the contract changed.

## Iteration order

Issues are worked in this order. An iteration starts when every `mvp` issue of the previous one is closed. `post-mvp` issues wait
until I6 is done, unless the user decides otherwise.

| # | iteration | builds | "running app" for verification |
| --- | --- | --- | --- |
| I1 | **Frontend with mock services** | all MVP screens in React + TypeScript; every call through `src/services` with the mock implementation; vertical slice first (architecture M0) | `npm run dev` (mock mode), Chrome device mode at 360 px and 1280 px, plus a real phone on the LAN |
| I2 | **openapi.yaml** | `contracts/openapi.yaml` written from the services interface; generated TS types; the mock compiles against them (M1) | `npm run gen:api` + `npm run typecheck` pass; every services method maps to one operation; `npm run dev` still works |
| I3 | **Backend in memory** | FastAPI routes, domain logic, in-memory repositories, API tests, contract parity test (M2) | `uv run uvicorn …` with `STORAGE=memory`, exercised through `/docs` and the test cases; `uv run pytest` green |
| I4 | **Backend on SQLite** | SQLAlchemy models, Alembic migration matching `replica/schema.sql`, SQL repositories; the same tests on both storages (M3) | `STORAGE=sql` server after `alembic upgrade head`; data survives a restart; `uv run pytest` green on memory and sql |
| I5 | **Frontend connected to the backend** | the http services implementation, Vite proxy, auth token (M4) | backend on SQLite + `VITE_API_MODE=http npm run dev`; the vertical slice end to end on a real phone, the public link opened from WhatsApp |
| I6 | **Real testing** | sessions with real tradespeople and their clients on their own phones | the I5 setup reachable from the testers' phones; findings become `user-test-bug` issues |

## `user-test-bug` issues

### How one is written

Anyone who hits a problem in the running app writes it, testers in I6 most of all. Two sections only, in plain words, Russian or English:

```
Title: <the symptom, short>  e.g. "Сумма в счёте разрывается на две строки"

## Goal
What I was trying to do, in my own words.
e.g. "Выставить клиенту счёт на предоплату 50 % прямо у него дома."

## Description
What happened, step by step, and what I expected instead.
- Device and browser, screen (e.g. Samsung A14, Chrome, portrait)
- Data used (client name, amounts), with no real personal data
- Screenshot or screen recording if possible
- Expected: …  Actual: …
```

Label it `user-test-bug`. Don't add acceptance criteria; the pm does that.

### How the pm grooms it

1. **Keep `Goal` and `Description` exactly as written** at the top: they're the tester's evidence.
2. Reproduce it in the running app, or ask the reporter for what's missing in a comment.
3. Decide what it is:
   - **A bug:** the app breaks `docs/spec.md` or the design rules. Add Acceptance criteria (the fixed behaviour, plus "the steps in Description no longer reproduce the problem"), Out of scope, and Constraints (iteration, priority: `blocker` / `high` / `normal`, spec and design references).
   - **Works as specified, but the spec is wrong:** update `docs/spec.md` first (a new decision row), then groom it like a bug.
   - **A feature request:** rewrite it as an `mvp` or `post-mvp` issue with the user's agreement, keeping the original text quoted.
   - **A duplicate, or not a problem:** explain in a comment and ask the user to decide. Issues are never closed without a PASS.
4. Comment `Groomed`. qa then adds `Test cases`; the first case is always the reporter's own steps.

## Changing these rules

`docs/process.md` and `docs/spec.md` belong to the pm, and changes need the user's agreement. The stack and dependency rules in `AGENTS.md`
change only on the user's word.
