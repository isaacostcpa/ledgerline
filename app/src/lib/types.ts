/** Row shapes matching the Supabase schema (see supabase/migrations). */
import type { AccountType, EntryType } from '../domain/trialBalance';

export type AdjustmentStatus = 'proposed' | 'posted';

export interface FirmRow {
  id: string;
  name: string;
}

export interface ClientRow {
  id: string;
  firm_id: string;
  name: string;
  entity_type: string | null;
}

export interface EngagementRow {
  id: string;
  firm_id: string;
  client_id: string;
  fiscal_year: number;
  period_end: string | null;
  entity_type: string | null;
  basis: string;
  status: string;
}

export interface AccountGroupRow {
  id: string;
  firm_id: string;
  code: string;
  name: string;
  type: AccountType;
  sort_order: number;
}

export interface AccountRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  code: string;
  name: string;
  type: AccountType;
  group_id: string | null;
  unadjusted: number;
}

export interface AdjustmentRow {
  id: string;
  engagement_id: string;
  reference: string | null;
  entry_date: string | null;
  memo: string | null;
  type: EntryType;
  status: AdjustmentStatus;
}

export interface AdjustmentLineRow {
  id: string;
  adjustment_id: string;
  account_id: string;
  debit: number;
  credit: number;
}

/** Everything needed to render an engagement's working trial balance. */
export interface EngagementBundle {
  engagement: EngagementRow;
  client: ClientRow;
  groups: AccountGroupRow[];
  accounts: AccountRow[];
  adjustments: AdjustmentRow[];
  lines: AdjustmentLineRow[];
}
