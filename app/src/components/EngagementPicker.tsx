import { useEffect, useState } from 'react';
import {
  createEngagement,
  listEngagements,
  type EngagementListItem,
} from '../lib/db';
import './picker.css';

const ENTITY_TYPES = ['S-Corp', 'C-Corp', 'Partnership', 'Individual', 'Non-Profit', 'Trust'];

export function EngagementPicker({
  firmId,
  onOpen,
  onSignOut,
}: {
  firmId: string;
  onOpen: (engagementId: string) => void;
  onSignOut: () => void;
}) {
  const [items, setItems] = useState<EngagementListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // New-engagement form
  const [clientName, setClientName] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1);
  const [entityType, setEntityType] = useState<string>(ENTITY_TYPES[0] ?? 'S-Corp');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setErr(null);
    listEngagements()
      .then(setItems)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load engagements.'));
  };
  useEffect(load, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const id = await createEngagement({
        firmId,
        clientName: clientName.trim(),
        fiscalYear,
        entityType,
        periodEnd: `${fiscalYear}-12-31`,
        basis: 'Tax',
      });
      onOpen(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create engagement.');
      setBusy(false);
    }
  };

  return (
    <div className="picker">
      <header className="picker-top">
        <div className="brand">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="5" fill="#2A4A2A" stroke="#B5713A" strokeWidth="1.5" />
            <line x1="9" y1="10" x2="23" y2="10" stroke="#B5713A" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="16" x2="20" y2="16" stroke="#F5F4EF" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="22" x2="17" y2="22" stroke="#F5F4EF" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Ledgerline</span>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <main className="picker-body">
        <div className="picker-head">
          <h1>Engagements</h1>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Close' : '+ New Engagement'}
          </button>
        </div>

        {err && <div className="picker-err">{err}</div>}

        {creating && (
          <form className="new-eng" onSubmit={create}>
            <label className="grow">
              Client name
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme LLC" autoFocus />
            </label>
            <label>
              Fiscal year
              <input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
              />
            </label>
            <label>
              Entity type
              <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy || !clientName.trim()}>
              {busy ? 'Creating…' : 'Create & open'}
            </button>
          </form>
        )}

        {items === null && !err && <p className="picker-loading">Loading…</p>}
        {items && items.length === 0 && !creating && (
          <p className="picker-empty">No engagements yet. Create your first one to get started.</p>
        )}

        {items && items.length > 0 && (
          <ul className="eng-list">
            {items.map((e) => (
              <li key={e.id}>
                <button className="eng-card" type="button" onClick={() => onOpen(e.id)}>
                  <span className="eng-client">{e.client_name}</span>
                  <span className="eng-meta">
                    FY{e.fiscal_year} · {e.entity_type ?? '—'} · {e.basis} basis
                  </span>
                  <span className={`eng-status ${e.status}`}>{e.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
