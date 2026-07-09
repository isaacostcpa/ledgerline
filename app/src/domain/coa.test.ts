import { describe, expect, it } from 'vitest';
import {
  defaultAccountGroups,
  groupIntoLeadsheets,
  suggestGroupCode,
  ungroupedCount,
} from './coa';
import type { WtbRow } from './trialBalance';

describe('suggestGroupCode', () => {
  it('maps common accounts to the right leadsheet group', () => {
    expect(suggestGroupCode('Operating Cash', '1000', 'ASSET')).toBe('CASH');
    expect(suggestGroupCode('Accounts Receivable', '1200', 'ASSET')).toBe('AR');
    expect(suggestGroupCode('Accounts Payable', '2000', 'LIABILITY')).toBe('AP');
    expect(suggestGroupCode('Sales Revenue', '4000', 'INCOME')).toBe('REVENUE');
    expect(suggestGroupCode('Rent Expense', '6100', 'EXPENSE')).toBe('RENT');
  });

  it('routes specific liabilities before the generic payable rule', () => {
    // Regression: "Note Payable" must not be captured by the AP "payable" rule.
    expect(suggestGroupCode('Note Payable - Bank', '2500', 'LIABILITY')).toBe('NOTES');
    expect(suggestGroupCode('Mortgage Payable', '2600', 'LIABILITY')).toBe('NOTES');
    expect(suggestGroupCode('Wages Payable', '2100', 'LIABILITY')).toBe('ACCRUED');
  });

  it('falls back to a type bucket when nothing matches', () => {
    expect(suggestGroupCode('Miscellaneous', '', 'ASSET')).toBe('OTHERASSET');
    expect(suggestGroupCode('Miscellaneous', '', 'EXPENSE')).toBe('OTHEREXP');
    expect(suggestGroupCode('Miscellaneous', '', 'OTHER')).toBeNull();
  });

  it('every suggestion resolves to a real default group (or a type bucket)', () => {
    const codes = new Set(defaultAccountGroups().map((g) => g.code));
    for (const name of ['Cash', 'Inventory', 'Note Payable', 'Sales', 'Depreciation Expense']) {
      const code = suggestGroupCode(name, '', 'OTHER');
      if (code) expect(codes.has(code)).toBe(true);
    }
  });
});

describe('groupIntoLeadsheets', () => {
  const groups = defaultAccountGroups().map((g, i) => ({ id: `g${i}`, ...g }));
  const cashGroup = groups.find((g) => g.code === 'CASH')!;

  const row = (id: string, groupId: string | null, unadjusted: number): WtbRow => ({
    account: { id, code: id, name: id, type: 'ASSET', groupId, unadjusted: 0 },
    unadjusted,
    reclass: 0,
    adjusting: 0,
    adjusted: unadjusted,
    tax: 0,
    taxBasis: unadjusted,
  });

  it('buckets rows by group with subtotals and a trailing ungrouped block', () => {
    const rows = [
      row('a', cashGroup.id, 100),
      row('b', cashGroup.id, 250),
      row('c', null, 50),
    ];
    const ls = groupIntoLeadsheets(rows, groups);
    expect(ls[0]!.group?.code).toBe('CASH');
    expect(ls[0]!.subtotal.unadjusted).toBe(350);
    expect(ls[ls.length - 1]!.group).toBeNull(); // ungrouped bucket last
    expect(ungroupedCount(rows)).toBe(1);
  });
});
