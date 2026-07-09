import { describe, expect, it } from 'vitest';
import {
  type Account,
  type AdjustmentLine,
  buildWorkingTrialBalance,
  isInBalance,
} from './trialBalance';

const accounts: Account[] = [
  { id: 'cash', code: '1000', name: 'Cash', type: 'ASSET', groupId: 'CASH', unadjusted: 50000 },
  { id: 'ar', code: '1200', name: 'Accounts Receivable', type: 'ASSET', groupId: 'AR', unadjusted: 30000 },
  { id: 'ap', code: '2000', name: 'Accounts Payable', type: 'LIABILITY', groupId: 'AP', unadjusted: -20000 },
  { id: 'equity', code: '3000', name: 'Owner Equity', type: 'EQUITY', groupId: 'EQUITY', unadjusted: -40000 },
  { id: 'rev', code: '4000', name: 'Sales', type: 'INCOME', groupId: 'REVENUE', unadjusted: -100000 },
  { id: 'rent', code: '6000', name: 'Rent Expense', type: 'EXPENSE', groupId: 'RENT', unadjusted: 80000 },
];

describe('buildWorkingTrialBalance', () => {
  it('carries unadjusted balances and stays in balance with no adjustments', () => {
    const wtb = buildWorkingTrialBalance(accounts, []);
    expect(wtb.totals.unadjusted).toBe(0); // trial balance ties out
    expect(isInBalance(wtb)).toBe(true);
    const cash = wtb.rows.find((r) => r.account.id === 'cash')!;
    expect(cash.unadjusted).toBe(5_000_000); // $50,000 in cents
    expect(cash.adjusted).toBe(5_000_000);
    expect(cash.taxBasis).toBe(5_000_000);
  });

  it('routes each entry type to its own column and rolls forward', () => {
    // Book AJE: accrue $2,000 of rent (Dr Rent / Cr AP).
    const lines: AdjustmentLine[] = [
      { accountId: 'rent', entryType: 'AJE', posted: true, debit: 2000, credit: 0 },
      { accountId: 'ap', entryType: 'AJE', posted: true, debit: 0, credit: 2000 },
    ];
    const wtb = buildWorkingTrialBalance(accounts, lines);
    const rent = wtb.rows.find((r) => r.account.id === 'rent')!;
    expect(rent.adjusting).toBe(200_000);
    expect(rent.adjusted).toBe(8_200_000); // 80,000 + 2,000
    expect(rent.reclass).toBe(0);
    expect(rent.tax).toBe(0);
    expect(rent.taxBasis).toBe(8_200_000);
    // Adjusting column of a balanced entry nets to zero across all accounts.
    expect(wtb.totals.adjusting).toBe(0);
    expect(isInBalance(wtb)).toBe(true);
  });

  it('keeps tax adjustments out of the adjusted (report) column', () => {
    // Tax-only: disallow $1,000 of the rent as a book-to-tax difference.
    const lines: AdjustmentLine[] = [
      { accountId: 'rent', entryType: 'TAX', posted: true, debit: 0, credit: 1000 },
      { accountId: 'equity', entryType: 'TAX', posted: true, debit: 1000, credit: 0 },
    ];
    const wtb = buildWorkingTrialBalance(accounts, lines);
    const rent = wtb.rows.find((r) => r.account.id === 'rent')!;
    expect(rent.adjusted).toBe(8_000_000); // report basis unchanged
    expect(rent.tax).toBe(-100_000);
    expect(rent.taxBasis).toBe(7_900_000); // tax basis reduced by $1,000
  });

  it('reclass entries move between accounts without touching net income', () => {
    const lines: AdjustmentLine[] = [
      { accountId: 'cash', entryType: 'RJE', posted: true, debit: 0, credit: 5000 },
      { accountId: 'ar', entryType: 'RJE', posted: true, debit: 5000, credit: 0 },
    ];
    const wtb = buildWorkingTrialBalance(accounts, lines);
    expect(wtb.rows.find((r) => r.account.id === 'cash')!.reclass).toBe(-500_000);
    expect(wtb.rows.find((r) => r.account.id === 'ar')!.reclass).toBe(500_000);
    expect(wtb.totals.reclass).toBe(0);
  });

  it('excludes proposed (unposted) lines from every column', () => {
    const lines: AdjustmentLine[] = [
      { accountId: 'rent', entryType: 'AJE', posted: false, debit: 9999, credit: 0 },
    ];
    const wtb = buildWorkingTrialBalance(accounts, lines);
    expect(wtb.rows.find((r) => r.account.id === 'rent')!.adjusting).toBe(0);
  });

  it('flags an out-of-balance condition when an entry is lopsided', () => {
    const lines: AdjustmentLine[] = [
      { accountId: 'rent', entryType: 'AJE', posted: true, debit: 2000, credit: 0 },
      // missing the offsetting credit — books do not balance
    ];
    const wtb = buildWorkingTrialBalance(accounts, lines);
    expect(isInBalance(wtb)).toBe(false);
    expect(wtb.outOfBalance.adjusting).toBe(200_000);
    expect(wtb.outOfBalance.adjusted).toBe(200_000);
    expect(wtb.outOfBalance.taxBasis).toBe(200_000);
  });
});
