/**
 * The Working Trial Balance engine.
 *
 * Given a chart of accounts (each with an unadjusted balance) and a set of
 * adjustment lines classified by entry type, this produces the multi-column
 * working trial balance every professional package builds on:
 *
 *   Unadjusted → Reclassifying → Adjusting → Adjusted → Tax → Tax Basis
 *
 * All math is done on integer cents (see money.ts). Debits are positive,
 * credits negative, throughout.
 */

import { type Cents, netFromDrCr, sumCents } from './money';

/** Balance-sheet vs income-statement classification used for grouping/reporting. */
export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'INCOME'
  | 'COGS'
  | 'EXPENSE'
  | 'OTHER';

/** The four kinds of adjustment. Reclass and Adjusting affect the report basis;
 * Tax (and book-to-tax) adjustments only affect the tax-basis column. */
export type EntryType = 'RJE' | 'AJE' | 'TAX' | 'BOOK';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  /** Leadsheet grouping id, e.g. the "Cash" or "Fixed Assets" group. */
  groupId: string | null;
  /** Unadjusted balance in dollars, debit-positive. */
  unadjusted: number;
}

export interface AdjustmentLine {
  accountId: string;
  entryType: EntryType;
  /** Only posted lines flow into the trial balance; proposed lines are excluded. */
  posted: boolean;
  debit: number; // dollars
  credit: number; // dollars
}

/** One account's fully-computed row across every WTB column, in cents. */
export interface WtbRow {
  account: Account;
  unadjusted: Cents;
  reclass: Cents; // sum of posted RJE lines
  adjusting: Cents; // sum of posted AJE lines
  adjusted: Cents; // unadjusted + reclass + adjusting  (report basis)
  tax: Cents; // sum of posted TAX + BOOK lines
  taxBasis: Cents; // adjusted + tax
}

export interface WtbColumnTotals {
  unadjusted: Cents;
  reclass: Cents;
  adjusting: Cents;
  adjusted: Cents;
  tax: Cents;
  taxBasis: Cents;
}

export interface WorkingTrialBalance {
  rows: WtbRow[];
  totals: WtbColumnTotals;
  /** A trial balance is in balance when every column nets to zero. Any non-zero
   * value here flags an out-of-balance condition the preparer must resolve. */
  outOfBalance: WtbColumnTotals;
}

const COLUMN_FOR: Record<EntryType, 'reclass' | 'adjusting' | 'tax'> = {
  RJE: 'reclass',
  AJE: 'adjusting',
  TAX: 'tax',
  BOOK: 'tax',
};

/** Compute the full multi-column working trial balance. */
export function buildWorkingTrialBalance(
  accounts: Account[],
  lines: AdjustmentLine[],
): WorkingTrialBalance {
  // Bucket posted adjustment amounts by account and target column.
  const byAccount = new Map<string, { reclass: Cents; adjusting: Cents; tax: Cents }>();
  for (const line of lines) {
    if (!line.posted) continue;
    const col = COLUMN_FOR[line.entryType];
    let bucket = byAccount.get(line.accountId);
    if (!bucket) {
      bucket = { reclass: 0, adjusting: 0, tax: 0 };
      byAccount.set(line.accountId, bucket);
    }
    bucket[col] += netFromDrCr(line.debit, line.credit);
  }

  const rows: WtbRow[] = accounts.map((account) => {
    const adj = byAccount.get(account.id) ?? { reclass: 0, adjusting: 0, tax: 0 };
    const unadjusted = netFromDrCr(account.unadjusted, 0);
    const adjusted = unadjusted + adj.reclass + adj.adjusting;
    const taxBasis = adjusted + adj.tax;
    return {
      account,
      unadjusted,
      reclass: adj.reclass,
      adjusting: adj.adjusting,
      adjusted,
      tax: adj.tax,
      taxBasis,
    };
  });

  const totals: WtbColumnTotals = {
    unadjusted: sumCents(rows.map((r) => r.unadjusted)),
    reclass: sumCents(rows.map((r) => r.reclass)),
    adjusting: sumCents(rows.map((r) => r.adjusting)),
    adjusted: sumCents(rows.map((r) => r.adjusted)),
    tax: sumCents(rows.map((r) => r.tax)),
    taxBasis: sumCents(rows.map((r) => r.taxBasis)),
  };

  // In a balanced TB every column sums to zero; the totals ARE the out-of-balance.
  return { rows, totals, outOfBalance: totals };
}

/** True when every column of the working trial balance nets to zero. */
export function isInBalance(wtb: WorkingTrialBalance): boolean {
  return Object.values(wtb.outOfBalance).every((c) => c === 0);
}
