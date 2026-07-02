/**
 * Universal GL / Trial Balance import engine.
 *
 * Ported from the v0 prototype's importer and hardened. Given already-parsed
 * rows (the CSV/Excel parsing lives in the UI), it auto-detects the layout —
 * detailed general ledger, debit/credit trial balance, net-balance trial
 * balance, or an unknown numeric grid — and produces a normalized account list.
 *
 * Pure and deterministic, so the detection logic is fully unit-tested.
 */
import { toCents, toDollars } from './money';
import type { AccountType } from './trialBalance';

export type RawCell = string | number | null | undefined;
export type RawRow = Record<string, RawCell>;

export interface ImportedAccount {
  code: string;
  name: string;
  type: AccountType;
  debit: number; // dollars, magnitude
  credit: number; // dollars, magnitude
}

export type ImportFormat =
  | 'Detailed General Ledger'
  | 'Trial Balance (Debit / Credit)'
  | 'Trial Balance (Net Balance)'
  | 'Auto-detected'
  | 'Empty';

export interface ImportResult {
  format: ImportFormat;
  accounts: ImportedAccount[];
  columns: Partial<Record<ImportField, string>>;
  /** Net debits − credits across all imported accounts, in dollars. Non-zero
   * means the imported trial balance does not tie out. */
  outOfBalance: number;
  warnings: string[];
}

type ImportField =
  | 'code'
  | 'name'
  | 'subname'
  | 'type'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'dcflag'
  | 'date';

const ALIASES: Record<ImportField, string[]> = {
  code: ['code', 'acct', 'account_code', 'account code', 'acct#', 'account #', 'account#', 'acct #', 'gl #', 'gl#', 'account number', 'account_number', 'gl_code', 'gl code', 'acct no', 'number', 'num', 'no', 'account no'],
  name: ['name', 'account', 'account_name', 'account name', 'description', 'desc', 'account_description', 'title', 'account title', 'gl account'],
  subname: ['sub-account name', 'sub account name', 'subaccount name', 'sub-acct name', 'sub_account_name'],
  type: ['type', 'account_type', 'account type', 'acct_type', 'acct type', 'classification', 'category'],
  debit: ['debit', 'dr', 'dr.', 'debit_balance', 'debit balance', 'debits', 'ending_debit', 'ending debit', 'balance_debit', 'balance dr', 'total debit', 'debit total', 'debit amount', 'total_debit'],
  credit: ['credit', 'cr', 'cr.', 'credit_balance', 'credit balance', 'credits', 'ending_credit', 'ending credit', 'balance_credit', 'balance cr', 'total credit', 'credit total', 'credit amount', 'total_credit'],
  balance: ['balance', 'net_balance', 'net balance', 'net', 'amount', 'ending_balance', 'ending balance', 'total', 'ytd balance', 'period balance'],
  dcflag: ['dc', 'd/c', 'debit/credit', 'dr/cr', 'normal_balance', 'normal balance', 'dr cr'],
  date: ['date', 'transaction date', 'trans date', 'trans_date', 'post date', 'posting date', 'entry date', 'tran date'],
};

const VALID_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE', 'OTHER'];

const TOTAL_ROW = /^(grand )?total|^subtotal|^balance/i;

/** Find the header that best matches a field: an exact normalized match first,
 * then a partial fallback where the header *contains* an alias. We deliberately
 * do not match when an alias merely contains the header — that let a plain
 * "Balance" header hijack the debit column via the alias "balance dr". The
 * length guard keeps 2-letter aliases (dr, cr, no) to the exact pass only. */
export function findColumn(headers: string[], field: ImportField): string | null {
  const aliases = ALIASES[field];
  for (const h of headers) {
    const norm = h.toLowerCase().trim().replace(/[\s_]+/g, ' ');
    if (aliases.includes(norm)) return h;
  }
  for (const h of headers) {
    const norm = h.toLowerCase().trim();
    if (aliases.some((a) => a.length >= 3 && norm.includes(a))) return h;
  }
  return null;
}

/** Parse a messy money cell to a signed dollar number. Handles `$`, thousands
 * separators, and — unlike the prototype — parenthesized negatives `(1,200)`. */
export function cleanNumber(v: RawCell): number {
  if (v == null) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-') || raw.startsWith('−');
  const digits = raw.replace(/[()$,\s−-]/g, '');
  const n = Number.parseFloat(digits);
  if (Number.isNaN(n)) return 0;
  const cents = toCents(negative ? -n : n);
  return toDollars(cents);
}

/** Infer an account type from its code range, then keyword fallbacks. */
export function inferType(code: string, name: string): AccountType {
  const num = Number.parseInt((code || '').replace(/\D/g, '').substring(0, 4), 10) || 0;
  const nm = (name || '').toLowerCase();
  if (num >= 1000 && num < 2000) return 'ASSET';
  if (num >= 2000 && num < 3000) return 'LIABILITY';
  if (num >= 3000 && num < 4000) return 'EQUITY';
  if (num >= 4000 && num < 5000) return 'INCOME';
  if (num >= 5000 && num < 6000) return 'COGS';
  if (num >= 6000 && num < 9000) return 'EXPENSE';
  if (/cash|bank|receiv|invent|prepaid|equipment|vehicle|property|deposit|asset|investment|securities|due from/.test(nm)) return 'ASSET';
  if (/payable|loan|mortgage|accrued|liability|note payable|deferred revenue|due to|line of credit|debt/.test(nm)) return 'LIABILITY';
  if (/equity|capital|retained|owner|draw|stock|member|contributed|distribution/.test(nm)) return 'EQUITY';
  if (/revenue|sales|income|service fee|fees earned|grant|interest income|other income|rental income/.test(nm)) return 'INCOME';
  if (/cost of|cogs|purchases|merchandise|cost of sales|material/.test(nm)) return 'COGS';
  if (/expense|payroll|salary|wages|rent|util|insurance|deprec|amort|adverti|travel|office|supplies|fuel|phone|internet|repair|professional|legal|account|tax|bank fee|subscription|software/.test(nm)) return 'EXPENSE';
  return 'OTHER';
}

function str(v: RawCell): string {
  return v == null ? '' : String(v).trim();
}

/** Detect and normalize the layout of parsed rows into an account list. */
export function detectAndMap(rawRows: RawRow[]): ImportResult {
  const warnings: string[] = [];
  const empty = (): ImportResult => ({ format: 'Empty', accounts: [], columns: {}, outOfBalance: 0, warnings });

  const rows = (rawRows ?? []).filter((r) =>
    Object.values(r).some((v) => v !== '' && v != null),
  );
  if (rows.length === 0) return empty();

  const headers = Object.keys(rows[0] as RawRow);
  const col = {
    code: findColumn(headers, 'code'),
    name: findColumn(headers, 'name'),
    subname: findColumn(headers, 'subname'),
    type: findColumn(headers, 'type'),
    debit: findColumn(headers, 'debit'),
    credit: findColumn(headers, 'credit'),
    balance: findColumn(headers, 'balance'),
    dcflag: findColumn(headers, 'dcflag'),
    date: findColumn(headers, 'date'),
  };

  const resolveNameCode = (row: RawRow): { code: string; name: string } => {
    let code = col.code ? str(row[col.code]) : '';
    const rawName = col.name ? str(row[col.name]) : '';
    const subName = col.subname ? str(row[col.subname]) : '';
    let name = rawName;
    // QuickBooks sub-account: "Parent:SubCode" in the name column.
    if (rawName.includes(':') && subName) {
      const afterColon = rawName.split(':').pop()?.trim() ?? '';
      if (/^\d/.test(afterColon) && !code) code = afterColon;
      name = subName;
    } else if (rawName.includes(':')) {
      name = rawName.split(':').pop()?.trim() || rawName;
    }
    return { code, name };
  };

  let format: ImportFormat;
  let accounts: ImportedAccount[] = [];

  if (col.date) {
    // Detailed general ledger — aggregate transaction lines per account.
    format = 'Detailed General Ledger';
    const map = new Map<string, { code: string; name: string; dr: number; cr: number }>();
    for (const row of rows) {
      const key = str(col.code ? row[col.code] : '') || str(col.name ? row[col.name] : '');
      const acctName = str(col.name ? row[col.name] : '') || key;
      if (!key || TOTAL_ROW.test(key)) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = { code: key, name: acctName, dr: 0, cr: 0 };
        map.set(key, entry);
      }
      if (col.debit && col.credit) {
        entry.dr += Math.abs(cleanNumber(row[col.debit]));
        entry.cr += Math.abs(cleanNumber(row[col.credit]));
      } else if (col.balance) {
        const amt = cleanNumber(row[col.balance]);
        const dc = str(col.dcflag ? row[col.dcflag] : '').toUpperCase();
        if (dc === 'D' || dc === 'DR' || dc === 'DEBIT') entry.dr += Math.abs(amt);
        else if (dc === 'C' || dc === 'CR' || dc === 'CREDIT') entry.cr += Math.abs(amt);
        else if (amt >= 0) entry.dr += amt;
        else entry.cr += Math.abs(amt);
      }
    }
    accounts = [...map.values()].map((a) => ({
      code: a.code !== a.name ? a.code : '',
      name: a.name,
      type: inferType(a.code, a.name),
      debit: a.dr,
      credit: a.cr,
    }));
  } else if (col.debit && col.credit) {
    // Trial balance with separate debit and credit columns.
    format = 'Trial Balance (Debit / Credit)';
    for (const row of rows) {
      const { code, name } = resolveNameCode(row);
      if (!name || TOTAL_ROW.test(name)) continue;
      const rawType = str(col.type ? row[col.type] : '').toUpperCase() as AccountType;
      accounts.push({
        code,
        name,
        type: VALID_TYPES.includes(rawType) ? rawType : inferType(code, name),
        debit: Math.abs(cleanNumber(row[col.debit])),
        credit: Math.abs(cleanNumber(row[col.credit])),
      });
    }
  } else if (col.balance) {
    // Trial balance with a single signed net-balance column.
    format = 'Trial Balance (Net Balance)';
    for (const row of rows) {
      const { code, name } = resolveNameCode(row);
      if (!name || TOTAL_ROW.test(name)) continue;
      const bal = cleanNumber(row[col.balance]);
      const dc = str(col.dcflag ? row[col.dcflag] : '').toUpperCase();
      const rawType = str(col.type ? row[col.type] : '').toUpperCase() as AccountType;
      const type = VALID_TYPES.includes(rawType) ? rawType : inferType(code, name);
      let debit = 0;
      let credit = 0;
      if (dc === 'D' || dc === 'DR' || dc === 'DEBIT') debit = Math.abs(bal);
      else if (dc === 'C' || dc === 'CR' || dc === 'CREDIT') credit = Math.abs(bal);
      else {
        // No explicit debit/credit flag: a single net-balance column is
        // debit-positive by convention, which is exactly what makes the trial
        // balance tie out. Positive → debit, negative → credit.
        if (bal >= 0) debit = bal;
        else credit = -bal;
      }
      accounts.push({ code, name, type, debit, credit });
    }
  } else {
    // Unknown grid — guess the first two numeric-looking columns as DR/CR.
    format = 'Auto-detected';
    const numericCols = headers.filter((h) => {
      const sample = rows.slice(0, 5).map((r) => cleanNumber(r[h])).filter((n) => n !== 0);
      return sample.length >= 2;
    });
    const drGuess = numericCols[0];
    const crGuess = numericCols[1];
    if (drGuess) warnings.push(`Could not identify columns; guessed "${drGuess}" as debit${crGuess ? ` and "${crGuess}" as credit` : ''}.`);
    for (const row of rows) {
      const { code, name } = resolveNameCode(row);
      if (!name || TOTAL_ROW.test(name)) continue;
      accounts.push({
        code,
        name,
        type: inferType(code, name),
        debit: drGuess ? Math.abs(cleanNumber(row[drGuess])) : 0,
        credit: crGuess ? Math.abs(cleanNumber(row[crGuess])) : 0,
      });
    }
  }

  // Drop rows with no name and no balance and no code.
  accounts = accounts.filter((a) => a.name && (a.debit !== 0 || a.credit !== 0 || a.code));

  const outCents = accounts.reduce((s, a) => s + toCents(a.debit) - toCents(a.credit), 0);
  const outOfBalance = toDollars(outCents);
  if (outCents !== 0) {
    warnings.push(`Imported trial balance is out of balance by ${outOfBalance.toFixed(2)}.`);
  }
  if (accounts.length === 0) warnings.push('No account rows were recognized.');

  return { format, accounts, columns: col as Partial<Record<ImportField, string>>, outOfBalance, warnings };
}

/** Collapse an imported account's debit/credit into the signed, debit-positive
 * `unadjusted` dollar figure the accounts table stores. */
export function importedToUnadjusted(a: ImportedAccount): number {
  return toDollars(toCents(a.debit) - toCents(a.credit));
}
