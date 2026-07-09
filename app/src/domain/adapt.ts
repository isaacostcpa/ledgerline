/** Map database rows into the pure-domain shapes the WTB engine consumes. */
import type { EngagementBundle } from '../lib/types';
import type { AccountGroup } from './coa';
import type { Account, AdjustmentLine } from './trialBalance';

export function toDomainGroups(bundle: EngagementBundle): AccountGroup[] {
  return bundle.groups.map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    type: g.type,
    sortOrder: g.sort_order,
  }));
}

export function toDomainAccounts(bundle: EngagementBundle): Account[] {
  return bundle.accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    groupId: a.group_id,
    unadjusted: a.unadjusted,
  }));
}

export function toDomainLines(bundle: EngagementBundle): AdjustmentLine[] {
  const statusById = new Map(bundle.adjustments.map((h) => [h.id, h]));
  const out: AdjustmentLine[] = [];
  for (const line of bundle.lines) {
    const header = statusById.get(line.adjustment_id);
    if (!header) continue;
    out.push({
      accountId: line.account_id,
      entryType: header.type,
      posted: header.status === 'posted',
      debit: line.debit,
      credit: line.credit,
    });
  }
  return out;
}
