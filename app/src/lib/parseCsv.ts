/**
 * CSV/text parsing for the import panel. The GL/TB detection itself lives in
 * `domain/importGl.ts`; this layer only turns a file or pasted text into rows,
 * skipping the title/preamble lines that exports (QuickBooks, etc.) put above
 * the real header.
 */
import Papa from 'papaparse';
import type { RawRow } from '../domain/importGl';

// Flat list of every header word we know about, for preamble detection.
const HEADER_WORDS = [
  'code', 'acct', 'account', 'number', 'name', 'description', 'type',
  'debit', 'dr', 'credit', 'cr', 'balance', 'net', 'amount', 'total',
  'date', 'memo', 'class', 'sub-account',
];

/** A line looks like the header when at least two cells match known columns. */
function looksLikeHeader(line: string): boolean {
  const cells = line.split(',').map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ''));
  const hits = cells.filter(
    (c) => c && HEADER_WORDS.some((w) => c === w || (c.length > 2 && (c.includes(w) || w.includes(c)))),
  ).length;
  return hits >= 2;
}

/** Drop any preamble lines above the first header-looking row. */
export function stripPreamble(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    if (looksLikeHeader(lines[i] as string)) {
      return i > 0 ? lines.slice(i).join('\n') : text;
    }
  }
  return text;
}

/** Parse CSV text into rows keyed by header. */
export function parseCsvText(text: string): RawRow[] {
  const cleaned = stripPreamble(text);
  const result = Papa.parse<RawRow>(cleaned, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  return (result.data ?? []).filter((r) => r && typeof r === 'object');
}

/** Parse CSV text into a positional matrix of string cells (no header keying).
 * Needed for layouts where structure is positional — notably the QuickBooks
 * General Ledger report, whose account names sit in an unlabeled first column. */
export function parseCsvMatrix(text: string): string[][] {
  const cleaned = stripPreamble(text);
  const result = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: 'greedy',
  });
  return (result.data ?? []).map((row) => (Array.isArray(row) ? row.map((c) => (c ?? '').toString()) : []));
}
