-- ═══════════════════════════════════════════════════════════════════════════
-- Ledgerline — Foundation schema (Phase 0/1)
--
-- Multi-tenant model: every row belongs to a firm, and Row-Level Security
-- guarantees a user can only ever touch their own firm's data. `firm_id` is
-- denormalized onto tenant tables so every policy is the same trivial, indexed
-- check — no recursive joins in the hot path.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────────────
create type user_role         as enum ('admin', 'manager', 'staff', 'reviewer', 'readonly');
create type entity_type       as enum ('Individual', 'Partnership', 'S-Corp', 'C-Corp', 'Non-Profit', 'Trust');
create type engagement_basis  as enum ('GAAP', 'Cash', 'Tax', 'Modified-Cash');
create type engagement_status as enum ('open', 'in_review', 'final', 'locked', 'archived');
create type account_type      as enum ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE', 'OTHER');
create type entry_type        as enum ('RJE', 'AJE', 'TAX', 'BOOK');
create type adjustment_status as enum ('proposed', 'posted');

-- ─── Firms & users ─────────────────────────────────────────────────────────
create table firms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Mirrors auth.users; carries the firm membership and role that RLS keys on.
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  firm_id    uuid references firms (id) on delete set null,
  full_name  text,
  email      text,
  role       user_role not null default 'staff',
  created_at timestamptz not null default now()
);
create index profiles_firm_idx on profiles (firm_id);

-- Returns the caller's firm. SECURITY DEFINER so the lookup itself bypasses RLS
-- (avoids infinite recursion when policies call it). STABLE for planner caching.
create or replace function auth_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select firm_id from profiles where id = auth.uid();
$$;

-- ─── Firm-standard leadsheet groups (Chart-of-Accounts standardization) ─────
create table account_groups (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references firms (id) on delete cascade,
  code       text not null,
  name       text not null,
  type       account_type not null,
  sort_order integer not null default 0,
  unique (firm_id, code)
);
create index account_groups_firm_idx on account_groups (firm_id);

-- ─── Master Chart-of-Accounts templates ────────────────────────────────────
create table coa_templates (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms (id) on delete cascade,
  name        text not null,
  entity_type entity_type,
  created_at  timestamptz not null default now()
);
create index coa_templates_firm_idx on coa_templates (firm_id);

create table coa_template_accounts (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms (id) on delete cascade,
  template_id uuid not null references coa_templates (id) on delete cascade,
  code        text not null,
  name        text not null,
  type        account_type not null,
  group_code  text,
  unique (template_id, code)
);
create index coa_template_accounts_tmpl_idx on coa_template_accounts (template_id);

-- ─── Clients & engagements ─────────────────────────────────────────────────
create table clients (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms (id) on delete cascade,
  name        text not null,
  entity_type entity_type,
  ein         text,
  created_at  timestamptz not null default now()
);
create index clients_firm_idx on clients (firm_id);

create table engagements (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references firms (id) on delete cascade,
  client_id           uuid not null references clients (id) on delete cascade,
  fiscal_year         integer not null,
  period_end          date,
  entity_type         entity_type,
  basis               engagement_basis not null default 'Tax',
  status              engagement_status not null default 'open',
  -- Link to the prior year's engagement for rollovers / comparatives.
  prior_engagement_id uuid references engagements (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index engagements_firm_idx   on engagements (firm_id);
create index engagements_client_idx on engagements (client_id);

-- ─── Accounts (per engagement) ─────────────────────────────────────────────
create table accounts (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms (id) on delete cascade,
  engagement_id uuid not null references engagements (id) on delete cascade,
  code          text not null,
  name          text not null,
  type          account_type not null default 'OTHER',
  group_id      uuid references account_groups (id) on delete set null,
  -- Unadjusted balance, debit-positive, in dollars.
  unadjusted    numeric(16, 2) not null default 0,
  created_at    timestamptz not null default now(),
  unique (engagement_id, code)
);
create index accounts_engagement_idx on accounts (engagement_id);
create index accounts_firm_idx       on accounts (firm_id);

-- ─── Adjusting entries ─────────────────────────────────────────────────────
create table adjustments (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms (id) on delete cascade,
  engagement_id uuid not null references engagements (id) on delete cascade,
  reference     text,
  entry_date    date,
  memo          text,
  type          entry_type not null default 'AJE',
  status        adjustment_status not null default 'proposed',
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index adjustments_engagement_idx on adjustments (engagement_id);

create table adjustment_lines (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms (id) on delete cascade,
  adjustment_id uuid not null references adjustments (id) on delete cascade,
  account_id    uuid not null references accounts (id) on delete cascade,
  debit         numeric(16, 2) not null default 0,
  credit        numeric(16, 2) not null default 0,
  check (debit >= 0 and credit >= 0)
);
create index adjustment_lines_adj_idx     on adjustment_lines (adjustment_id);
create index adjustment_lines_account_idx on adjustment_lines (account_id);

-- ─── Tax-line mapping ──────────────────────────────────────────────────────
create table tax_mappings (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms (id) on delete cascade,
  engagement_id uuid not null references engagements (id) on delete cascade,
  account_id    uuid references accounts (id) on delete cascade,
  group_id      uuid references account_groups (id) on delete cascade,
  tax_line      text not null,
  -- Map either a single account or a whole group, never neither.
  check (account_id is not null or group_id is not null),
  unique (engagement_id, account_id)
);
create index tax_mappings_engagement_idx on tax_mappings (engagement_id);

-- ─── Immutable audit trail ─────────────────────────────────────────────────
create table audit_log (
  id            bigint generated always as identity primary key,
  firm_id       uuid references firms (id) on delete cascade,
  engagement_id uuid references engagements (id) on delete set null,
  user_id       uuid references auth.users (id) on delete set null,
  action        text not null,
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_engagement_idx on audit_log (engagement_id);
