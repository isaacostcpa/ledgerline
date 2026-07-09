import { useState } from 'react';
import { Workspace } from './components/Workspace';
import { LiveApp } from './components/LiveApp';
import { demoBundle } from './data/demo';
import { isSupabaseConfigured } from './lib/supabase';
import type { EngagementBundle } from './lib/types';

export default function App() {
  // With Supabase configured, run the full multi-user app (auth + persistence).
  // Otherwise fall back to an in-memory demo against a bundled sample engagement.
  if (isSupabaseConfigured) return <LiveApp />;
  return <DemoApp />;
}

function DemoApp() {
  const [bundle, setBundle] = useState<EngagementBundle>(demoBundle);
  return (
    <Workspace
      bundle={bundle}
      setBundle={setBundle}
      headerRight={
        <div className="engagement-pill">
          {bundle.client.name} · FY{bundle.engagement.fiscal_year}
        </div>
      }
      banner={
        <div className="demo-banner">
          <strong>Demo mode.</strong> Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, run the
          migrations in <code>supabase/migrations</code>, and Ledgerline switches to
          your firm's live, saved data with sign-in.
        </div>
      }
    />
  );
}
