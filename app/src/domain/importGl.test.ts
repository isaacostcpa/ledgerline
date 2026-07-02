import { describe, expect, it } from 'vitest';
import {
  cleanNumber,
  detectAndMap,
  findColumn,
  importedToUnadjusted,
  inferType,
} from './importGl';

describe('cleanNumber', () => {
  it('strips currency formatting', () => {
    expect(cleanNumber('$1,234.56')).toBe(1234.56);
    expect(cleanNumber('  2,000 ')).toBe(2000);
    expect(cleanNumber('')).toBe(0);
    expect(cleanNumber(null)).toBe(0);
    expect(cleanNumber('n/a')).toBe(0);
  });

  it('treats parentheses as negative (the prototype bug this fixes)', () => {
    expect(cleanNumber('(500)')).toBe(-500);
    expect(cleanNumber('($1,200.00)')).toBe(-1200);
    expect(cleanNumber('-750')).toBe(-750);
  });
});

describe('inferType', () => {
  it('classifies by account-number range first', () => {
    expect(inferType('1000', 'Whatever')).toBe('ASSET');
    expect(inferType('2500', 'Whatever')).toBe('LIABILITY');
    expect(inferType('3100', 'Whatever')).toBe('EQUITY');
    expect(inferType('4000', 'Whatever')).toBe('INCOME');
    expect(inferType('5000', 'Whatever')).toBe('COGS');
    expect(inferType('6200', 'Whatever')).toBe('EXPENSE');
  });

  it('falls back to keywords when there is no code', () => {
    expect(inferType('', 'Operating Cash')).toBe('ASSET');
    expect(inferType('', 'Accounts Payable')).toBe('LIABILITY');
    expect(inferType('', 'Retained Earnings')).toBe('EQUITY');
    expect(inferType('', 'Sales Revenue')).toBe('INCOME');
    expect(inferType('', 'Cost of Goods Sold')).toBe('COGS');
    expect(inferType('', 'Rent Expense')).toBe('EXPENSE');
    expect(inferType('', 'Mystery Line')).toBe('OTHER');
  });
});

describe('findColumn', () => {
  it('matches header aliases exactly and partially', () => {
    const headers = ['Account #', 'Account Name', 'Debit Amount', 'Credit Amount'];
    expect(findColumn(headers, 'code')).toBe('Account #');
    expect(findColumn(headers, 'name')).toBe('Account Name');
    expect(findColumn(headers, 'debit')).toBe('Debit Amount');
    expect(findColumn(headers, 'credit')).toBe('Credit Amount');
  });
});

describe('detectAndMap — debit/credit trial balance', () => {
  const rows = [
    { 'Account #': '1000', 'Account Name': 'Cash', Debit: '10,000', Credit: '' },
    { 'Account #': '2000', 'Account Name': 'Accounts Payable', Debit: '', Credit: '4,000' },
    { 'Account #': '4000', 'Account Name': 'Sales', Debit: '', Credit: '6,000' },
    { 'Account #': '', 'Account Name': 'Total', Debit: '10,000', Credit: '10,000' },
  ];

  it('detects the format, drops the total row, and ties out', () => {
    const r = detectAndMap(rows);
    expect(r.format).toBe('Trial Balance (Debit / Credit)');
    expect(r.accounts).toHaveLength(3); // "Total" excluded
    expect(r.outOfBalance).toBe(0);
    expect(r.warnings).toHaveLength(0);
    const cash = r.accounts.find((a) => a.code === '1000')!;
    expect(cash.debit).toBe(10000);
    expect(cash.type).toBe('ASSET');
    expect(importedToUnadjusted(cash)).toBe(10000);
    const ap = r.accounts.find((a) => a.code === '2000')!;
    expect(importedToUnadjusted(ap)).toBe(-4000); // credit → negative net
  });
});

describe('detectAndMap — net-balance trial balance with sign inference', () => {
  it('splits a signed balance into DR/CR by normal balance side', () => {
    const rows = [
      { Code: '1000', Name: 'Cash', Balance: '10,000' },
      { Code: '4000', Name: 'Sales', Balance: '(6,000)' }, // credit balance shown negative
      { Code: '6000', Name: 'Rent Expense', Balance: '4,000' },
    ];
    const r = detectAndMap(rows);
    expect(r.format).toBe('Trial Balance (Net Balance)');
    const sales = r.accounts.find((a) => a.code === '4000')!;
    expect(sales.credit).toBe(6000);
    expect(sales.debit).toBe(0);
    const cash = r.accounts.find((a) => a.code === '1000')!;
    expect(cash.debit).toBe(10000);
  });
});

describe('detectAndMap — detailed general ledger aggregation', () => {
  it('sums transaction lines per account', () => {
    const rows = [
      { Date: '2025-01-05', Account: 'Cash', Debit: '1,000', Credit: '' },
      { Date: '2025-01-09', Account: 'Cash', Debit: '500', Credit: '' },
      { Date: '2025-01-12', Account: 'Cash', Debit: '', Credit: '300' },
      { Date: '2025-01-31', Account: 'Sales', Debit: '', Credit: '1,200' },
    ];
    const r = detectAndMap(rows);
    expect(r.format).toBe('Detailed General Ledger');
    const cash = r.accounts.find((a) => a.name === 'Cash')!;
    expect(cash.debit).toBe(1500);
    expect(cash.credit).toBe(300);
    expect(importedToUnadjusted(cash)).toBe(1200);
  });
});

describe('detectAndMap — QuickBooks sub-account notation', () => {
  it('pulls the child name and code from "Parent:Sub" plus a subname column', () => {
    const rows = [
      { 'Account Name': 'Vehicles:1510', 'Sub-Account Name': 'Delivery Truck', Debit: '25,000', Credit: '' },
    ];
    const r = detectAndMap(rows);
    const acct = r.accounts[0]!;
    expect(acct.name).toBe('Delivery Truck');
    expect(acct.code).toBe('1510');
  });
});

describe('detectAndMap — edge cases', () => {
  it('returns Empty for no rows', () => {
    expect(detectAndMap([]).format).toBe('Empty');
  });

  it('flags an out-of-balance import', () => {
    const rows = [
      { Code: '1000', Name: 'Cash', Debit: '10,000', Credit: '' },
      { Code: '2000', Name: 'Payable', Debit: '', Credit: '3,000' },
    ];
    const r = detectAndMap(rows);
    expect(r.outOfBalance).toBe(7000);
    expect(r.warnings.some((w) => /out of balance/i.test(w))).toBe(true);
  });
});
