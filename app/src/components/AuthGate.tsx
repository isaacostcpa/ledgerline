import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './auth.css';

/** Sign-in / sign-up screen shown in live mode until a session exists. */
export function AuthGate() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Account created. Check your email if confirmation is required, then sign in.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // On success the session listener in App swaps this screen out.
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="5" fill="#2A4A2A" stroke="#B5713A" strokeWidth="1.5" />
            <line x1="9" y1="10" x2="23" y2="10" stroke="#B5713A" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="16" x2="20" y2="16" stroke="#F5F4EF" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="22" x2="17" y2="22" stroke="#F5F4EF" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Ledgerline</span>
        </div>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
        <p className="auth-sub">
          {mode === 'signin'
            ? 'Welcome back. Sign in to your firm workspace.'
            : 'Set up access to your firm workspace.'}
        </p>

        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {err && <div className="auth-err">{err}</div>}
          {msg && <div className="auth-msg">{msg}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setErr(null);
            setMsg(null);
          }}
        >
          {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
