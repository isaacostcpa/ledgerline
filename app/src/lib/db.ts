/**
 * Supabase data access for live (persistent) mode.
 *
 * Everything here assumes Row-Level Security is enforcing firm isolation, so
 * queries never filter by firm_id for reads — the policies do. Writes set
 * firm_id explicitly because the RLS WITH CHECK requires it.
 */
import { supabase } from './supabase';
import type {
  AccountGroupRow,
  AccountRow,
  AdjustmentLineRow,
  AdjustmentRow,
  ClientRow,
  EngagementBundle,
  EngagementRow,
} from './types';
import type { AccountType, EntryType } from '../domain/trialBalance';

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export interface Profile {
  id: string;
  firm_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string;
}

/** Load the signed-in user's profile row, creating a bare one if missing. */
export async function getProfile(userId: string, email: string | null): Promise<Profile> {
  const sb = db();
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;
  const { data: created, error: insErr } = await sb
    .from('profiles')
    .insert({ id: userId, email })
    .select('*')
    .single();
  if (insErr) throw insErr;
  return created as Profile;
}

/** Ensure the user belongs to a firm; create one (seeding standard groups) if not. */
export async function ensureFirm(profile: Profile, firmName: string): Promise<string> {
  if (profile.firm_id) return profile.firm_id;
  const sb = db();
  const { data, error } = await sb.rpc('bootstrap_firm', { firm_name: firmName });
  if (error) throw error;
  return data as string;
}

export interface EngagementListItem extends EngagementRow {
  client_name: string;
}

/** List the firm's engagements with their client names, newest fiscal year first. */
export async function listEngagements(): Promise<EngagementListItem[]> {
  const sb = db();
  const { data, error } = await sb
    .from('engagements')
    .select('*, clients(name)')
    .order('fiscal_year', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: Record<string, unknown>) => ({
    ...(e as unknown as EngagementRow),
    client_name: (e.clients as { name?: string } | null)?.name ?? 'Client',
  }));
}

/** Create a client + engagement in one go and return the new engagement id. */
export async function createEngagement(input: {
  firmId: string;
  clientName: string;
  fiscalYear: number;
  entityType: string;
  periodEnd: string | null;
  basis: string;
}): Promise<string> {
  const sb = db();
  const { data: client, error: cErr } = await sb
    .from('clients')
    .insert({ firm_id: input.firmId, name: input.clientName, entity_type: input.entityType })
    .select('id')
    .single();
  if (cErr) throw cErr;
  const { data: eng, error: eErr } = await sb
    .from('engagements')
    .insert({
      firm_id: input.firmId,
      client_id: (client as { id: string }).id,
      fiscal_year: input.fiscalYear,
      entity_type: input.entityType,
      period_end: input.periodEnd,
      basis: input.basis,
    })
    .select('id')
    .single();
  if (eErr) throw eErr;
  return (eng as { id: string }).id;
}

/** Load everything needed to render an engagement into an EngagementBundle. */
export async function loadBundle(engagementId: string): Promise<EngagementBundle> {
  const sb = db();
  const [engRes, groupRes, acctRes, adjRes] = await Promise.all([
    sb.from('engagements').select('*, clients(*)').eq('id', engagementId).single(),
    sb.from('account_groups').select('*').order('sort_order'),
    sb.from('accounts').select('*').eq('engagement_id', engagementId).order('code'),
    sb.from('adjustments').select('*').eq('engagement_id', engagementId).order('reference'),
  ]);
  if (engRes.error) throw engRes.error;
  if (groupRes.error) throw groupRes.error;
  if (acctRes.error) throw acctRes.error;
  if (adjRes.error) throw adjRes.error;

  const engRow = engRes.data as Record<string, unknown>;
  const client = (engRow.clients as ClientRow) ?? {
    id: '',
    firm_id: '',
    name: 'Client',
    entity_type: null,
  };
  const engagement: EngagementRow = {
    id: engRow.id as string,
    firm_id: engRow.firm_id as string,
    client_id: engRow.client_id as string,
    fiscal_year: engRow.fiscal_year as number,
    period_end: (engRow.period_end as string) ?? null,
    entity_type: (engRow.entity_type as string) ?? null,
    basis: engRow.basis as string,
    status: engRow.status as string,
  };

  const adjustments = (adjRes.data ?? []) as AdjustmentRow[];
  let lines: AdjustmentLineRow[] = [];
  if (adjustments.length > 0) {
    const { data: lineData, error: lErr } = await sb
      .from('adjustment_lines')
      .select('*')
      .in('adjustment_id', adjustments.map((a) => a.id));
    if (lErr) throw lErr;
    lines = (lineData ?? []) as AdjustmentLineRow[];
  }

  return {
    engagement,
    client,
    groups: (groupRes.data ?? []) as AccountGroupRow[],
    accounts: (acctRes.data ?? []) as AccountRow[],
    adjustments,
    lines,
  };
}

/**
 * Persist an engagement's editable data. Accounts, adjustments, and their lines
 * are replaced wholesale for this engagement (delete then insert), which keeps
 * the client and server in sync without change-tracking. Runs in FK-safe order.
 */
export async function saveBundle(bundle: EngagementBundle, firmId: string): Promise<void> {
  const sb = db();
  const engId = bundle.engagement.id;

  // Delete in FK order: lines → adjustments → accounts.
  const adjIds = bundle.adjustments.map((a) => a.id);
  if (adjIds.length > 0) {
    const del = await sb.from('adjustment_lines').delete().in('adjustment_id', adjIds);
    if (del.error) throw del.error;
  }
  const delAdj = await sb.from('adjustments').delete().eq('engagement_id', engId);
  if (delAdj.error) throw delAdj.error;
  const delAcc = await sb.from('accounts').delete().eq('engagement_id', engId);
  if (delAcc.error) throw delAcc.error;

  // Re-insert accounts, then adjustments, then lines.
  if (bundle.accounts.length > 0) {
    const rows = bundle.accounts.map((a) => ({
      id: a.id,
      firm_id: firmId,
      engagement_id: engId,
      code: a.code,
      name: a.name,
      type: a.type as AccountType,
      group_id: a.group_id,
      unadjusted: a.unadjusted,
    }));
    const ins = await sb.from('accounts').insert(rows);
    if (ins.error) throw ins.error;
  }
  if (bundle.adjustments.length > 0) {
    const rows = bundle.adjustments.map((h) => ({
      id: h.id,
      firm_id: firmId,
      engagement_id: engId,
      reference: h.reference,
      entry_date: h.entry_date,
      memo: h.memo,
      type: h.type as EntryType,
      status: h.status,
    }));
    const ins = await sb.from('adjustments').insert(rows);
    if (ins.error) throw ins.error;
  }
  if (bundle.lines.length > 0) {
    const rows = bundle.lines.map((l) => ({
      id: l.id,
      firm_id: firmId,
      adjustment_id: l.adjustment_id,
      account_id: l.account_id,
      debit: l.debit,
      credit: l.credit,
    }));
    const ins = await sb.from('adjustment_lines').insert(rows);
    if (ins.error) throw ins.error;
  }
}
