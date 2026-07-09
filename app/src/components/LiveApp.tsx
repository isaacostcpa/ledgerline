import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureFirm, getProfile, loadBundle, saveBundle, type Profile } from '../lib/db';
import type { EngagementBundle } from '../lib/types';
import { AuthGate } from './AuthGate';
import { EngagementPicker } from './EngagementPicker';
import { Workspace } from './Workspace';
import './live.css';

const signOut = () => supabase?.auth.signOut();

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="live-center">{children}</div>;
}

/** Root of live (persistent) mode: session → firm → engagement → workspace. */
export function LiveApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Centered>Loading…</Centered>;
  if (!session) return <AuthGate />;
  return <FirmScope session={session} />;
}

function FirmScope({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engagementId, setEngagementId] = useState<string | null>(null);

  useEffect(() => {
    getProfile(session.user.id, session.user.email ?? null)
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load your profile.'));
  }, [session.user.id, session.user.email]);

  if (error) {
    return (
      <Centered>
        <div className="live-err">{error}</div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={signOut}>
          Sign out
        </button>
      </Centered>
    );
  }
  if (!profile) return <Centered>Loading your workspace…</Centered>;
  if (!profile.firm_id) {
    return <FirmSetup onDone={(firmId) => setProfile({ ...profile, firm_id: firmId })} />;
  }
  if (!engagementId) {
    return (
      <EngagementPicker firmId={profile.firm_id} onOpen={setEngagementId} onSignOut={() => void signOut()} />
    );
  }
  return (
    <EngagementWorkspace
      firmId={profile.firm_id}
      engagementId={engagementId}
      onBack={() => setEngagementId(null)}
    />
  );
}

function FirmSetup({ onDone }: { onDone: (firmId: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const firmId = await ensureFirm({ id: '', firm_id: null, full_name: null, email: null, role: 'admin' }, name.trim());
      onDone(firmId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create firm.');
      setBusy(false);
    }
  };

  return (
    <Centered>
      <form className="firm-setup" onSubmit={submit}>
        <h1>Name your firm</h1>
        <p>This is your team's workspace. You can invite others later.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ost CPA LLC" autoFocus />
        {err && <div className="live-err">{err}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create firm'}
        </button>
      </form>
    </Centered>
  );
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'error';

function EngagementWorkspace({
  firmId,
  engagementId,
  onBack,
}: {
  firmId: string;
  engagementId: string;
  onBack: () => void;
}) {
  const [bundle, setBundleState] = useState<EngagementBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    loadBundle(engagementId)
      .then(setBundleState)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the engagement.'));
  }, [engagementId]);

  const setBundle = useCallback((next: EngagementBundle) => {
    setBundleState(next);
    setSaveState('dirty');
  }, []);

  const save = useCallback(async () => {
    if (!bundle) return;
    setSaveState('saving');
    try {
      await saveBundle(bundle, firmId);
      setSaveState('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSaveState('error');
    }
  }, [bundle, firmId]);

  if (error && !bundle) {
    return (
      <Centered>
        <div className="live-err">{error}</div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onBack}>
          ← Back to engagements
        </button>
      </Centered>
    );
  }
  if (!bundle) return <Centered>Loading engagement…</Centered>;

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Save changes' : saveState === 'error' ? 'Retry save' : 'Saved';

  return (
    <Workspace
      bundle={bundle}
      setBundle={setBundle}
      headerRight={
        <div className="live-header">
          <button className="live-back" type="button" onClick={onBack} title="Back to engagements">
            ←
          </button>
          <span className="live-eng mono">
            {bundle.client.name} · FY{bundle.engagement.fiscal_year}
          </span>
          <button
            className={`btn btn-sm ${saveState === 'idle' ? 'btn-secondary' : 'btn-primary'}`}
            type="button"
            onClick={save}
            disabled={saveState === 'saving' || saveState === 'idle'}
          >
            {saveLabel}
          </button>
          <button className="live-signout" type="button" onClick={() => void signOut()} title="Sign out">
            Sign out
          </button>
        </div>
      }
      banner={
        error ? <div className="live-banner err">{error}</div> : undefined
      }
    />
  );
}
