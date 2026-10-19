# Recon map: Khosmos (web + iOS + Android)

Scope: the core loop and its admin. Covers quote, e-signature, deposit and final invoice, payment and unpaid
tracking, clients, item catalogue, company settings and document branding, team roles and permissions,
accountant access, reports and multi-company. Hub, phone line, directory, planning, marketplace, insurance
and the Amex card are out.
For: Docura, a clone for tradespeople in **Kazakhstan** (construction, repair and call-out trades). It's a
responsive web app / PWA built for the phone on site.
Date: 2026-10-19
Method: public sources only, as the user chose. No login, no account, no bundles, no network logs.

> No screen was seen live. Screens, states and click counts below come from public descriptions:
> the marketing site, changelog, App Store notes, FAQ and a third-party review. Anything marked `*` is inferred.
> Before replica-design, look at the App Store screenshots (public) and save them in `replica/screens/`.
> They are reference only.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site + FAQ | https://www.khosmos.fr | Best feature list there is: the 10 FAQ answers, roles, cover page, reports, pricing |
| 2 | pricing / terms of sale | https://www.khosmos.fr/conditions-generales-de-vente | Plans: €19.99 excl. VAT/mo or €166.99/yr for the 1st user, then €12.99/mo or €109.99/yr per extra user, price stops rising at 20 users. 14-day trial, no card. Generation is blocked after 3 days unpaid |
| 3 | changelog | https://www.khosmos.fr/nouveautes | V2.3, V2.4 and upcoming V3. Richest source for screens and fields |
| 4 | App Store listing | https://apps.apple.com/fr/app/khosmos-facturation-rapide/id6449428730 | Version history Aug 2023 – Jun 2026, 4.9★ from 126 ratings, sharing by email/WhatsApp/SMS, Google review requests |
| 5 | Google Play listing | https://play.google.com/store/apps/details?id=com.khosmos.app | Could not be read (page truncated) |
| 6 | free quote generator | https://www.khosmos.fr/generateur-de-devis | Gives the PDF anatomy: lines with VAT per line, HT/VAT/TTC, VAT recap by rate, deposit, validity |
| 7 | e-invoicing page | https://www.khosmos.fr/facturation-electronique-btp | French Factur-X and PA flow. The lifecycle is issued → received → accepted → paid |
| 8 | competitor comparison | https://www.khosmos.fr/khosmos-vs | Positioning against Obat, Tolteck, EBP, Costructor, InterFast, Gazoleen. Its edge is free unlimited signatures and price |
| 9 | trades page | https://www.khosmos.fr/metier | 35 trades in 6 families. No trade-specific features listed |
| 10 | terms of use (CGU) | https://www.khosmos.fr/cgu | **No clause against competitive use or reverse engineering.** Art. 3 bans reproducing their content (texts, images), so none of it is copied |
| 11 | third-party review | https://tool-advisor.fr/logiciel-facturation/comparatif/khosmos/ | Affiliate review. Dashboard KPIs, "features deliberately limited" |
| 12 | YouTube channel | https://www.youtube.com/@Khosmosofficial | Could not be read by fetch. Walkthroughs probably exist: watch at human speed before design |
| 13 | help center | none found | Support is WhatsApp 7/7, 9:00–23:00 |
| 14 | public API docs | none found | |
| 15 | user's own account | not used | User chose public sources only |
| K1 | KZ VAT 16% from 2026-01-01 | https://finance.kz/news/prezident-kazahstana-utverdil-novyy-nalogovyy-kodeks-nds-povyshaetsya-do-16 | Base rate went from 12% to 16%. Some reduced rates exist |
| K2 | KZ VAT registration threshold | https://alataucitybank.kz/business/osim/articles/chto-delat-s-nds-v-2026-godu | 10,000 MRP ≈ 43.25M ₸ in 2026 (verify against the Tax Code) |
| K3 | IS ESF (e-invoices) | https://kgd.gov.kz/en/section/elektronnye-scheta-faktury | Official. It has an API for integration with accounting systems |
| K4 | ESF changes in 2026 | https://leverx.com/ru/blog/sap-esf-kazakhstan | Corrected and revoked ESF need the buyer's confirmation, so statuses must be tracked |
| K5 | ESF issuing rules for 2026 | https://pro1c.kz/articles/elektronnye-scheta-faktury-esf/pravila-vypiski-scheta-faktury-v-elektronnoy-forme-v-informatsionnoy-sisteme-elektronnykh-schetov-fa/ | MinFin order No. 629 of 2025-10-28. Biometric registration for IS ESF |
| K6 | electronic АВР (act of completed works) | https://pro1c.kz/articles/elektronnye-akty-vypolnennykh-rabot-avr/elektronnyy-akt-vypolnennykh-rabot-eavr-v-1s-bukhgalteriya-8-dlya-kazakhstana-red-3-0/ | Form Р-1. The electronic version goes through IS ESF, with an ЭЦП signature from both sides |
| K7 | Kaspi Pay remote invoice | https://guide.kaspi.kz/partner/ru/advertisement/sale/q2910 | Partners can send a remote invoice or a payment link. **No public invoicing API found** |
| K8 | QR signing with eGov Mobile | https://dogovor24.kz/articles/chto-takoe-qr-podpisanie-dokumentov-1225.html , https://habr.com/en/articles/711388 | Signing with an ЭЦП from a phone by scanning a QR code |

## Core loop

A tradesperson writes a quote on their phone in about a minute, the client signs it on the spot with a finger or
remotely through a link, and the quote turns into deposit and final invoices whose payments are tracked until nothing is unpaid.

## Market adaptation: France → Kazakhstan

Clean-room means rebuilding Khosmos's *flow* around Kazakhstan's own documents. A translation of the French ones would not fit.

| Khosmos (FR) | Docura (KZ) | note |
| --- | --- | --- |
| Devis (quote) | Коммерческое предложение / смета (quote or estimate) | The client signs to accept, same as the original |
| Facture d'acompte (deposit invoice) | Счёт на оплату (pre-payment) | A payment request with ИИК, БИК, Кбе, КНП. Not a tax document |
| Facture (invoice) | Счёт на оплату + **АВР (Р-1)** + **ЭСФ** if the seller pays VAT | In KZ the closing document is the АВР. ESF is required for VAT payers |
| Rapport d'intervention (job report) | АВР / job report with photos | Natural mapping. The АВР is what the client signs when the job is done |
| Avoir (credit note) | Corrected / additional ESF, or a refund note for non-VAT sellers | 2026 rule: the buyer must confirm the correction (K4) |
| "TVA non applicable, art. 293B" | "Без НДС" printed automatically for non-VAT payers (simplified regime) | Same idea, different wording |
| VAT 0 / 5.5 / 10 / 20 % | VAT 16% standard, plus 0% and exempt. Rates are configurable | K1 |
| SIRET, TVA intracom | БИН / ИИН (12 digits), ИИК (KZ IBAN), БИК, Кбе | Validate the ИИН/БИН checksum |
| Factur-X via a PA | ESF through the IS ESF API, signed with the company's ЭЦП | Hard part. See Size |
| Stripe card payment | Kaspi Pay payment link (manual), card acquiring, cash | No public Kaspi API, so v1 records payments by hand |
| Finger signature + SMS code | Same for B2C acceptance. **ЭЦП / eGov QR** for АВР and B2B | Legal weight needs checking (see Out of scope / risks) |
| NF525, VAT attestation, CEE/MaPrimeRénov' grants | none | Skip, they only exist in France |
| French UI | **Russian + Kazakh** UI and documents (bilingual PDFs) | Bilingual documents are common practice in KZ |
| € € | ₸ KZT, tiyn rounding, spaces as thousands separator | |

## Screens

`*` = state inferred, not described in a source.

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign up | `web.khosmos.fr/#/register`, "Start free" CTA | Create an account. Trial starts with no card | email/phone input, password, CTA | filled, error* |
| S02 | Log in | `#/login` | Sign in. Multisession: many devices per account | inputs, forgot password* | filled, error* |
| S03 | Company setup (onboarding) | after S01. Trial clock starts when the first company is configured | Legal identity, logo, VAT status, bank details | form sections, logo upload, VAT toggle | empty, filled, error* |
| S04 | Dashboard | home after login | Cashed vs invoiced revenue, KPI changes, quote/invoice statuses, user activity | KPI cards, period selector, chart, status counts | empty*, filled, loading* |
| S05 | Company switcher | selector at the top of the screen | Run several companies from one account | dropdown / sheet | single company*, many |
| S06 | Quotes list | nav → Quotes | Every quote with status. Pending ones are shown to time follow-ups | list rows, status badge, filters, search, FAB "new" | empty*, filled, filtered |
| S07 | Quote editor | FAB → Quote, or from a client record | Build the quote: client, lines, photos, validity, deposit, notes, cover page | client picker, line-item editor, article picker, photo grid (≤10), totals, notes, cover page toggle | empty, draft (saved often), filled, error* |
| S08 | Document preview | from S07 / S16 / S19 (V3: preview while editing) | See the PDF as the client will. Pinch zoom on mobile | PDF viewer, zoom | loading*, filled |
| S09 | Send sheet | "Send" on a document | Share by email, WhatsApp or SMS with a secure link | share options, message template* | default, sent (toast)* |
| S10 | On-site signature | "Sign now" on a quote | The client signs with a finger on the tradesperson's phone | signature pad, name, clear / confirm | empty, signed |
| S11 | Client signing page (public) | link from S09, no login | Client reads the quote, verifies by SMS code, signs remotely | document view, OTP input, signature pad, accept | unopened, opened, OTP error*, signed, expired* |
| S12 | Signature certificate | from a signed quote | Proof of signing: initiator, signer, time, device, method | certificate PDF | filled |
| S13 | Quote detail + event history | tap a row in S06 | Status, opens (count and time), timeline, actions: send, sign, convert, duplicate* | status header, timeline, action bar | draft, sent, opened, signed, refused*, expired* |
| S14 | Convert dialog | "Convert" on a signed quote | Make a deposit invoice (% or amount), the final invoice, or a job report | radio options, amount/% toggle, preview of remaining balance | default, error* |
| S15 | Invoices list | nav → Invoices | All invoices. Filter by payment method, search by total incl. VAT | list rows, badges, filter chips, amount search | empty*, filled, filtered |
| S16 | Invoice detail / editor | from S15 or S14 | Edit lines, record payments, cancel a deposit through a credit note, history | editor (same as S07), payment list, record-payment sheet, timeline | draft*, issued, partly paid, paid, overdue, cancelled |
| S17 | Credit note editor | from an invoice | Credit by amount or by % | amount/% toggle, linked invoice, reason* | filled |
| S18 | Job report editor | from a quote or invoice | Report of the job with photos for the client or an insurance claim. In KZ, the АВР | description, photo grid, signature pad*, lines | empty, filled, deleted (V3) |
| S19 | "Quotes to invoice" report | Reports | Signed quotes not yet fully invoiced | table, progress per quote | empty, filled |
| S20 | Performance reports | Reports | Acceptance rate, payments received by period, per-member performance | period picker, charts, member filter | filled, empty* |
| S21 | Unpaid / collections | Reports or Invoices filter | Find unpaid and overdue invoices, send reminders | list, amount due, remind action | none due*, filled |
| S22 | Clients list | nav → Clients | Client database (access can be restricted per member) | list, search, FAB | empty*, filled, no-permission |
| S23 | Client record | tap a client | Details, timestamped comments, photos, documents. Quick call / SMS / directions, duplicate | header, quick-action row, tabs, comment thread, photo grid, document list | empty tabs*, filled |
| S24 | Catalogue / inventory | nav → Inventory (since v2.0) | Services and materials with unit, price, VAT. Locked for some members | list, search, item form, unit select incl. "flat rate" | empty*, filled, locked (read-only) |
| S25 | Team members | Settings → Team | Members, roles, invite (shorter flow in V3), remove | member rows, role chip, invite button | solo*, filled |
| S26 | Member permissions | tap a member | Captain = full. Toggles for creating documents, client base, others' documents, locked articles. Accountant and subcontractor presets | toggle list, role presets | default, edited |
| S27 | Accountant view / exports | accountant role login, or Settings → Export | Read-only data and CSV export | period picker, export button | filled, exporting*, done* |
| S28 | Company settings | Settings → Company | Identity, logo, bank, VAT, legal notices, terms of sale, insurance/licences, certifications, reviews | form sections, uploads, rich text | filled, error* |
| S29 | Cover page editor | Settings → Documents (V2.4) | Company presentation page shown first on quotes | text, photos, reviews, toggles | off, on |
| S30 | Document settings | Settings → Documents | Numbering, default validity (24h / 48h / 30 days), default VAT, footer, quote date and time | inputs, selects | filled |
| S31 | Subscription | Settings → Plan | Plan, seats, trial days left, upgrade, cancel at period end | plan cards, seat stepper, payment form | trial, active, past due (generation blocked), cancelled |
| S32 | Notifications | bell / push | Quote opened, quote signed (email + push), paid* | list, unread dot | empty*, filled |
| S33 | Review request | client record / after a job | Ask the client for a Google review by SMS | SMS template, send | sent* |
| S34 | Incoming e-invoices | nav → Purchases (V3) | Supplier e-invoices in one place. In KZ, received ESF | list, status | empty*, filled |

## Flows

```
F01 New user starts a trial and sets up a company
    S01 -> S03 -> S04
    happy path clicks: ~5 plus typing (estimate)
    edge: user already has an account, invalid БИН/ИИН, logo too large, second company (S05)

F02 Quote made on site and signed on the spot          <- core loop, the number to beat
    S04 -> S07 (pick client, add 1-3 lines from S24, photo) -> S08 -> S10 -> S13
    happy path clicks: ~8 taps / "about a minute" (Khosmos's own claim). Target for Docura: ≤6 taps, under 60s
    edge: new client created inline, article not in the catalogue, no connection on site (save offline),
          client refuses, line with a discount, mixed VAT rates

F03 Quote sent for remote signature
    S13 -> S09 (WhatsApp / email / SMS) -> [client] S11 open -> SMS code -> sign -> S12
    -> S32 "quote signed" -> S13
    happy path clicks: sender 3, client 4
    edge: client has no phone (no code needed), wrong code, link expired (validity passed),
          client opens it several times (count shown), quote edited after sending

F04 Signed quote → deposit → final invoice
    S13 -> S14 (deposit 30% or an amount) -> S16 -> S09 ... later S13 -> S14 (final) -> S16
    happy path clicks: deposit 5, final 3
    edge: several deposits, final invoice must subtract the deposits, quote changed after signing,
          deposit issued wrong (F06)

F05 Payment recorded and unpaid followed up
    S21 -> S16 -> record payment (amount, method, date) -> status paid / partly paid
    happy path clicks: 4
    edge: partial payment, overpayment, find an invoice from a bank transfer amount (search by total),
          Kaspi payment link pasted by hand

F06 Cancel a wrong deposit invoice
    S16 -> cancel -> S17 credit note issued -> S14 make a new deposit
    happy path clicks: "2 clicks" (changelog) + recreate
    edge: deposit already partly paid, VAT payer → corrected ESF needs buyer confirmation (KZ)

F07 Job report / АВР at the end of a job
    S13 or S16 -> S18 (photos, description) -> sign (S10, or eGov QR in KZ) -> send S09
    happy path clicks: ~5
    edge: client absent (remote signing), B2B client wants the АВР through IS ESF with an ЭЦП

F08 Invite a member and set permissions
    S25 -> invite (email/phone, role) -> S26 toggles -> member accepts -> member signs up / logs in
    happy path clicks: 4
    edge: subcontractor sees only their own documents, member removed while holding drafts,
          paid seats run out, accountant role is read-only

F09 Accountant exports the period
    [accountant] S27 -> period -> CSV
    happy path clicks: 3

F10 Owner follows up open quotes and unbilled work
    S04 -> S19 / S06 filter "pending" -> S13 -> remind (S09)
    happy path clicks: 4

F11 Switch company
    any screen -> S05 -> pick
    happy path clicks: 2

F12 Keep the client file up to date
    S22 -> S23 -> add comment / photo / call
    happy path clicks: 3
    edge: duplicate a client, company client with no phone (optional since V3)

F13 Build the catalogue
    S24 -> new item (title, description, unit, price, VAT, service or material) -> save
    edge: "flat rate" unit, locked articles for some members, price change does not touch documents already issued

F14 Brand the documents
    S28 -> S29 -> S30 -> S08 to preview

F15 Trial ends, user subscribes
    S31 -> plan, seats -> pay -> active
    edge: payment fails → 3-day grace → document generation blocked, existing documents still readable

F16 (KZ only) Issue the ESF for an invoice
    S16 -> "Issue ESF" -> sign with the company ЭЦП (NCALayer on desktop) -> IS ESF -> status
    edge: seller is not a VAT payer (no ESF), ЭЦП expired, IS ESF down, buyer confirmation pending
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, FAB | default, hover, focus, disabled, loading | all |
| Text input | text, email, phone (+7 mask), ИИН/БИН (12 digits, checksum), ИИК (KZ IBAN) | default, focus, error, disabled | S01, S03, S07, S23, S28 |
| Money input | ₸ with spaces as separators, tiyn | default, focus, error | S07, S14, S16, S17, S24 |
| Amount / % toggle | deposit, credit note, discount | amount, percent | S07, S14, S17 |
| Select | VAT rate, unit (pcs, m, m², m³, h, day, flat rate, …), payment method | open, closed, disabled | S07, S16, S24 |
| Date picker | single, range, quick periods (V3 redesign) | open, closed | S04, S07, S20, S27 |
| Status badge | draft, sent, opened, signed, refused, expired, issued, partly paid, paid, overdue, cancelled, ESF statuses | — | S06, S13, S15, S16, S21 |
| Document row | quote, invoice, credit note, job report | default, pressed, swipe actions* | S06, S15, S23 |
| Line-item editor row | service, material, section title* | editing, collapsed, drag handle, long-press details | S07, S16, S18 |
| Article picker | catalogue search + "create new" | empty, results, locked | S07, S16 |
| Client picker | search + quick create | empty, results | S07, S16, S18 |
| Totals panel | net, VAT, total incl. VAT, VAT recap by rate, deposits deducted, balance due, "Без НДС" | — | S07, S08, S16 |
| Photo grid | ≤10 photos, reorder, delete | empty, uploading, filled, limit reached | S07, S18, S23 |
| Signature pad | on site, remote | empty, drawing, signed, cleared | S10, S11, S18 |
| OTP input | 4–6 digits | default, error, resend timer | S11 |
| Share sheet | email, WhatsApp, SMS, copy link | default, sent | S09 |
| PDF viewer | inline, full screen, zoom | loading, ready, error | S08, S11, S12 |
| Timeline / event history | document events | empty, filled | S13, S16 |
| KPI card | value, delta, sparkline* | loading, filled | S04, S20 |
| Chart | bar by period, rate | loading, empty, filled | S04, S20 |
| Filter bar / chips | status, payment method, member, period | none, active | S06, S15, S20, S21 |
| Search field | text, amount | empty, typing, no results | S06, S15, S22, S24 |
| Empty state | per list | — | S06, S15, S22, S24, S32 |
| Toast | success, error, info | — | all |
| Modal / bottom sheet | confirm, convert, record payment, invite | open, closed | S14, S16, S25 |
| Company switcher | dropdown (desktop), sheet (mobile) | single, many | header |
| Nav | bottom tab bar (mobile), sidebar (desktop) | active item | all |
| Toggle list | permissions | on, off, disabled (captain) | S26 |
| Comment thread | timestamped notes with photos | empty, filled | S23 |
| Quick action row | call, SMS, directions, duplicate | — | S23 |
| Trial / billing banner | trial days left, past due | — | header |
| Plan card | monthly, annual | selected | S31 |

## Inferred data model

```
User         id, name, email, phone, password_hash, locale (ru|kk), created_at
             evidence: S01/S02, changelog "multisession"           confidence: high

Device       id, user_id, push_token, platform, last_seen_at
             evidence: changelog V3 "multisession… push notifications"  confidence: medium

Company      id, owner_user_id, legal_name, legal_form (ИП|ТОО|…), bin_iin, address, phone (optional),
             email, logo_url, bank_iik, bank_bik, bank_name, kbe, vat_payer (bool), vat_cert_no,
             default_vat_rate, terms_text, legal_notice_text, licences_text, reviews_summary,
             cover_page (json), default_validity, numbering (json), currency='KZT'
             evidence: FAQ multi-company + 0% notice, S28/S29, generator "company details saved"  confidence: high (FR fields → KZ)

Membership   id, company_id, user_id, role (captain|member|subcontractor|accountant),
             perms: create_quotes, create_invoices, client_base, others_docs, locked_articles,
             status (invited|active|removed)
             evidence: FAQ permissions, changelog "locked articles", App Store "accountant role"  confidence: high

Invitation   id, company_id, email_or_phone, role, perms (json), token, expires_at, accepted_at
             evidence: changelog V3 "simplified member invitations"   confidence: medium

Client       id, company_id, kind (person|company), name, contact_name, phone (optional for company),
             email, address, bin_iin, created_by, created_at
             evidence: S22/S23, changelog "phone optional for companies", "quick edit client details"  confidence: high

ClientNote   id, client_id, author_id, body, photos[], created_at
             evidence: changelog V3 "timestamped comments, photos"   confidence: high

Article      id, company_id, kind (service|material), title, description, unit, unit_price,
             vat_rate, archived
             evidence: v2.0 inventory page, "flat rate" unit, totals split services/materials  confidence: high

Document     id, company_id, type (quote|deposit_invoice|invoice|credit_note|job_report),
             number, status, client_id, client_snapshot (json), author_id, issue_date,
             valid_until (quote), due_date* (invoice), source_document_id (quote→invoice, invoice→credit note),
             deposit_mode (pct|amount), deposit_value, discount_total, net_total, vat_total, gross_total,
             notes, mentions, show_cover_page, photos[] (≤10), signed_at, locked_at
             evidence: S07/S14/S16/S17/S18, generator PDF anatomy, changelog  confidence: high (one table vs per-type: guess)

DocumentLine id, document_id, position, article_id (nullable), kind (service|material),
             title, description, qty, unit, unit_price, vat_rate, discount_mode, discount_value, line_total
             evidence: changelog "reorder lines", v2.0.1 "multiple VAT rates per line, line discounts"  confidence: high

ShareLink    id, document_id, token, created_at, expires_at, revoked_at
DocumentView id, share_link_id, opened_at, ip, user_agent
             evidence: "how many times and when the client opened it"   confidence: high

Signature    id, document_id, method (onsite|remote|egov_qr*), signer_name, signer_phone,
             otp_verified_at, image_url, ip, user_agent, signed_at, initiator_user_id, certificate_url
             evidence: changelog "SMS verification", "signature certificates", reviews "timestamps and device data"  confidence: high

Payment      id, invoice_id, amount, method (cash|transfer|card|kaspi|other), paid_at, note, recorded_by
             evidence: "filter invoices by payment method", "payments received by period"  confidence: high

DocumentEvent id, document_id, type (created|edited|sent|opened|signed|converted|paid|cancelled|credited|esf_*),
             actor_id, payload (json), at
             evidence: V2.3 "event history"   confidence: high

Reminder     id, invoice_id, channel (sms|email|whatsapp), sent_at
             evidence: App Store "tracks unpaid invoices with reminders"   confidence: medium

ReviewRequest id, client_id, channel=sms, sent_at
             evidence: App Store "collect Google reviews by SMS"   confidence: medium

Notification id, user_id, type, document_id, read_at
             evidence: V3 "email when a client signs", push   confidence: medium

Subscription id, owner_user_id, plan (monthly|annual), seats, trial_ends_at, status
             (trialing|active|past_due|cancelled), current_period_end, provider_ref
             evidence: CGV art. 3, 5   confidence: high

Export       id, company_id, requested_by, period_from, period_to, format=csv, file_url
             evidence: v2.0.1 "CSV exports", accountant role   confidence: medium

EsfRecord    id, document_id, esf_reg_number, status (draft|sent|delivered|confirmed|revoked|error),
   (KZ new)  errors (json), signed_at
             evidence: K3–K5. Docura only, not in Khosmos   confidence: guess (shape depends on the IS ESF API)

IncomingInvoice id, company_id, supplier_bin, number, date, totals, raw (xml), status
             evidence: V3 "incoming e-invoices". In KZ these are received ESF   confidence: guess
```

Relationships: User 1-n Membership n-1 Company. Company 1-n Client, Article, Document, Invitation.
Client 1-n Document, ClientNote. Document 1-n DocumentLine, ShareLink, Signature, DocumentEvent, Payment (invoices).
Document (quote) 1-n Document (deposit invoices, final invoice, job report) through source_document_id.
Document (invoice) 1-n Document (credit notes). ShareLink 1-n DocumentView. Document 0-1 EsfRecord. User 1-1 Subscription.

## Feature matrix

See `features.csv` (84 rows). Must: 34, should: 21, could: 10, skip: 19 (`clone = skip`, with the reason in notes).
Rows with `original = no` are additions for Kazakhstan, not Khosmos features.

## Out of scope (cannot or should not be cloned)

- **Khosmos's content and brand.** Texts, images, illustrations, quote layout artwork, name and logo. CGU art. 3 forbids reproducing them. Docura gets its own copy and design.
- **The other products.** Hub, phone line, directory/listing, planning, marketplace (buying and selling businesses), insurance, Amex card, referral programme, free calculators.
- **The network.** 15,000+ users, Google reviews, testimonials, the WhatsApp support team (a service, not a feature).
- **France-only compliance.** NF525, Factur-X and the PA connection, VAT attestations, CEE/MaPrimeRénov' grant deductions, art. 293B wording, ten-year construction insurance.
- **Native iOS/Android apps and Apple in-app purchase.** The user chose a PWA.
- **Things to check before launch (risks, not features):**
  - **Legal weight of a finger or SMS signature in KZ.** A simple signature is probably fine as evidence of a B2C quote. The АВР and B2B documents normally need an ЭЦП (K6). Get a KZ lawyer's view before marketing "legally binding signatures".
  - **ESF obligations and format.** Order No. 629 applies from 2026-01-01. Read the source text and the IS ESF API spec before building F16.
  - **Fiscal receipts.** Taking cash or card from individuals may require an online cash register (ККМ). Docura records payments and does not act as a cash register.

## Size

Screens 34, flows 16, entities 21.

Hard parts:
1. **Document maths and PDFs.** VAT per line at 16% / 0% / exempt, discounts, deposits deducted from the final invoice, credit notes, tiyn rounding, bilingual RU/KK PDFs with Cyrillic and Kazakh glyphs. All of it has to be exact and look professional on a phone.
2. **Signatures.** On-site pad and remote link with SMS code (KZ SMS provider), open tracking, signature certificate, document locked after signing. eGov QR / ЭЦП signing for the АВР is a second tier.
3. **IS ESF integration.** The company signs with its ЭЦП through NCALayer, which is a desktop app, so ESF cannot be issued from the phone. Biometric registration, buyer confirmation, status sync.
4. **Permissions.** Row-level access per company and member (own documents only, client base hidden, locked prices), plus the accountant read-only role and multi-company.
5. **Working on site.** PWA offline drafts and photo uploads on a weak connection.

Size: **L** (about a quarter) for the full matrix with ESF. **M** (a few weeks) if v1 ships the must rows and leaves ESF and eGov signing for v1.1.
That still covers the core loop, the KZ documents as PDFs, manual payments and the team roles. No promise of a pixel-perfect clone, and none is wanted: the flow is cloned, the look is Docura's own.
