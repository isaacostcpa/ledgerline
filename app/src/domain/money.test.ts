import { describe, expect, it } from 'vitest';
import {
  drCrFromNet,
  formatCents,
  netFromDrCr,
  sumCents,
  toCents,
  toDollars,
  toFixedDollars,
} from './money';

describe('toCents', () => {
  it('converts whole and fractional dollars without float drift', () => {
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0.2)).toBe(20);
    // The classic 0.1 + 0.2 !== 0.3 trap — must not leak into cents.
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
  });

  it('rounds half away from zero symmetrically', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(-1.005)).toBe(-101);
    expect(toCents(2.675)).toBe(268);
  });

  it('treats null/undefined/NaN as zero', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents(NaN)).toBe(0);
  });
});

describe('sumCents', () => {
  it('sums a long list exactly', () => {
    const pennies = Array.from({ length: 10000 }, () => 1);
    expect(sumCents(pennies)).toBe(10000);
  });
});

describe('netFromDrCr / drCrFromNet', () => {
  it('collapses debit/credit to a signed net and back', () => {
    expect(netFromDrCr(500, 0)).toBe(50000);
    expect(netFromDrCr(0, 500)).toBe(-50000);
    expect(netFromDrCr(300, 100)).toBe(20000);
    expect(drCrFromNet(50000)).toEqual({ debit: 500, credit: 0 });
    expect(drCrFromNet(-50000)).toEqual({ debit: 0, credit: 500 });
  });
});

describe('formatCents', () => {
  it('renders accounting figures with parentheses and em dash', () => {
    expect(formatCents(123456)).toBe('1,234.56');
    expect(formatCents(-123456)).toBe('(1,234.56)');
    expect(formatCents(0)).toBe('—');
  });
});

describe('round-trip', () => {
  it('toDollars(toCents(x)) preserves 2-decimal money', () => {
    for (const x of [0, 0.01, 99.99, 1000000.5, -42.42]) {
      expect(toDollars(toCents(x))).toBeCloseTo(x, 2);
    }
  });

  it('toFixedDollars formats for export', () => {
    expect(toFixedDollars(123456)).toBe('1234.56');
    expect(toFixedDollars(-5)).toBe('-0.05');
  });
});
