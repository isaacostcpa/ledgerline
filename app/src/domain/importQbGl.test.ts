import { describe, expect, it } from 'vitest';
import {
  importMatrix,
  isQuickBooksGeneralLedger,
  parseQuickBooksGeneralLedger,
} from './importGl';
import { parseCsvMatrix } from '../lib/parseCsv';

// A miniature QuickBooks General Ledger export that reproduces the tricky parts:
// account names in the unlabeled first column, payees in the Name column, a
// beginning-balance-only account, and a nested parent/sub-account with a
// rolled-up parent total.
const QB_GL = `,Type,Date,Num,Name,Memo,Class,Clr,Split,Debit,Credit,Balance
Brokerage Account,,,,,,,,,,,250000.00
,Check,04/01/2025,,Chase,memo,,,Chase Checking,5000.00,,255000.00
,Deposit,05/28/2025,,Chase,memo,,,Chase Checking,,35000.00,220000.00
Total Brokerage Account,,,,,,,,,5000.00,35000.00,220000.00
Office Security Deposit,,,,,,,,,,,250.00
Total Office Security Deposit,,,,,,,,,,,250.00
Accounts Payable,,,,,,,,,,,-2200.00
Total Accounts Payable,,,,,,,,,,,-2200.00
Amex 71002,,,,,,,,,,,0.00
Amex 71002,,,,,,,,,,,0.00
,Credit Card Charge,01/03/2025,,AHC,memo,,,Supplies,100.00,,100.00
Total Amex 71002,,,,,,,,,100.00,0.00,100.00
Amex 71002 - Other,,,,,,,,,,,0.00
,Check,01/28/2025,,AMEX,memo,,,Chase Checking,,300.00,-300.00
Total Amex 71002 - Other,,,,,,,,,0.00,300.00,-300.00
Total Amex 71002,,,,,,,,,100.00,300.00,-200.00
Sales,,,,,,,,,,,0.00
,Invoice,03/01/2025,,Cust,memo,,,AR,,217850.00,-217850.00
Total Sales,,,,,,,,,0.00,217850.00,-217850.00
TOTAL,,,,,,,,,5200.00,253450.00,0.00`;

describe('QuickBooks General Ledger parser', () => {
  const matrix = parseCsvMatrix(QB_GL);

  it('is detected by its positional signature', () => {
    expect(isQuickBooksGeneralLedger(matrix)).toBe(true);
    expect(importMatrix(matrix).format).toBe('QuickBooks General Ledger');
  });

  it('reads accounts from the first column, not the payee/Name column', () => {
    const r = parseQuickBooksGeneralLedger(matrix);
    const names = r.accounts.map((a) => a.name);
    expect(names).toContain('Brokerage Account');
    expect(names).toContain('Accounts Payable');
    expect(names).toContain('Sales');
    // Payees must NOT become accounts.
    expect(names).not.toContain('Chase');
    expect(names).not.toContain('AMEX');
    expect(names).not.toContain('Cust');
  });

  it('takes each account ending balance from its Total row', () => {
    const r = parseQuickBooksGeneralLedger(matrix);
    const by = (n: string) => r.accounts.find((a) => a.name === n)!;
    expect(by('Brokerage Account').debit).toBe(220000);
    expect(by('Office Security Deposit').debit).toBe(250); // beginning-balance-only account kept
    expect(by('Accounts Payable').credit).toBe(2200); // credit balance
    expect(by('Sales').credit).toBe(217850);
  });

  it('keeps leaf sub-accounts and drops the rolled-up parent total (no double count)', () => {
    const r = parseQuickBooksGeneralLedger(matrix);
    const amexLeaves = r.accounts.filter((a) => a.name.startsWith('Amex 71002'));
    // The parent's own section (100) and the "- Other" child (-300) are leaves;
    // the outer rollup (-200) must not be added on top.
    expect(amexLeaves.map((a) => a.name).sort()).toEqual(['Amex 71002', 'Amex 71002 - Other']);
    const net = amexLeaves.reduce((s, a) => s + a.debit - a.credit, 0);
    expect(net).toBe(-200);
  });

  it('ties out to zero, matching the report grand total', () => {
    const r = parseQuickBooksGeneralLedger(matrix);
    expect(r.outOfBalance).toBe(0);
    expect(r.warnings).toHaveLength(0);
  });
});
