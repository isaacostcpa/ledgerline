import { useMemo, useState } from 'react';
import { formatCents, toCents } from '../domain/money';
import type { EntryType } from '../domain/trialBalance';
import type {
  AdjustmentLineRow,
  AdjustmentRow,
  EngagementBundle,
} from '../lib/types';
import './adjustments.css';

const ENTRY_META: Record<EntryType, { label: string; hint: string; cls: string }> = {
  AJE: { label: 'Adjusting', hint: 'flows to the Adjusting column', cls: 'aje' },
  RJE: { label: 'Reclass', hint: 'flows to the Reclass column', cls: 'rje' },
  BOOK: { label: 'Book', hint: 'tax-basis only', cls: 'book' },
  TAX: { label: 'Tax', hint: 'tax-basis only (book↔tax)', cls: 'tax' },
};
const ENTRY_TYPES = Object.keys(ENTRY_META) as EntryType[];

interface DraftLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;

const emptyLine = (): DraftLine => ({ id: uid(), accountId: '', debit: '', credit: '' });

export function Adjustments({
  bundle,
  onChange,
}: {
  bundle: EngagementBundle;
  onChange: (patch: { adjustments?: AdjustmentRow[]; lines?: AdjustmentLineRow[] }) => void;
}) {
  const [composing, setComposing] = useState(false);

  const acctName = useMemo(() => {
    const m = new Map(bundle.accounts.map((a) => [a.id, a]));
    return (id: string) => {
      const a = m.get(id);
      return a ? `${a.code ? a.code + ' ' : ''}${a.name}` : '(unknown)';
    };
  }, [bundle.accounts]);

  const linesByAdj = useMemo(() => {
    const m = new Map<string, AdjustmentLineRow[]>();
    for (const l of bundle.lines) {
      const arr = m.get(l.adjustment_id);
      if (arr) arr.push(l);
      else m.set(l.adjustment_id, [l]);
    }
    return m;
  }, [bundle.lines]);

  const posted = bundle.adjustments.filter((a) => a.status === 'posted').length;
  const proposed = bundle.adjustments.filter((a) => a.status === 'proposed').length;

  const setStatus = (id: string, status: AdjustmentRow['status']) =>
    onChange({ adjustments: bundle.adjustments.map((a) => (a.id === id ? { ...a, status } : a)) });

  const remove = (id: string) =>
    onChange({
      adjustments: bundle.adjustments.filter((a) => a.id !== id),
      lines: bundle.lines.filter((l) => l.adjustment_id !== id),
    });

  const addEntry = (header: AdjustmentRow, lines: AdjustmentLineRow[]) => {
    onChange({
      adjustments: [...bundle.adjustments, header],
      lines: [...bundle.lines, ...lines],
    });
    setComposing(false);
  };

  return (
    <section className="adj">
      <header className="adj-head">
        <div>
          <h2>Adjusting Entries</h2>
          <p className="sub">
            {bundle.adjustments.length} entries · {posted} posted · {proposed} proposed. Posted
            entries flow into the Working Trial Balance.
          </p>
        </div>
        {!composing && (
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setComposing(true)}>
            + New Entry
          </button>
        )}
      </header>

      {composing && (
        <EntryComposer
          bundle={bundle}
          onCancel={() => setComposing(false)}
          onSave={addEntry}
        />
      )}

      <div className="adj-list">
        {bundle.adjustments.length === 0 && !composing && (
          <p className="empty">No adjusting entries yet. Click “New Entry” to book one.</p>
        )}
        {bundle.adjustments.map((h) => {
          const lines = linesByAdj.get(h.id) ?? [];
          const debit = lines.reduce((s, l) => s + toCents(l.debit), 0);
          const credit = lines.reduce((s, l) => s + toCents(l.credit), 0);
          const meta = ENTRY_META[h.type];
          return (
            <article key={h.id} className={`entry ${h.status}`}>
              <div className="entry-top">
                <span className={`etype ${meta.cls}`}>{meta.label}</span>
                <span className="eref mono">{h.reference || '—'}</span>
                <span className="edate mono">{h.entry_date || ''}</span>
                <span className="ememo">{h.memo}</span>
                <span className={`estatus ${h.status}`}>{h.status}</span>
                <span className="eamt mono tnum">{formatCents(debit)}</span>
                <span className="eactions">
                  {h.status === 'proposed' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      disabled={debit !== credit || debit === 0}
                      title={debit !== credit ? 'Entry must balance before posting' : 'Post'}
                      onClick={() => setStatus(h.id, 'posted')}
                    >
                      Post
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setStatus(h.id, 'proposed')}>
                      Unpost
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(h.id)} aria-label="Delete entry">
                    ✕
                  </button>
                </span>
              </div>
              <table className="elines">
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="acc">{acctName(l.account_id)}</td>
                      <td className="num mono tnum">{toCents(l.debit) ? formatCents(toCents(l.debit)) : ''}</td>
                      <td className="num mono tnum">{toCents(l.credit) ? formatCents(toCents(l.credit)) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EntryComposer({
  bundle,
  onCancel,
  onSave,
}: {
  bundle: EngagementBundle;
  onCancel: () => void;
  onSave: (header: AdjustmentRow, lines: AdjustmentLineRow[]) => void;
}) {
  const [type, setType] = useState<EntryType>('AJE');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(bundle.engagement.period_end ?? '');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);

  const setLine = (id: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const totalDebit = lines.reduce((s, l) => s + toCents(Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + toCents(Number(l.credit) || 0), 0);
  const diff = totalDebit - totalCredit;
  const balanced = diff === 0 && totalDebit > 0;
  const hasAccounts = lines.some((l) => l.accountId && (Number(l.debit) || Number(l.credit)));

  const build = (status: AdjustmentRow['status']): [AdjustmentRow, AdjustmentLineRow[]] => {
    const adjId = uid();
    const header: AdjustmentRow = {
      id: adjId,
      engagement_id: bundle.engagement.id,
      reference: reference || null,
      entry_date: date || null,
      memo: memo || null,
      type,
      status,
    };
    const rows: AdjustmentLineRow[] = lines
      .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
      .map((l) => ({
        id: uid(),
        adjustment_id: adjId,
        account_id: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }));
    return [header, rows];
  };

  return (
    <div className="composer">
      <div className="composer-row types">
        {ENTRY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`type-chip ${ENTRY_META[t].cls} ${type === t ? 'sel' : ''}`}
            onClick={() => setType(t)}
          >
            {ENTRY_META[t].label}
            <span className="type-hint">{ENTRY_META[t].hint}</span>
          </button>
        ))}
      </div>

      <div className="composer-row fields">
        <label>
          Reference
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="AJE-01" />
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="grow">
          Memo
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Describe the entry" />
        </label>
      </div>

      <table className="composer-lines">
        <thead>
          <tr>
            <th>Account</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>
                <select value={l.accountId} onChange={(e) => setLine(l.id, { accountId: e.target.value })}>
                  <option value="">— Select account —</option>
                  {bundle.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code ? `${a.code} ` : ''}{a.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="num">
                <input
                  className="amt"
                  inputMode="decimal"
                  value={l.debit}
                  onChange={(e) => setLine(l.id, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
                  placeholder="0.00"
                />
              </td>
              <td className="num">
                <input
                  className="amt"
                  inputMode="decimal"
                  value={l.credit}
                  onChange={(e) => setLine(l.id, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
                  placeholder="0.00"
                />
              </td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => setLines((ls) => (ls.length > 2 ? ls.filter((x) => x.id !== l.id) : ls))}
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          <tr className="totals">
            <td>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                + Add line
              </button>
            </td>
            <td className="num mono tnum">{formatCents(totalDebit)}</td>
            <td className="num mono tnum">{formatCents(totalCredit)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="composer-foot">
        <span className={`balance-flag ${balanced ? 'ok' : 'bad'}`}>
          {balanced ? 'Balanced' : diff === 0 ? 'Enter amounts' : `Out of balance by ${formatCents(Math.abs(diff))}`}
        </span>
        <div className="composer-btns">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={!hasAccounts}
            onClick={() => onSave(...build('proposed'))}
          >
            Save as proposed
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={!balanced}
            title={!balanced ? 'Entry must balance to post' : 'Save and post'}
            onClick={() => onSave(...build('posted'))}
          >
            Save &amp; post
          </button>
        </div>
      </div>
    </div>
  );
}
