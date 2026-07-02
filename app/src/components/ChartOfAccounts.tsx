import { useMemo, useState } from 'react';
import { suggestGroupCode } from '../domain/coa';
import { formatCents, toCents } from '../domain/money';
import type { AccountType } from '../domain/trialBalance';
import type { AccountRow, EngagementBundle } from '../lib/types';
import './coa.css';

const TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'COGS', 'EXPENSE', 'OTHER'];

/** Edit each account's leadsheet group and type. Changes flow straight back to
 * the engagement, so the Working Trial Balance updates live. This is where the
 * ~15 stragglers a messy import leaves ungrouped get cleaned up. */
export function ChartOfAccounts({
  bundle,
  onChange,
}: {
  bundle: EngagementBundle;
  onChange: (accounts: AccountRow[]) => void;
}) {
  const [onlyUngrouped, setOnlyUngrouped] = useState(false);

  const groupsById = useMemo(
    () => new Map(bundle.groups.map((g) => [g.id, g])),
    [bundle.groups],
  );
  const groupsByCode = useMemo(
    () => new Map(bundle.groups.map((g) => [g.code, g])),
    [bundle.groups],
  );
  const ungroupedCount = bundle.accounts.filter((a) => !a.group_id).length;

  const update = (id: string, patch: Partial<AccountRow>) =>
    onChange(bundle.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const autoGroupRemaining = () => {
    onChange(
      bundle.accounts.map((a) => {
        if (a.group_id) return a;
        const code = suggestGroupCode(a.name, a.code, a.type);
        const group = code ? groupsByCode.get(code) : undefined;
        return group ? { ...a, group_id: group.id } : a;
      }),
    );
  };

  const rows = onlyUngrouped
    ? bundle.accounts.filter((a) => !a.group_id)
    : bundle.accounts;

  // Group dropdown options, ordered like the leadsheets.
  const groupOptions = [...bundle.groups].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section className="coa">
      <header className="coa-head">
        <div>
          <h2>Chart of Accounts</h2>
          <p className="sub">
            {bundle.accounts.length} accounts · {ungroupedCount} unassigned to a leadsheet
          </p>
        </div>
        <div className="coa-actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={onlyUngrouped}
              onChange={(e) => setOnlyUngrouped(e.target.checked)}
            />
            Show only unassigned
          </label>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={autoGroupRemaining}
            disabled={ungroupedCount === 0}
          >
            Auto-group {ungroupedCount || ''} unassigned
          </button>
        </div>
      </header>

      <div className="coa-scroll">
        <table className="coa-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th>Leadsheet group</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const assigned = a.group_id ? groupsById.get(a.group_id) : undefined;
              return (
                <tr key={a.id} className={a.group_id ? '' : 'unassigned'}>
                  <td className="mono muted">{a.code || '—'}</td>
                  <td className="name">{a.name}</td>
                  <td>
                    <select
                      value={a.type}
                      onChange={(e) => update(a.id, { type: e.target.value as AccountType })}
                      aria-label={`Type for ${a.name}`}
                    >
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className={assigned ? '' : 'needs'}
                      value={a.group_id ?? ''}
                      onChange={(e) => update(a.id, { group_id: e.target.value || null })}
                      aria-label={`Leadsheet group for ${a.name}`}
                    >
                      <option value="">— Unassigned —</option>
                      {groupOptions.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`num mono tnum ${toCents(a.unadjusted) < 0 ? 'neg' : ''}`}>
                    {formatCents(toCents(a.unadjusted))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
