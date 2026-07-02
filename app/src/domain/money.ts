/**
 * Money handling for Ledgerline.
 *
 * Financial software must never accumulate binary floating-point error, so all
 * arithmetic happens on integer **cents**. Balances enter as dollar numbers
 * (from imports or the database `numeric` type), are converted to cents for any
 * computation, and are only turned back into dollars/strings for display.
 */

export type Cents = number; // integer number of cents
export type Dollars = number; // e.g. 1234.56

/** Convert a dollar amount to integer cents, rounding half-away-from-zero.
 *
 * IEEE-754 stores many exact decimals slightly low (`1.005` is really
 * `1.00499999…`), so a naive `Math.round(dollars * 100)` would round `1.005`
 * down to `100`. We add a magnitude-relative epsilon before rounding: large
 * enough to absorb binary-representation error, far too small to flip any value
 * that genuinely belongs on the lower side. */
export function toCents(dollars: Dollars | null | undefined): Cents {
  if (dollars == null || Number.isNaN(dollars)) return 0;
  const sign = dollars < 0 ? -1 : 1;
  const scaled = Math.abs(dollars) * 100;
  const nudge = 1e-9 * Math.max(1, scaled);
  return sign * Math.round(scaled + nudge);
}

/** Convert integer cents back to a dollar number. */
export function toDollars(cents: Cents): Dollars {
  return cents / 100;
}

/** Sum a list of cent amounts. Safe because every operand is an integer. */
export function sumCents(values: Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** A debit/credit pair, in dollars, collapsed to a single signed cents value
 * where debits are positive and credits are negative. */
export function netFromDrCr(
  debit: Dollars | null | undefined,
  credit: Dollars | null | undefined,
): Cents {
  return toCents(debit) - toCents(credit);
}

/** Split a signed cents balance back into debit/credit columns (dollars). */
export function drCrFromNet(net: Cents): { debit: Dollars; credit: Dollars } {
  return net >= 0
    ? { debit: toDollars(net), credit: 0 }
    : { debit: 0, credit: toDollars(-net) };
}

const USD = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format signed cents as an accounting-style figure. Zero renders as an em dash;
 * negatives render in parentheses. */
export function formatCents(cents: Cents): string {
  if (cents === 0) return '—';
  const abs = USD.format(Math.abs(cents) / 100);
  return cents < 0 ? `(${abs})` : abs;
}

/** Plain signed number string (no parentheses) — for export files. */
export function toFixedDollars(cents: Cents): string {
  return (cents / 100).toFixed(2);
}
