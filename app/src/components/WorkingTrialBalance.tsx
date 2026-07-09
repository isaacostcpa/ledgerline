import { useMemo } from 'react';
import { formatCents } from '../domain/money';
import {
  buildWorkingTrialBalance,
  isInBalance,
  type WtbColumnTotals,
} from '../domain/trialBalance';
import { groupIntoLeadsheets, ungroupedCount } from '../domain/coa';
import { toDomainAccounts, toDomainGroups, toDomainLines } from '../domain/adapt';
import type { EngagementBundle } from '../lib/types';
import './wtb.css';

const COLUMNS: { key: keyof WtbColumnTotals; label: string; sub?: string }[] = [
  { key: 'unadjusted', label: 'Unadjusted' },
  { key: 'reclass', label: 'Reclass', sub: 'RJE' },
  { key: 'adjusting', label: 'Adjusting', sub: 'AJE' },
  { key: 'adjusted', label: 'Adjusted', sub: 'Report basis' },
  { key: 'tax', label: 'Tax', sub: 'Book↔Tax' },
  { key: 'taxBasis', label: 'Tax Basis' },
];

/** Accounting figure cell: parenthesized negatives, muted zeros, right-aligned. */
function Figure({ cents, strong }: { cents: number; strong?: boolean }) {
  const cls = ['fig', 'tnum', 'mono'];
  if (cents < 0) cls.push('neg');
  if (cents === 0) cls.push('zero');
  if (strong) cls.push('strong');
  return <td className={cls.join(' ')}>{formatCents(cents)}</td>;
}

export function WorkingTrialBalance({ bundle }: { bundle: EngagementBundle }) {
  const { wtb, leadsheets, unmapped, balanced } = useMemo(() => {
    const accounts = toDomainAccounts(bundle);
    const lines = toDomainLines(bundle);
    const wtb = buildWorkingTrialBalance(accounts, lines);
    return {
      wtb,
      leadsheets: groupIntoLeadsheets(wtb.rows, toDomainGroups(bundle)),
      unmapped: ungroupedCount(wtb.rows),
      balanced: isInBalance(wtb),
    };
  }, [bundle]);

  const postedAdj = bundle.adjustments.filter((a) => a.status === 'posted').length;
  const proposedAdj = bundle.adjustments.filter((a) => a.status === 'proposed').length;

  return (
    <section className="wtb">
      <header className="wtb-head">
        <div>
          <h2>Working Trial Balance</h2>
          <p className="sub">
            {bundle.client.name} · FY{bundle.engagement.fiscal_year} ·{' '}
            {bundle.engagement.basis} basis · {bundle.accounts.length} accounts
          </p>
        </div>
        <div className="chips">
          <span className={`chip ${balanced ? 'ok' : 'bad'}`}>
            {balanced ? 'In balance' : 'Out of balance'}
          </span>
          <span className="chip neutral">{postedAdj} posted</span>
          {proposedAdj > 0 && <span className="chip warn">{proposedAdj} proposed</span>}
          {unmapped > 0 && <span className="chip warn">{unmapped} ungrouped</span>}
        </div>
      </header>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="acct-h">Account</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="num-h">
                  <span className="col-label">{c.label}</span>
                  {c.sub && <span className="col-sub">{c.sub}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leadsheets.map((ls) => (
              <LeadsheetBlock key={ls.group?.id ?? 'ungrouped'} leadsheet={ls} />
            ))}
          </tbody>
          <tfoot>
            <tr className="grand">
              <td>Trial balance — must net to zero</td>
              {COLUMNS.map((c) => (
                <Figure key={c.key} cents={wtb.totals[c.key]} strong />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function LeadsheetBlock({
  leadsheet,
}: {
  leadsheet: ReturnType<typeof groupIntoLeadsheets>[number];
}) {
  const { group, rows, subtotal } = leadsheet;
  return (
    <>
      <tr className="group-row">
        <td className="group-name">
          {group ? (
            <>
              <span className="group-code mono">{group.code}</span> {group.name}
            </>
          ) : (
            <em>Ungrouped accounts</em>
          )}
        </td>
        {COLUMNS.map((c) => (
          <td key={c.key} />
        ))}
      </tr>
      {rows.map((r) => (
        <tr key={r.account.id} className="acct-row">
          <td className="acct-cell">
            <span className="acct-code mono">{r.account.code}</span>
            <span className="acct-name">{r.account.name}</span>
          </td>
          <Figure cents={r.unadjusted} />
          <Figure cents={r.reclass} />
          <Figure cents={r.adjusting} />
          <Figure cents={r.adjusted} />
          <Figure cents={r.tax} />
          <Figure cents={r.taxBasis} />
        </tr>
      ))}
      <tr className="subtotal-row">
        <td>{group ? `${group.name} total` : 'Ungrouped total'}</td>
        {COLUMNS.map((c) => (
          <Figure key={c.key} cents={subtotal[c.key]} strong />
        ))}
      </tr>
    </>
  );
}
