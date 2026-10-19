# Task template

Every `mvp` and `post-mvp` issue uses this body. The pm writes **Goal, Acceptance criteria, Out of scope and Constraints**. **qa** writes
**Test cases** as a separate comment, in the format below. (`user-test-bug` issues start with Goal + Description instead; see
`docs/process.md`.)

## Copy this into the issue

```markdown
## Goal
<One or two sentences: who gets what, and why it matters. Point to the spec section.>

## Acceptance criteria
1. <One observable behaviour, checkable in the running app: given … when … then …>
2. <…>
3. <States: empty / loading / error / long Russian text / 360 px, where they apply>

## Out of scope
- <What this issue deliberately does not do, and the issue or spec section where it lives instead>

## Constraints
- Milestone: M<n> — <name> (docs/process.md)
- Priority: blocker | high | normal
- Spec: docs/spec.md §<n>; Design: replica/design/components.md §<n>; Architecture: replica/architecture.md <section>
- <Technical limits: services layer only, no new dependencies, money in tiyn, wording rules, …>

## Test cases
_Added by qa as a comment starting with "Test cases". The issue isn't groomed until that comment exists._
```

## How to fill each section

**Goal.** The outcome, not the implementation. "A tradesperson can turn VAT on or off per quote and sees the totals change at once"
is good; "add a Switch component" is not.

**Acceptance criteria.**
- Numbered, so the PASS/FAIL table can point to them.
- Each criterion is one behaviour that a person can check in the running app of the issue's milestone. Avoid "works well", "fast" or "correct" without a number or an example.
- Include the states that apply: empty, loading, error, offline, version conflict, long Russian labels, Kazakh letters, ₸ amounts, 360 px with no horizontal scroll.
- Name exact texts when the wording matters ("Подпись на экране", "Без НДС").
- Keep it to about 3–8 criteria. More than that means split the issue.

**Out of scope.** Name the nearby things people will assume are included (post-MVP features, the next milestone's work) and say where they live.

**Constraints.** Always the milestone and the priority. Then the documents that govern the issue, and any limits:
- "mock services only; no backend code"
- "no new dependencies"
- "amounts in tiyn, formatted with Intl ru-KZ"

## Test cases comment (qa)

```markdown
Test cases

| TC | covers AC | steps | expected |
| --- | --- | --- | --- |
| TC-1 | 1 | 1. … 2. … 3. … | … |
| TC-2 | 1, 3 | … | … |

Data: <seed data or values to use>
Environment: <viewport(s), browser, mode — e.g. 360×800 Chrome device mode, mock services>
```

- Every acceptance criterion appears in the "covers AC" column at least once.
- Steps are concrete: real values ("12,5 м² × 18 500 ₸"), not "enter a quantity".
- For a `user-test-bug`, TC-1 is the reporter's original steps.

## Example

> **Title:** Quote editor: НДС 16 % switch and live totals (mock)
> **Label:** `mvp`
>
> ## Goal
> A tradesperson can turn VAT on or off for one quote and immediately sees correct totals, so the price they quote matches the
> document the client signs (spec §6).
>
> ## Acceptance criteria
> 1. For a VAT-payer company, a new quote shows the switch "НДС 16 %" turned on; the totals bar shows Без НДС, НДС 16 % and Итого.
> 2. With lines 12,5 м² × 18 500 ₸ and 32 п.м. × 1 500 ₸ and VAT on, the totals are Без НДС 279 250 ₸, НДС 44 680 ₸, Итого 323 930 ₸.
>    With VAT off: Итого 279 250 ₸, and the preview says "Без НДС".
> 3. For a company that is not a VAT payer, the switch is replaced by the text "Без НДС" and a link to the company settings.
> 4. Amounts never wrap and the page has no horizontal scroll at 360 px.
> 5. Toggling VAT on a signed quote is impossible: the quote is read-only.
>
> ## Out of scope
> - Line discounts and other rates (spec §4 post-MVP).
> - Saving to the backend (M3+); the mock keeps the value.
>
> ## Constraints
> - Milestone: M1 — Frontend with mock services
> - Priority: high
> - Spec §6; components.md §2 (Quote editor); architecture "Domain rules"
> - Totals come from `src/domain` and are tested against `contracts/test-vectors/totals.json`; no new dependencies
>
> ## Test cases
> _Added by qa as a comment._
