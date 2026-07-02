/**
 * Chart-of-Accounts standardization & grouping.
 *
 * A firm keeps a standard set of leadsheet **groups** (Cash, Accounts Receivable,
 * Fixed Assets, …). Every engagement's accounts map into those groups, which is
 * what drives leadsheets, grouping schedules, and (later) tax-line inheritance.
 * This module turns a flat WTB into a grouped, subtotaled structure and offers a
 * heuristic to suggest a group for an unmapped account.
 */

import { sumCents } from './money';
import {
  type AccountType,
  type WtbColumnTotals,
  type WtbRow,
} from './trialBalance';

export interface AccountGroup {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  sortOrder: number;
}

export interface GroupedLeadsheet {
  group: AccountGroup | null; // null bucket = ungrouped accounts
  rows: WtbRow[];
  subtotal: WtbColumnTotals;
}

function subtotalOf(rows: WtbRow[]): WtbColumnTotals {
  return {
    unadjusted: sumCents(rows.map((r) => r.unadjusted)),
    reclass: sumCents(rows.map((r) => r.reclass)),
    adjusting: sumCents(rows.map((r) => r.adjusting)),
    adjusted: sumCents(rows.map((r) => r.adjusted)),
    tax: sumCents(rows.map((r) => r.tax)),
    taxBasis: sumCents(rows.map((r) => r.taxBasis)),
  };
}

/** Organize WTB rows into leadsheet groups, each with a subtotal. Groups are
 * emitted in their `sortOrder`; any accounts without a mapped group land in a
 * trailing "Ungrouped" bucket so nothing is silently dropped. */
export function groupIntoLeadsheets(
  rows: WtbRow[],
  groups: AccountGroup[],
): GroupedLeadsheet[] {
  const byGroup = new Map<string, WtbRow[]>();
  const ungrouped: WtbRow[] = [];

  for (const row of rows) {
    const gid = row.account.groupId;
    if (gid == null) {
      ungrouped.push(row);
      continue;
    }
    const bucket = byGroup.get(gid);
    if (bucket) bucket.push(row);
    else byGroup.set(gid, [row]);
  }

  const ordered = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const result: GroupedLeadsheet[] = [];
  for (const group of ordered) {
    const groupRows = byGroup.get(group.id);
    if (!groupRows || groupRows.length === 0) continue;
    result.push({ group, rows: groupRows, subtotal: subtotalOf(groupRows) });
  }
  if (ungrouped.length > 0) {
    result.push({ group: null, rows: ungrouped, subtotal: subtotalOf(ungrouped) });
  }
  return result;
}

/** Count how many accounts still need a leadsheet group assigned. */
export function ungroupedCount(rows: WtbRow[]): number {
  return rows.filter((r) => r.account.groupId == null).length;
}

// ─── Standardization heuristics ───────────────────────────────────────────
// Keyword → group code. First match wins; order matters (specific before broad).
const KEYWORD_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bcash|checking|savings|money market\b/i, 'CASH'],
  [/receivable|\ba\/?r\b/i, 'AR'],
  [/inventor/i, 'INV'],
  [/prepaid/i, 'PREPAID'],
  [/deprec|accumulated deprec/i, 'ACCUMDEP'],
  [/land|building|equipment|furniture|fixture|vehicle|leasehold/i, 'FIXED'],
  // Specific liabilities before the generic "payable" catch-all, so
  // "Note Payable" maps to NOTES and "Wages Payable" to ACCRUED, not AP.
  [/note|loan|mortgage|line of credit/i, 'NOTES'],
  [/payroll|wages payable|accrued/i, 'ACCRUED'],
  [/\bpayable|\ba\/?p\b/i, 'AP'],
  [/capital|retained earnings|distribution|owner|member equity|common stock/i, 'EQUITY'],
  [/\bsales|revenue|income|fees earned\b/i, 'REVENUE'],
  [/cost of (goods|sales)|\bcogs\b/i, 'COGS'],
  [/salar|wage|payroll/i, 'PAYROLL'],
  [/rent/i, 'RENT'],
  [/interest/i, 'INTEREST'],
  [/deprec|amortiz/i, 'DEPREXP'],
];

/**
 * Suggest a standard group code for an account from its name/code and type.
 * Returns the group code (to be resolved against the firm's group list) or null
 * when nothing confidently matches.
 */
export function suggestGroupCode(
  name: string,
  code: string,
  type: AccountType,
): string | null {
  const haystack = `${name} ${code}`;
  for (const [pattern, groupCode] of KEYWORD_RULES) {
    if (pattern.test(haystack)) return groupCode;
  }
  // Fall back to a broad bucket by account type so nothing is left stranded.
  switch (type) {
    case 'ASSET':
      return 'OTHERASSET';
    case 'LIABILITY':
      return 'OTHERLIAB';
    case 'EQUITY':
      return 'EQUITY';
    case 'INCOME':
      return 'REVENUE';
    case 'COGS':
      return 'COGS';
    case 'EXPENSE':
      return 'OTHEREXP';
    default:
      return null;
  }
}

/** A default set of firm leadsheet groups, used to seed a new firm. Codes line
 * up with the heuristic above. */
export function defaultAccountGroups(): Omit<AccountGroup, 'id'>[] {
  const g = (
    code: string,
    name: string,
    type: AccountType,
    sortOrder: number,
  ): Omit<AccountGroup, 'id'> => ({ code, name, type, sortOrder });
  return [
    g('CASH', 'Cash & Cash Equivalents', 'ASSET', 10),
    g('AR', 'Accounts Receivable', 'ASSET', 20),
    g('INV', 'Inventory', 'ASSET', 30),
    g('PREPAID', 'Prepaid Expenses', 'ASSET', 40),
    g('FIXED', 'Property & Equipment', 'ASSET', 50),
    g('ACCUMDEP', 'Accumulated Depreciation', 'ASSET', 55),
    g('OTHERASSET', 'Other Assets', 'ASSET', 60),
    g('AP', 'Accounts Payable', 'LIABILITY', 110),
    g('ACCRUED', 'Accrued Liabilities', 'LIABILITY', 120),
    g('NOTES', 'Notes & Loans Payable', 'LIABILITY', 130),
    g('OTHERLIAB', 'Other Liabilities', 'LIABILITY', 140),
    g('EQUITY', 'Equity', 'EQUITY', 200),
    g('REVENUE', 'Revenue', 'INCOME', 300),
    g('COGS', 'Cost of Goods Sold', 'COGS', 400),
    g('PAYROLL', 'Salaries & Payroll', 'EXPENSE', 500),
    g('RENT', 'Rent & Occupancy', 'EXPENSE', 510),
    g('INTEREST', 'Interest Expense', 'EXPENSE', 520),
    g('DEPREXP', 'Depreciation & Amortization', 'EXPENSE', 530),
    g('OTHEREXP', 'Other Operating Expenses', 'EXPENSE', 540),
  ];
}
