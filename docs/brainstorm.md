# Brainstorm log: how the Docura idea was chosen

Date: 2026-10-19. Author: Beksultan Sauytbek, brainstorming with Claude (claude.ai).
This is an abridged log of the conversation held BEFORE any code or repo structure
was created. Questions are paraphrased from the original Russian messages; answers
are shortened. Nothing was added afterwards.

## 1. The assignment (as I understood it)

- Pick a project idea, different from Part I, a non-trivial app (not a habit tracker
  or to-do list), something I would be proud to show.
- Ideas may come from https://trustmrr.com/ (startup and money part).
- Fully follow two articles and combine them:
  - https://aishippingblog.com/p/ai-native-development-specifications
  - https://aishippingblog.com/p/build-and-ship-a-full-stack-app-with
- Work through GitHub Issues (labels: mvp, post-mvp, user-test-bug), up to ~100 issues.
- Persistent storage SQLite, DBMS-agnostic access through an ORM.
- Iterations: frontend with mock service -> openapi.yml -> backend in memory ->
  backend with SQLite -> connect frontend and backend.
- Non-generic design (Lovable / v0 / Claude Design) or good references for the coding agent.
- All .md files in the repo and improved while developing; this brainstorm saved as .md.
- Really run and test the app. Every bug found becomes an issue labelled
  user-test-bug (Goal + Description); pm.md grooms it, qa.md adds test cases,
  qa-engineer.md closes it. All mvp and user-test-bug issues closed before the deadline.

My first question: is a full project needed, or only something approximate?
Answer: a full, really working project plus the traces of the process.

## 2. Round 1: ideas taken from TrustMRR (not B2B)

Claude read the TrustMRR home page and suggested six directions:
1. LLM Gateway (proxy to LLM providers, key storage, cost dashboards). Reference: LLM Gateway, ~$79k MRR.
2. RFQ -> quotation (КП) tool for B2B suppliers (my own domain).
3. Multi-platform social post scheduler (Postiz, Post Bridge, Podawaa).
4. AI-search visibility (AEO) tracker (Rank Prompt, AEO Engine).
5. Sales signals + mini CRM (GojiberryAI, Prosp, traxy).
6. Faceless video studio (White Glove Content, Vid.AI).

I chose idea 2 first, then asked what Claude would build in general. Claude proposed
LLM Gateway; I rejected it ("other ideas needed"). Second list (also from TrustMRR):
resume builder with ATS score (Rezi), coding-course platform (Codedex), faceless video
studio, GitHub portfolio generator (GitFolio), spaced-repetition language app,
e-commerce product research (Dropkiller).

## 3. Round 2: I said I am interested in B2B

Claude read the TrustMRR categories SaaS, Sales, Recruiting, Customer Support, Fintech
and listed real B2B startups as models:
1. Compliance tracker for SOC 2 / ISO (Comp AI, ~$11k MRR, $6.1M total).
2. Quotes, invoices and acts for small contractors (Khosmos, ~$22k MRR).
3. Async video interviews for hiring (Hirevire, ~$14k MRR).
4. IT help desk for small business (uhoh.com, ~$34k MRR).
5. Corporate catering orders (MyCater).

Recommendation was 2 or 1. I picked the Khosmos-style product (idea 2) and said I also
want to build such a site for Kazakhstan for myself.

## 4. Decision

Build **Docura**: a quote (коммерческое предложение) -> payment invoice (счёт на оплату)
-> completion act (акт выполненных работ) app for small tradespeople and
sole proprietors in Kazakhstan. Inspired by the TrustMRR startup Khosmos (France),
rebuilt clean-room: functions and flows only, never its texts, images, logo or design.

Why this idea:
- Non-trivial domain logic (document maths, VAT 16%, tiyn rounding, numbering, signing).
- I know the quotation and invoicing process from daily work.
- Real market proof on TrustMRR; the assignment result can become the MVP of a real product.

The assignment MVP is the first release of the real product; the rest goes to post-mvp.

## 5. Process decisions and corrections made during brainstorming

- 100 issues is a ceiling ("up to 100"), not a target. Quality over count; every mvp
  issue must be closed and verified.
- Stack follows the second article: React + TypeScript frontend, Python FastAPI + uv
  backend, SQLAlchemy ORM over SQLite (DATABASE_URL, no SQLite-only features).
- Four agent files: pm.md, software-engineer.md, qa.md, qa-engineer.md. Only
  qa-engineer.md closes issues, after a PASS.
- The third-party "replica-skill" plugin (MIT) is used only as a research and design
  helper (recon, architecture, design, test templates). It does not drive the process;
  GitHub Issues and the iteration order from the assignment do.

## 6. Answers given to the recon questionnaire

- Slice: core loop + admin (quote, signature, invoices, payment tracking, clients,
  item catalogue, company settings).
- Market: Kazakhstan (KZT, VAT 16%, Russian UI, ЭСФ later).
- Platform: responsive web / PWA (no native apps).
- Account: public sources only, no login to any competitor.

## 7. Scope decisions

MVP: clients, item catalogue, quote with KZT and VAT toggle, public link with finger
signature, quote -> invoice -> act, manual payment tracking, simple dashboard, Russian
UI, live preview, draft numbering, cancel and duplicate.
Post-MVP: ЭСФ integration, ЭЦП via NCALayer, SMS codes, Kaspi, Kazakh language, team
roles, accountant access, open tracking, line discounts, photos, notifications, credit notes.
To verify before release: Kazakhstan tax figures (VAT threshold, e-invoice rules,
БИН/ИИН checks, data-localisation rule) against official texts.

## 8. Outputs of the research phase (in this repo under replica/)

- recon.md, features.csv: 34 screens, 16 flows, 21 entities, 84 features.
- architecture.md, schema.sql: 12 tables, 38 routes, storage switch memory/sql.
- design/: own "site notebook" visual identity, Onest + IBM Plex Mono fonts,
  tokens, component specs, design brief for the design agent.
