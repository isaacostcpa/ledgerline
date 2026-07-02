import { useState, type ReactNode } from 'react';
import { WorkingTrialBalance } from './WorkingTrialBalance';
import { ImportPanel } from './ImportPanel';
import { ChartOfAccounts } from './ChartOfAccounts';
import { Adjustments } from './Adjustments';
import type { AccountRow, EngagementBundle } from '../lib/types';
import '../app.css';

type Tab = 'wtb' | 'import' | 'coa' | 'adj';

/** The tabbed engagement workspace, shared by demo and live mode. `banner` and
 * `headerRight` let each mode inject its own status strip / actions. */
export function Workspace({
  bundle,
  setBundle,
  banner,
  headerRight,
}: {
  bundle: EngagementBundle;
  setBundle: (next: EngagementBundle) => void;
  banner?: ReactNode;
  headerRight?: ReactNode;
}) {
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
          <button className={`tab ${tab === 'adj' ? 'active' : ''}`} type="button" onClick={() => setTab('adj')}>
            Adjustments
          </button>
          <button className="tab" type="button" disabled title="Coming in a later phase">Tax Mapping</button>
          <button className="tab" type="button" disabled title="Coming in a later phase">Statements</button>
        </nav>
        <div className="header-right">{headerRight}</div>
      </header>

      {banner}

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
        {tab === 'adj' && (
          <Adjustments bundle={bundle} onChange={(patch) => setBundle({ ...bundle, ...patch })} />
        )}
      </main>
    </div>
  );
}
