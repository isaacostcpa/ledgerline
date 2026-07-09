-- ═══════════════════════════════════════════════════════════════════════════
-- Ledgerline — Row-Level Security
--
-- Default-deny on every table, then firm-scoped policies. A user only ever sees
-- and writes rows whose firm_id matches their own (auth_firm_id()). Writes to
-- staff-restricted tables additionally require a non-read-only role.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS everywhere.
alter table firms                 enable row level security;
alter table profiles              enable row level security;
alter table account_groups        enable row level security;
alter table coa_templates         enable row level security;
alter table coa_template_accounts enable row level security;
alter table clients               enable row level security;
alter table engagements           enable row level security;
alter table accounts              enable row level security;
alter table adjustments           enable row level security;
alter table adjustment_lines      enable row level security;
alter table tax_mappings          enable row level security;
alter table audit_log             enable row level security;

-- True when the caller belongs to a firm and is not read-only.
create or replace function auth_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and firm_id is not null and role <> 'readonly'
  );
$$;

-- ─── firms: a user sees only their own firm ────────────────────────────────
create policy firms_select on firms
  for select using (id = auth_firm_id());
create policy firms_update on firms
  for update using (id = auth_firm_id() and auth_can_write());

-- ─── profiles: see everyone in your firm; only manage your own row ──────────
create policy profiles_select on profiles
  for select using (firm_id = auth_firm_id() or id = auth.uid());
create policy profiles_insert on profiles
  for insert with check (id = auth.uid());
create policy profiles_update on profiles
  for update using (id = auth.uid());

-- ─── Generic firm-scoped tables ────────────────────────────────────────────
-- Read: any firm member. Write: any non-read-only firm member. (Finer-grained
-- role gates — reviewer sign-off, locking — are layered on in later phases.)

create policy account_groups_rw on account_groups
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy coa_templates_rw on coa_templates
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy coa_template_accounts_rw on coa_template_accounts
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy clients_rw on clients
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy engagements_rw on engagements
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy accounts_rw on accounts
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy adjustments_rw on adjustments
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy adjustment_lines_rw on adjustment_lines
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

create policy tax_mappings_rw on tax_mappings
  for all using (firm_id = auth_firm_id())
  with check (firm_id = auth_firm_id() and auth_can_write());

-- ─── audit_log: firm members read; anyone in the firm may append; never edit ─
create policy audit_log_select on audit_log
  for select using (firm_id = auth_firm_id());
create policy audit_log_insert on audit_log
  for insert with check (firm_id = auth_firm_id());
