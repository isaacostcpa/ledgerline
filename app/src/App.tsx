import { useState } from 'react';
import { WorkingTrialBalance } from './components/WorkingTrialBalance';
import { ImportPanel } from './components/ImportPanel';
import { ChartOfAccounts } from './components/ChartOfAccounts';
import { demoBundle } from './data/demo';
import { isSupabaseConfigured } from './lib/supabase';
import type { AccountRow, EngagementBundle } from './lib/types';
import './app.css';

type Tab = 'wtb' | 'import' | 'coa';

export default function App() {
  // Phase 1 works against a single in-memory engagement: demo data to start,
  // replaced live when a GL/TB is imported. (Auth + Supabase persistence next.)
  const [bundle, setBundle] = useState<EngagementBundle>(demoBundle);
  const [tab, setTab] = useState<Tab>('wtb');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg className="logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="5" fill="#2A4A2A" stroke="#B5713A" strokeWidth="1.5" />
            <line x1="9" y1="10" x2="23" y2="10" stroke="#B5713A" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="16" x2="20" y2="16" stroke="#F5F4EF" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="22" x2="17" y2="22" stroke="#F5F4EF" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="wordmark">Ledgerline</span>
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'wtb' ? 'active' : ''}`} type="button" onClick={() => setTab('wtb')}>
            Working TB
          </button>
          <button className={`tab ${tab === 'import' ? 'active' : ''}`} type="button" onClick={() => setTab('import')}>
            Import
          </button>
          <button className={`tab ${tab === 'coa' ? 'active' : ''}`} type="button" onClick={() => setTab('coa')}>
            Chart of Accounts
          </button>
          <button className="tab" type="button" disabled title="Coming in a later phase">Adjustments</button>
          <button className="tab" type="button" disabled title="Coming in a later phase">Workpapers</button>
          <button className="tab" type="button" disabled title="Coming in a later phase">Tax Mapping</button>
          <button className="tab" type="button" disabled title="Coming in a later phase">Statements</button>
        </nav>
        <div className="engagement-pill">
          {bundle.client.name} · FY{bundle.engagement.fiscal_year}
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="demo-banner">
          <strong>Demo data.</strong> Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, run the
          migrations in <code>supabase/migrations</code>, and Ledgerline connects to
          your firm's live data.
        </div>
      )}

      <main className="content">
        {tab === 'wtb' && <WorkingTrialBalance bundle={bundle} />}
        {tab === 'import' && (
          <ImportPanel
            base={bundle}
            onLoad={(next) => {
              setBundle(next);
              setTab('coa');
            }}
          />
        )}
        {tab === 'coa' && (
          <ChartOfAccounts
            bundle={bundle}
            onChange={(accounts: AccountRow[]) => setBundle({ ...bundle, accounts })}
          />
        )}
      </main>
    </div>
  );
}
