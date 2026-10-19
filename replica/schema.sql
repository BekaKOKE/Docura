-- Docura schema v1 (MVP)
--
-- Reference DDL. It runs as is on SQLite 3.35+ and PostgreSQL 14+.
-- At runtime the source of truth is the SQLAlchemy models in backend/app/db/models.py
-- plus the Alembic migrations. They must produce this shape.
--
-- Conventions (see architecture.md, "Schema"):
--   ids          uuid, generated in Python (uuid4). No gen_random_uuid(), which is Postgres-only.
--   times        timestamptz, always UTC, written by the app.
--   dates        date for business dates (issue, due, payment). Calendar day in the company's time zone.
--   money        bigint tiyn (1 ₸ = 100 tiyn) + currency char(3) = 'KZT'.
--   quantities   bigint thousandths: qty_milli 2500 = 2.5. No float, no numeric (SQLite stores numeric as float).
--   rates        integer basis points: 1600 = 16.00 %.
--   statuses     text + check constraint. No native enums.
--   tenancy      every tenant-owned row carries company_id. Access is checked in the data layer (no RLS: SQLite has none).
--   SQLite       the app runs PRAGMA foreign_keys = ON on every connection, otherwise SQLite ignores the FKs below.
--
-- on delete rules:
--   company -> everything it owns       cascade   (deleting the account wipes the tenant)
--   document -> its lines, links, signatures, payments, events   cascade   (only drafts are deletable: app rule)
--   document -> client                  no action (clients are archived, never deleted while referenced)
--   document -> source document         no action (a quote with invoices is never deleted)
--   line -> article                     set null  (the line keeps its own copy of title, unit, price)
--   row -> user who created it          set null  (history survives a removed member)
-- "no action" rather than "restrict": both databases check it at the end of the statement,
-- so a company cascade can delete clients and documents in the same statement.

create table users (
  id             uuid primary key,
  email          varchar(254) not null,               -- stored lower-cased
  password_hash  varchar(255) not null,               -- argon2id
  full_name      varchar(200) not null,
  locale         varchar(5)   not null default 'ru' check (locale in ('ru', 'kk')),
  last_login_at  timestamptz,
  created_at     timestamptz  not null default current_timestamp,
  updated_at     timestamptz  not null default current_timestamp
);
create unique index users_email_uq on users (email);

create table companies (
  id                   uuid primary key,
  legal_form           varchar(10)  not null check (legal_form in ('ip', 'too', 'ao', 'other')),  -- ИП, ТОО, АО
  legal_name           varchar(300) not null,
  bin_iin              char(12)     not null check (length(bin_iin) = 12),   -- checksum validated in the app
  address              text         not null default '',
  phone                varchar(32),
  email                varchar(254),
  director_name        varchar(200) not null default '',                    -- "Сдал" on the АВР
  director_position    varchar(200) not null default '',
  vat_payer            boolean      not null default false,
  vat_certificate      varchar(100),
  bank_name            varchar(200),
  iik                  varchar(20)  check (iik is null or length(iik) = 20), -- KZ IBAN
  bik                  varchar(11),
  kbe                  char(2),
  default_knp          char(3),
  logo                 bytea,                                               -- PNG/JPEG, ≤ 300 KB
  logo_mime            varchar(20)  check (logo_mime is null or logo_mime in ('image/png', 'image/jpeg')),
  timezone             varchar(64)  not null default 'Asia/Almaty',         -- IANA name, never a fixed offset
  quote_validity_days  integer      not null default 14 check (quote_validity_days between 1 and 365),
  invoice_due_days     integer      not null default 5  check (invoice_due_days between 0 and 365),
  currency             char(3)      not null default 'KZT' check (currency = 'KZT'),
  created_at           timestamptz  not null default current_timestamp,
  updated_at           timestamptz  not null default current_timestamp
);

create table memberships (
  id          uuid primary key,
  company_id  uuid        not null references companies (id) on delete cascade,
  user_id     uuid        not null references users (id) on delete cascade,
  role        varchar(20) not null default 'owner'
              check (role in ('owner', 'member', 'subcontractor', 'accountant')),  -- MVP uses 'owner' only
  created_at  timestamptz not null default current_timestamp,
  updated_at  timestamptz not null default current_timestamp
);
create unique index memberships_company_user_uq on memberships (company_id, user_id);
create index memberships_user_idx on memberships (user_id);

create table clients (
  id            uuid primary key,
  company_id    uuid         not null references companies (id) on delete cascade,
  kind          varchar(10)  not null check (kind in ('person', 'company')),
  name          varchar(300) not null,
  search_name   varchar(300) not null,   -- name.casefold() in Python: SQLite lower() and LIKE only fold ASCII
  bin_iin       char(12)     check (bin_iin is null or length(bin_iin) = 12),
  contact_name  varchar(200),
  phone         varchar(32),
  email         varchar(254),
  address       text,
  notes         text,
  archived_at   timestamptz,
  created_by    uuid         references users (id) on delete set null,
  created_at    timestamptz  not null default current_timestamp,
  updated_at    timestamptz  not null default current_timestamp
);
create index clients_company_search_idx on clients (company_id, search_name);
create index clients_created_by_idx on clients (created_by);

create table articles (
  id               uuid primary key,
  company_id       uuid         not null references companies (id) on delete cascade,
  kind             varchar(10)  not null check (kind in ('service', 'material')),
  title            varchar(300) not null,
  search_title     varchar(300) not null,  -- title.casefold()
  description      text,
  unit             varchar(20)  not null,  -- шт, м, м², м³, п.м., кг, т, л, ч, смена, компл., услуга
  unit_price_tiyn  bigint       not null check (unit_price_tiyn >= 0),
  currency         char(3)      not null default 'KZT' check (currency = 'KZT'),
  archived_at      timestamptz,
  created_at       timestamptz  not null default current_timestamp,
  updated_at       timestamptz  not null default current_timestamp
);
create index articles_company_search_idx on articles (company_id, search_title);

-- One table for КП (quote), счёт на оплату (invoice) and АВР (act).
-- They share numbering, lines, totals, rendering and the list screen.
create table documents (
  id                  uuid primary key,
  company_id          uuid         not null references companies (id) on delete cascade,
  type                varchar(10)  not null check (type in ('quote', 'invoice', 'act')),
  status              varchar(10)  not null default 'draft',
  number              varchar(30),            -- null while draft. КП-2026-0001, СЧ-2026-0001, АВР-2026-0001
  issue_date          date         not null,
  valid_until         date,                   -- quote only
  due_date            date,                   -- invoice only
  period_from         date,                   -- act only: отчётный период
  period_to           date,
  contract_ref        varchar(200),           -- "КП № … от …" or the client's contract number
  client_id           uuid         not null references clients (id),               -- no action
  client_snapshot     json         not null,  -- client requisites as printed. Frozen once issued
  company_snapshot    json         not null,  -- company requisites as printed. Frozen once issued
  source_document_id  uuid         references documents (id),                      -- no action. invoice/act -> quote
  basis               varchar(10)  check (basis is null or basis in ('full', 'percent', 'amount', 'remaining')),
  basis_value         bigint,                 -- basis points for 'percent', tiyn for 'amount'
  vat_enabled         boolean      not null,
  vat_rate_bp         integer      not null check (vat_rate_bp between 0 and 10000),  -- copied from settings: 1600
  currency            char(3)      not null default 'KZT' check (currency = 'KZT'),
  net_tiyn            bigint       not null default 0 check (net_tiyn >= 0),
  vat_tiyn            bigint       not null default 0 check (vat_tiyn >= 0),
  gross_tiyn          bigint       not null default 0 check (gross_tiyn >= 0),
  notes               text,
  terms               text,
  version             integer      not null default 1 check (version >= 1),  -- bumped on every save
  issued_at           timestamptz,            -- left draft (quote: sent)
  signed_at           timestamptz,
  cancelled_at        timestamptz,
  created_by          uuid         references users (id) on delete set null,
  client_request_id   uuid,                   -- idempotency key from the client, optional
  created_at          timestamptz  not null default current_timestamp,
  updated_at          timestamptz  not null default current_timestamp,
  constraint documents_status_ck check (
       (type = 'quote'   and status in ('draft', 'sent', 'signed', 'declined', 'cancelled'))
    or (type = 'invoice' and status in ('draft', 'issued', 'cancelled'))
    or (type = 'act'     and status in ('draft', 'issued', 'signed', 'cancelled'))),
  constraint documents_number_ck   check (status = 'draft' or number is not null),
  constraint documents_totals_ck   check (gross_tiyn = net_tiyn + vat_tiyn),
  constraint documents_vat_ck      check (vat_enabled or vat_tiyn = 0),
  constraint documents_quote_ck    check (type = 'quote' or valid_until is null),
  constraint documents_invoice_ck  check (type = 'invoice' or due_date is null),
  constraint documents_act_ck      check (type = 'act' or (period_from is null and period_to is null)),
  constraint documents_source_ck   check (source_document_id is null or type in ('invoice', 'act')),
  constraint documents_basis_ck    check (basis is null or type = 'invoice')
);
create unique index documents_number_uq on documents (company_id, type, number);            -- NULLs (drafts) don't collide
create unique index documents_request_uq on documents (company_id, client_request_id);      -- NULLs don't collide
create index documents_list_idx on documents (company_id, type, status, issue_date);
create index documents_client_idx on documents (client_id);
create index documents_source_idx on documents (source_document_id);
create index documents_created_by_idx on documents (created_by);

create table document_lines (
  id               uuid primary key,
  company_id       uuid         not null references companies (id) on delete cascade,
  document_id      uuid         not null references documents (id) on delete cascade,
  position         integer      not null check (position >= 0),
  article_id       uuid         references articles (id) on delete set null,
  kind             varchar(10)  not null check (kind in ('service', 'material')),
  title            varchar(500) not null,
  description      text,
  unit             varchar(20)  not null,
  qty_milli        bigint       not null check (qty_milli > 0),
  unit_price_tiyn  bigint       not null check (unit_price_tiyn >= 0),
  discount_bp      integer      not null default 0 check (discount_bp between 0 and 10000),
  net_tiyn         bigint       not null check (net_tiyn >= 0),
  vat_tiyn         bigint       not null check (vat_tiyn >= 0),
  gross_tiyn       bigint       not null,
  work_date        date,                       -- act: "дата выполнения работ" column of Р-1
  constraint document_lines_totals_ck check (gross_tiyn = net_tiyn + vat_tiyn)
);
create unique index document_lines_position_uq on document_lines (document_id, position);  -- lines are replaced whole on save
create index document_lines_company_idx on document_lines (company_id);
create index document_lines_article_idx on document_lines (article_id);

-- Gap-free numbering per company, type and year. Updated in the same transaction that issues the document.
-- No id or timestamps: a counter row, not an entity.
create table document_counters (
  company_id   uuid        not null references companies (id) on delete cascade,
  type         varchar(10) not null check (type in ('quote', 'invoice', 'act')),
  year         integer     not null check (year between 2000 and 2999),
  last_number  integer     not null default 0 check (last_number >= 0),
  primary key (company_id, type, year)
);

create table share_links (
  id               uuid primary key,
  company_id       uuid        not null references companies (id) on delete cascade,
  document_id      uuid        not null references documents (id) on delete cascade,
  token            varchar(64) not null,   -- secrets.token_urlsafe(32): 43 chars, 256 bits
  expires_at       timestamptz,
  revoked_at       timestamptz,
  view_count       integer     not null default 0 check (view_count >= 0),
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  created_at       timestamptz not null default current_timestamp,
  updated_at       timestamptz not null default current_timestamp
);
create unique index share_links_token_uq on share_links (token);
create index share_links_company_idx on share_links (company_id);
create index share_links_document_idx on share_links (document_id);

create table signatures (
  id                 uuid primary key,
  company_id         uuid         not null references companies (id) on delete cascade,
  document_id        uuid         not null references documents (id) on delete cascade,
  share_link_id      uuid         references share_links (id) on delete set null,
  method             varchar(10)  not null default 'drawn' check (method in ('drawn')),  -- later: 'sms', 'ecp', 'egov_qr'
  signer_role        varchar(10)  not null default 'client' check (signer_role in ('client')),
  signer_name        varchar(200) not null,
  image              bytea        not null,   -- PNG, ≤ 200 KB
  image_sha256       char(64)     not null,
  document_version   integer      not null,
  document_sha256    char(64)     not null,   -- sha256 of the canonical JSON in document_snapshot
  document_snapshot  json         not null,   -- exactly what the signer saw
  consent_text       text         not null,
  ip                 varchar(45),
  user_agent         varchar(500),
  signed_at          timestamptz  not null,
  created_at         timestamptz  not null default current_timestamp,
  updated_at         timestamptz  not null default current_timestamp
);
create unique index signatures_document_role_uq on signatures (document_id, signer_role);  -- one client signature per document
create index signatures_company_idx on signatures (company_id);
create index signatures_share_link_idx on signatures (share_link_id);

create table payments (
  id                 uuid primary key,
  company_id         uuid        not null references companies (id) on delete cascade,
  document_id        uuid        not null references documents (id) on delete cascade,  -- invoices only (service check)
  amount_tiyn        bigint      not null check (amount_tiyn > 0),
  currency           char(3)     not null default 'KZT' check (currency = 'KZT'),
  method             varchar(10) not null check (method in ('cash', 'transfer', 'card', 'kaspi', 'other')),
  paid_on            date        not null,
  note               text,
  created_by         uuid        references users (id) on delete set null,
  client_request_id  uuid,
  created_at         timestamptz not null default current_timestamp,
  updated_at         timestamptz not null default current_timestamp
);
create unique index payments_request_uq on payments (company_id, client_request_id);
create index payments_document_idx on payments (document_id);
create index payments_company_paid_on_idx on payments (company_id, paid_on);
create index payments_created_by_idx on payments (created_by);

-- Append-only audit log. Powers the timeline, open tracking and dashboard activity. No updated_at.
create table document_events (
  id             uuid primary key,
  company_id     uuid        not null references companies (id) on delete cascade,
  document_id    uuid        not null references documents (id) on delete cascade,
  type           varchar(20) not null check (type in (
                   'created', 'updated', 'issued', 'viewed', 'signed', 'declined', 'converted',
                   'payment_added', 'payment_removed', 'cancelled', 'link_rotated')),
  actor_kind     varchar(10) not null check (actor_kind in ('user', 'client', 'system')),
  actor_user_id  uuid        references users (id) on delete set null,
  data           json        not null default '{}',
  at             timestamptz not null,
  created_at     timestamptz not null default current_timestamp
);
create index document_events_document_idx on document_events (document_id, at);
create index document_events_company_idx on document_events (company_id, at);
create index document_events_actor_idx on document_events (actor_user_id);

-- Post-MVP tables, not created in v1 (architecture.md, "Build order", M5+):
--   sign_challenges   SMS codes for remote signing (document_id, phone, code_hash, attempts, expires_at)
--   esf_records       IS ESF submissions (document_id, esf_reg_number, status, errors, signed_at)
--   invitations       team invites (company_id, email_or_phone, role, token, expires_at, accepted_at)
--   client_notes      timestamped comments and photos on a client record
--   document_photos   up to 10 photos per document (file storage, not the database)
--   exports           CSV exports for the accountant role
