-- ═══════════════════════════════════════════════════════════════════════════
-- Ledgerline — Firm onboarding
--
-- bootstrap_firm() creates a firm, makes the caller its admin, and seeds the
-- standard leadsheet groups (mirrors defaultAccountGroups() in the app domain).
-- SECURITY DEFINER so a brand-new user with no firm can run it exactly once.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function bootstrap_firm(firm_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_firm_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  -- Refuse if the caller already belongs to a firm.
  if exists (select 1 from profiles where id = auth.uid() and firm_id is not null) then
    raise exception 'user already belongs to a firm';
  end if;

  insert into firms (name) values (firm_name) returning id into new_firm_id;

  insert into profiles (id, firm_id, email, role)
  values (auth.uid(), new_firm_id, (select email from auth.users where id = auth.uid()), 'admin')
  on conflict (id) do update set firm_id = excluded.firm_id, role = 'admin';

  insert into account_groups (firm_id, code, name, type, sort_order) values
    (new_firm_id, 'CASH',       'Cash & Cash Equivalents',     'ASSET',      10),
    (new_firm_id, 'AR',         'Accounts Receivable',         'ASSET',      20),
    (new_firm_id, 'INV',        'Inventory',                   'ASSET',      30),
    (new_firm_id, 'PREPAID',    'Prepaid Expenses',            'ASSET',      40),
    (new_firm_id, 'FIXED',      'Property & Equipment',        'ASSET',      50),
    (new_firm_id, 'ACCUMDEP',   'Accumulated Depreciation',    'ASSET',      55),
    (new_firm_id, 'OTHERASSET', 'Other Assets',                'ASSET',      60),
    (new_firm_id, 'AP',         'Accounts Payable',            'LIABILITY', 110),
    (new_firm_id, 'ACCRUED',    'Accrued Liabilities',         'LIABILITY', 120),
    (new_firm_id, 'CC',         'Credit Cards',                'LIABILITY', 125),
    (new_firm_id, 'NOTES',      'Notes & Loans Payable',       'LIABILITY', 130),
    (new_firm_id, 'OTHERLIAB',  'Other Liabilities',           'LIABILITY', 140),
    (new_firm_id, 'EQUITY',     'Equity',                      'EQUITY',    200),
    (new_firm_id, 'REVENUE',    'Revenue',                     'INCOME',    300),
    (new_firm_id, 'COGS',       'Cost of Goods Sold',          'COGS',      400),
    (new_firm_id, 'PAYROLL',    'Salaries & Payroll',          'EXPENSE',   500),
    (new_firm_id, 'RENT',       'Rent & Occupancy',            'EXPENSE',   510),
    (new_firm_id, 'INTEREST',   'Interest Expense',            'EXPENSE',   520),
    (new_firm_id, 'DEPREXP',    'Depreciation & Amortization', 'EXPENSE',   530),
    (new_firm_id, 'OTHEREXP',   'Other Operating Expenses',    'EXPENSE',   540);

  return new_firm_id;
end;
$$;
