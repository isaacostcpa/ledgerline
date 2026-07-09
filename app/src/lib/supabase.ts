import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when a real Supabase project is configured. When false, the app runs in
 * demo mode against a bundled sample engagement so the UI is fully explorable. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** The Supabase client, or null in demo mode. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
