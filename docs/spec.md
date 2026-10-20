# Docura: product spec

Status: v1 (MVP scope agreed) · Date: 2026-10-19

Docura is a mobile-first web app for small businesses in Kazakhstan that do work for clients: trades, repair and service crews.
It takes one job through its paperwork. A **quote (КП)** is signed by the client on screen, then becomes a **payment invoice (счёт на оплату)**
and a **completion act (акт выполненных работ, АВР)**, and the owner tracks the payments by hand. Amounts are in **KZT**, the UI is in **Russian**.

This spec is the source of truth for **scope**. Related documents:

| document | what it holds |
| --- | --- |
| `replica/recon.md`, `replica/features.csv` | how the reference product (Khosmos, France) works, from public sources |
| `replica/architecture.md`, `replica/schema.sql` | stack, data model, API, build order |
| `replica/design/` | tokens, component specs, design brief |
| `docs/process.md` | how work moves from issue to done |

Where this spec and those documents disagree on scope, **this spec wins**. Known differences are listed in [Decisions](#decisions).

---

## 1. Users

**Primary: the owner-operator.**
- An ИП or a small ТОО with 1–10 people: plumber, electrician, finisher, handyman, repair or installation crew.
- Works from a phone on site, often one-handed. Speaks Russian; client names and addresses are often Kazakh.
- Uses WhatsApp to talk to clients and Kaspi to get paid. Is not an accountant.

**The client (signer).**
- A homeowner, or a person signing for a company client.
- Opens a link from WhatsApp on their own phone. Has no Docura account and never needs one.
- Wants to see what they're paying for, then agree. Company clients also need a счёт with bank details and an АВР.

**Later (post-MVP):** team members and subcontractors with limited rights, and an accountant with read-only access and exports.

## 2. Problem

These assumptions come from the recon and the reference product's positioning. Validate them in user tests (see `docs/process.md`):

- Quotes go out as WhatsApp text or a photo of a handwritten estimate. Acceptance is verbal, so price and scope get disputed later.
- The счёт and the АВР are typed again in Excel, Word or by an outsourced accountant, copying the same lines by hand. Paperwork delays payment.
- Payments arrive by cash, Kaspi or transfer and are tracked from memory or in a notebook, so unpaid work gets forgotten.
- Existing accounting tools (1С and similar) are built for an accountant at a desk, not for a tradesperson on site.

## 3. Goals and success measures (MVP)

| goal | measure, checked in user tests |
| --- | --- |
| A quote signed on the spot | a trained user creates a КП with an existing client and 2 catalogue lines and sends its link **under 60 s**; the number of taps (typing excluded) is counted and recorded in the phone test (#55), with no pass/fail threshold (D6); the client signs it from that link on the spot |
| No retyping | signed КП → счёт на оплату in **≤ 3 taps**; signed КП → АВР in **≤ 3 taps** |
| Know who owes what | record a payment in **≤ 3 taps**; the dashboard answers "how much came in, how much is owed" without scrolling on a 360 px phone |
| Clients can sign alone | a first-time client signs from a WhatsApp link on a 360 px Android phone without help |
| Correct money | every total matches the shared test vectors to the tiyn (`contracts/test-vectors/`) |

## 4. Scope

### MVP

| # | feature | what it means in the MVP |
| --- | --- | --- |
| 1 | **Account and company** | sign up and log in with email and password; one company per account with its requisites: legal form, ИИН/БИН, address, phone, director, VAT payer yes/no, bank, ИИК, БИК, Кбе, КНП; logo |
| 2 | **Clients** | create, search, edit and archive; a person or a company; name, phone, email, address, ИИН/БИН (optional) |
| 3 | **Item catalogue** | services and materials with a unit, a price in ₸ and a kind (work/material); picked into documents; archived, never deleted |
| 4 | **Quote (КП) with a VAT toggle** | client, lines (title, qty, unit, unit price), validity, note; a per-document **НДС 16 %** switch (see §6) |
| 5 | **Live preview** | the document is rendered as it will print, while editing; the same renderer serves the public page and the PDF (browser print) |
| 6 | **Drafts and numbering** | documents start as drafts with no number; issuing assigns the next number per company, type and year (`КП-2026-0001`, `СЧ-2026-0001`, `АВР-2026-0001`), with no gaps |
| 7 | **Public link with a finger signature** | issuing a КП creates a private link, shared by WhatsApp or copied; the client signs on screen with a finger (§7) |
| 8 | **Quote → invoice → act** | from a signed КП: a счёт for the full amount, a prepayment (% or ₸) or the remainder; an АВР with the quote's lines, ready to print (§5) |
| 9 | **Manual payment tracking** | record payments against a счёт (amount, method, date, note); partly paid, paid and overdue are worked out automatically; remove a wrong entry |
| 10 | **Simple dashboard** | for the current month: received, owed (with the overdue part), invoiced, quotes signed; the list of signed quotes not yet invoiced; no charts |
| 11 | **Russian UI** | all strings in Russian through `t()`; data and fonts support Kazakh letters and ₸ from day one |

### Post-MVP

Not built in the MVP. The suggested order follows `replica/architecture.md` (P1–P5); the PM may reorder.

| feature | note |
| --- | --- |
| SMS codes for remote signing | strengthens the on-screen signature; needs a KZ SMS provider |
| Kazakh language | UI strings and bilingual documents |
| Team roles | members and subcontractors with limited rights (own documents only, hidden client base, locked prices) |
| Accountant access | read-only role with CSV exports |
| Kaspi | a Kaspi Pay link or QR on the invoice and public page; no public API found, so payments stay manual |
| ЭЦП / NCALayer | signing the АВР with an ЭЦП, desktop only |
| ЭСФ | electronic invoices through the official IS ESF API, for VAT payers and for non-payers in the cases of Tax Code art. 208 (e.g. the simplified-declaration regime; `docs/kz-rules.md` R1); depends on ЭЦП |
| Open tracking | "opened ×N" on quotes. The `share_links` view columns exist in the schema and stay at their defaults in the MVP |
| Line discounts | per-line discount in %. `document_lines.discount_bp` exists and stays `0`; the MVP API doesn't expose it |
| Photos | up to 10 photos on a document; needs file storage |
| Notifications | push or email when a quote is signed |
| Credit notes | correcting an issued invoice by amount or % |
| Cancel and duplicate | cancel an issued document (an invoice only when it has no payments); duplicate a document into a new draft (D5) |
| Typed-name signature | allowed by D1, and `'typed'` stays in the schema; built after the MVP (D5) |
| Decline | the client declines a quote from the public link, with an optional reason (D5) |
| Hand-over mode | "Подписать сейчас" opens the signing page full screen on the owner's phone (D5) |
| Client signs the act | on-screen signature of the АВР through the public link (D5) |

## 5. Document flow

```
            issue                client signs                  convert
 КП draft ────────▶ КП sent ─────────────────▶ КП signed ──┬──────────────▶ Счёт на оплату ── payments ──▶ paid
    │                 │  ╲                                  │   (full | prepayment % | prepayment ₸ | remainder)
    │                 │   ╲ client declines ──▶ declined    │
    │                 │    valid_until passes ─▶ expired    └──────────────▶ АВР draft ──issue──▶ issued ──client signs──▶ signed
    │                 │    (derived, not stored)
    └──── delete (drafts only)        any sent or issued document ──cancel──▶ cancelled      any document ──duplicate──▶ new draft
```

**In the MVP (D5):** the client can't decline, nobody can cancel or duplicate, and the АВР ends at `issued` (printed and signed on paper).
Those transitions come after the MVP. The schema already allows their states, so adding them needs no migration.

**КП (quote)**
- States: `draft → sent → signed | declined`, plus `cancelled`. "Expired" is derived from `valid_until` in the company's time zone.
- Editable while `draft` or `sent`. Every save bumps a version, and the client can't sign a version they haven't seen.
- Frozen once signed, declined or cancelled. To change it: duplicate (post-MVP, D5; in the MVP, create a new КП).

**Счёт на оплату (invoice)**
- Created from a signed КП in the MVP.
- Bases:
  - `full`: copies the lines.
  - `percent`, `amount`: one prepayment line, "Предоплата N% по КП № … от …".
  - `remaining`: one line for the quote total minus every non-cancelled invoice made from it.
- The sum of all invoices from one КП can never exceed the КП total.
- States: `draft → issued`, plus `cancelled`. Payment state is derived: `unpaid`, `partial`, `paid`, `overdue` (past `due_date`).
- Prints the seller's bank details, Кбе, КНП and the amount in words.

**АВР (act of completed works)**
- Created from a signed КП, with its lines and a work date per line, laid out after form Р-1 (MinFin order No. 562, appendix 50; columns in `docs/kz-rules.md` row 5). One active act per КП in the MVP.
- Form Р-1 doesn't apply to строительно-монтажные работы, so the act is for repair, finishing, installation and service jobs; construction contracts on the construction-sector forms are out of scope (D7).
- States: `draft → issued → signed`, plus `cancelled`.
- In the MVP both sides sign the printed act on paper. The client signing it on screen through the public link comes after the MVP (D5); ЭЦП comes later still.

**Payments**
- Recorded by hand against an issued invoice: amount > 0, method (`cash`, `transfer`, `card`, `kaspi`, `other`), date, note.
- A payment that would take the paid total above the invoice total is rejected. A removed payment is logged in the document history.

**Snapshots.** While a document is editable, the client's and company's requisites are copied onto it on every save. They freeze when it is signed or issued, so editing a client later never changes an issued счёт.

## 6. Money, KZT and VAT

- **Currency:** KZT only. Amounts are stored as integer **tiyn** (1 ₸ = 100 tiyn), never floats.
- **Display:** `Intl.NumberFormat('ru-KZ', {style: 'currency', currency: 'KZT'})`, giving "1 250 000 ₸" with non-breaking spaces. Tiyn are shown in the UI only when non-zero, and always on documents.
- **Line total:** `qty × unit price`, rounded half up to the tiyn. Quantities allow up to 3 decimals and accept a comma ("12,5").
- **VAT toggle:**
  - Each document has a switch **"НДС 16 %"**. The rate (1600 basis points) is copied onto the document, so a future rate change never rewrites old documents.
  - VAT is calculated **per line** (`round(net × 16 %)`), then summed. The document shows Без НДС / НДС 16 % / Итого.
  - If the company is **not a VAT payer**, the switch is off and locked, and documents print **"Без НДС"**.
  - If it is, the switch defaults to on and can be turned off per document.
- **Prepayment invoices:** the gross amount is exact, and VAT is split back out: `vat = round(gross × 16 / 116)`.
- **Amount in words:** the счёт and the АВР print the total in words in Russian, with тенге and тиын declined correctly. Tiyn are written as two digits, as on payment documents (NB resolution No. 208, p. 7): «Триста двадцать три тысячи девятьсот тридцать тенге 00 тиын».

## 7. Signature on screen

**What it is.** The client confirms a КП on screen. The schema allows two methods; **the MVP builds `drawn` only** (D5):

| method | how | stored as | when |
| --- | --- | --- | --- |
| `drawn` | signs with a finger or mouse in the signature box | PNG of the strokes | MVP |
| `typed` | types their full name instead of drawing, for people who can't draw on a screen | PNG rendered by the app from the typed name | post-MVP (D1, D5) |

Signing an АВР on screen is post-MVP too (D5). Every signature requires:
- the signer's name
- two checkboxes: acceptance of the document number and amount, and consent to process personal data (name, signature, IP address)
- the version the signer saw: if the document changed since, signing is refused and the new version is shown

Each signature is stored with:
- the exact document snapshot and its SHA-256 hash
- the consent texts
- date and time (UTC)
- IP address and user agent

(`replica/schema.sql`, table `signatures`; `method in ('drawn', 'typed')`.)

**Wording rule. It is "подпись на экране" (signature on screen), never "legally binding".**
- The UI, documents, help texts and marketing say **"Подпись на экране"** / "Подписано на экране 19.10.2026 в 14:05".
- They never say "юридически значимая подпись", "имеет юридическую силу", "ЭЦП", "legally binding" or similar.
- This holds until a KZ lawyer has reviewed it and ЭЦП signing (post-MVP) exists.
- A signature on screen is a record that the client accepted the document. It is not an ЭЦП.

**Hand-over mode (post-MVP, D5).** "Подписать сейчас" will open the same signing page full screen on the owner's phone, for the client to sign on site; no views are counted, and the event records that it was a hand-over. In the MVP the owner opens the public link on their own phone instead.

## 8. Language and platform

- **Russian UI.** Every string goes through `t()` with a Russian dictionary. Copy rules are in `replica/design/components.md` §6: verbs on buttons, correct plurals, the letter ё, «ёлочки» quotes.
- **Kazakh data from day one.** Names and addresses with ә ғ қ ң ө ұ ү һ і must be stored, searched, displayed and printed correctly. The fonts (Onest, IBM Plex Mono) and their subsets were checked for this, including ₸.
- **Platform.** A responsive web app (PWA) for the phone first: 360–430 px, one-handed, 48 px touch targets, no horizontal scroll. It also has a clean desktop view (≥ 1024 px). No native apps.
- **Time.** Kazakhstan has been on one zone, UTC+5, since 2024-03-01. Dates are computed in the company's zone (`Asia/Almaty`) and timestamps are stored in UTC.

## 9. Non-goals

The MVP does **not**:

- do accounting: no ledger, no tax returns, no 1С export, no warehouse or stock;
- issue ЭСФ, sign with ЭЦП, or claim legal equivalence to a handwritten or ЭЦП signature;
- take online payments or connect to a bank or Kaspi; it doesn't act as a cash register (ККМ);
- send email or SMS; documents are shared as a link through WhatsApp or copy;
- charge subscriptions (no Stripe or billing in v1);
- support several users per company, or several companies per user, in the UI;
- work offline beyond keeping an unsaved draft on the device;
- include planning, scheduling, a directory, a marketplace, telephony or insurance;
- reuse anything Khosmos owns: texts, images, colours, icons, layout, name.

## 10. Constraints

- **Stack fixed by the course assignment:**
  - React + TypeScript, with all backend calls through one services layer that has a mock implementation
  - FastAPI with uv
  - SQLite through the SQLAlchemy ORM, configured by `DATABASE_URL`, with no SQLite-only features
  - no Stripe, no Docker in v1

  Details in `replica/architecture.md`.
- **Build order:** frontend with mock services → `openapi.yaml` → backend in memory → backend on SQLite → frontend connected to the backend → real testing (`docs/process.md`).
- **Production hosting** must respect Kazakhstan's personal-data law, which requires storage on servers in Kazakhstan. Check this before any public launch.

## 11. Open questions

1. Legal review of the signature on screen (drawn and typed) for B2C quotes and for the АВР.
2. The ИИН/БИН checksum algorithm. **Updated 20.10.2026:** the ИИН algorithm is verified against MVD order No. 521 ([docs/kz-rules.md, row 6](kz-rules.md#the-seven-rules)); the separate БИН rules are still to be found in an official source, and the same algorithm is applied meanwhile.
3. ~~The current edition of form Р-1 (MinFin order No. 562 and its amendments).~~ **Closed 20.10.2026:** appendix 50 in the edition of order No. 458 of 27.10.2014 ([docs/kz-rules.md, row 5](kz-rules.md#the-seven-rules)).
4. ЭСФ rules from 2026-01-01 (MinFin order No. 629), before post-MVP work starts.

## Decisions

| # | date | decision | effect |
| --- | --- | --- | --- |
| D1 | 2026-10-19 | A **typed-name signature** is allowed as an alternative to the drawn one. Both are called "signature on screen", never "legally binding" | `replica/schema.sql`: `signatures.method in ('drawn', 'typed')`; the signing sheet offers Нарисовать / Ввести имя |
| D2 | 2026-10-19 | **Open tracking** and **line discounts** move to post-MVP. `replica/architecture.md` had them in the MVP "at no extra cost" | the schema columns stay, unused, at their defaults; the MVP API and UI don't expose them, and components.md's "Открыт ×N" badge and "Добавить скидку" link are post-MVP |
| D3 | 2026-10-19 | **Live preview, drafts and numbering, cancel and duplicate** are confirmed in the MVP | as described in §4 and §5 |
| D4 | 2026-10-19 | In the MVP, invoices and acts are created **only from a signed КП** | `POST …/documents` with `type=invoice` or `act` and no source is not used by the MVP UI |
| D5 | 2026-10-19 | **MVP cut to 40 issues** for the deadline. **Cancel, duplicate, the typed signature, decline, hand-over mode and the client signing the act** move to post-MVP, along with CI (#6), security hardening (#56), the printing check (#57) and the performance budget (#58). 15 small tasks merge into neighbours. The act is still created from the signed quote, and prepayment invoices stay. The Postgres run in #51 becomes optional ("if time allows") | §3, §4, §5 and §7 updated; supersedes the cancel and duplicate part of D3; `docs/tasks.md` lists the merges. The schema is unchanged: `'typed'`, `declined` and `cancelled` stay allowed for later |
| D6 | 2026-10-20 | The **tap count to send a quote** becomes a measured value instead of a pass/fail target (≤ 6 taps): the designed flow needs about 10 taps (client 2, two catalogue lines 2 each, create, send, WhatsApp). The **company phone** joins the company requisites, because the public page shows it as a call link | §3 and §4.1 updated; #22 AC 5 records the count in #55; #15 collects the phone, #24 shows it; `companies.phone` already exists in `replica/schema.sql` |
| D7 | 2026-10-20 | Rules checked against official sources (`docs/kz-rules.md`, #1): form Р-1 excludes строительно-монтажные работы; tiyn in an amount in words are written as digits; some non-VAT payers must issue ЭСФ (Tax Code art. 208) | §4 post-MVP ЭСФ row, §5 (АВР) and §6 (amount in words) updated; §11 questions 2 and 3 updated and closed |
