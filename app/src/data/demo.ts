/**
 * A bundled sample engagement used in demo mode (no Supabase configured).
 * It is a real, balanced small-business trial balance with posted adjustments
 * across every column plus one proposed entry, so the Working Trial Balance
 * exercises the full engine.
 */
import { defaultAccountGroups } from '../domain/coa';
import type {
  AccountGroupRow,
  AccountRow,
  AdjustmentLineRow,
  AdjustmentRow,
  ClientRow,
  EngagementBundle,
  EngagementRow,
} from '../lib/types';

const FIRM = 'demo-firm';
const ENG = 'demo-eng';

// Groups: use the firm-standard set, with id === code for demo simplicity.
const groups: AccountGroupRow[] = defaultAccountGroups().map((g) => ({
  id: g.code,
  firm_id: FIRM,
  code: g.code,
  name: g.name,
  type: g.type,
  sort_order: g.sortOrder,
}));

function acct(
  id: string,
  code: string,
  name: string,
  type: AccountRow['type'],
  groupId: string,
  unadjusted: number,
): AccountRow {
  return { id, firm_id: FIRM, engagement_id: ENG, code, name, type, group_id: groupId, unadjusted };
}

// Debit-positive unadjusted balances; the set nets to zero (a balanced TB).
const accounts: AccountRow[] = [
  acct('a-cash', '1000', 'Operating Cash', 'ASSET', 'CASH', 48_200),
  acct('a-ar', '1200', 'Accounts Receivable', 'ASSET', 'AR', 36_500),
  acct('a-inv', '1300', 'Inventory', 'ASSET', 'INV', 22_000),
  acct('a-prepaid', '1400', 'Prepaid Insurance', 'ASSET', 'PREPAID', 3_600),
  acct('a-equip', '1500', 'Equipment', 'ASSET', 'FIXED', 65_000),
  acct('a-accdep', '1510', 'Accumulated Depreciation', 'ASSET', 'ACCUMDEP', -18_000),
  acct('a-ap', '2000', 'Accounts Payable', 'LIABILITY', 'AP', -19_300),
  acct('a-accrued', '2100', 'Accrued Payroll', 'LIABILITY', 'ACCRUED', 0),
  acct('a-note', '2500', 'Note Payable — Bank', 'LIABILITY', 'NOTES', -40_000),
  acct('a-cap', '3000', "Owner's Capital", 'EQUITY', 'EQUITY', -30_000),
  acct('a-re', '3100', 'Retained Earnings', 'EQUITY', 'EQUITY', -19_300),
  acct('a-sales', '4000', 'Sales Revenue', 'INCOME', 'REVENUE', -285_000),
  acct('a-cogs', '5000', 'Cost of Goods Sold', 'COGS', 'COGS', 142_000),
  acct('a-salary', '6000', 'Salaries & Wages', 'EXPENSE', 'PAYROLL', 58_000),
  acct('a-rent', '6100', 'Rent Expense', 'EXPENSE', 'RENT', 24_000),
  acct('a-dep', '6200', 'Depreciation Expense', 'EXPENSE', 'DEPREXP', 0),
  acct('a-int', '6300', 'Interest Expense', 'EXPENSE', 'INTEREST', 2_400),
  acct('a-office', '6400', 'Office & Meals', 'EXPENSE', 'OTHEREXP', 9_900),
];

const adjustments: AdjustmentRow[] = [
  { id: 'adj-dep', engagement_id: ENG, reference: 'AJE-01', entry_date: '2025-12-31', memo: 'Record current-year depreciation', type: 'AJE', status: 'posted' },
  { id: 'adj-pay', engagement_id: ENG, reference: 'AJE-02', entry_date: '2025-12-31', memo: 'Accrue December payroll', type: 'AJE', status: 'posted' },
  { id: 'adj-rec', engagement_id: ENG, reference: 'RJE-01', entry_date: '2025-12-31', memo: 'Reclass rent misposted to office', type: 'RJE', status: 'posted' },
  { id: 'adj-tax', engagement_id: ENG, reference: 'TAX-01', entry_date: '2025-12-31', memo: 'Disallow 50% of meals (M-1)', type: 'TAX', status: 'posted' },
  { id: 'adj-prop', engagement_id: ENG, reference: 'AJE-03', entry_date: '2025-12-31', memo: 'Proposed: accrue utilities (pending review)', type: 'AJE', status: 'proposed' },
];

function line(id: string, adjustmentId: string, accountId: string, debit: number, credit: number): AdjustmentLineRow {
  return { id, adjustment_id: adjustmentId, account_id: accountId, debit, credit };
}

const lines: AdjustmentLineRow[] = [
  // AJE-01 depreciation
  line('l1', 'adj-dep', 'a-dep', 6_000, 0),
  line('l2', 'adj-dep', 'a-accdep', 0, 6_000),
  // AJE-02 payroll accrual
  line('l3', 'adj-pay', 'a-salary', 3_200, 0),
  line('l4', 'adj-pay', 'a-accrued', 0, 3_200),
  // RJE-01 reclass office -> rent
  line('l5', 'adj-rec', 'a-rent', 1_500, 0),
  line('l6', 'adj-rec', 'a-office', 0, 1_500),
  // TAX-01 disallow meals (reduces tax-basis expense; M-1 to equity)
  line('l7', 'adj-tax', 'a-office', 0, 900),
  line('l8', 'adj-tax', 'a-cap', 900, 0),
  // AJE-03 proposed (excluded from the TB until posted)
  line('l9', 'adj-prop', 'a-office', 1_100, 0),
  line('l10', 'adj-prop', 'a-ap', 0, 1_100),
];

const client: ClientRow = {
  id: 'demo-client',
  firm_id: FIRM,
  name: 'Northwind Trading Co.',
  entity_type: 'S-Corp',
};

const engagement: EngagementRow = {
  id: ENG,
  firm_id: FIRM,
  client_id: client.id,
  fiscal_year: 2025,
  period_end: '2025-12-31',
  entity_type: 'S-Corp',
  basis: 'Tax',
  status: 'open',
};

export const demoBundle: EngagementBundle = {
  engagement,
  client,
  groups,
  accounts,
  adjustments,
  lines,
};
