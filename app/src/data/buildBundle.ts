/**
 * Turn a list of imported accounts into an EngagementBundle the Working Trial
 * Balance can render — assigning each account to a firm leadsheet group via the
 * standardization heuristic, and starting with no adjustments.
 */
import { suggestGroupCode } from '../domain/coa';
import { importedToUnadjusted, type ImportedAccount } from '../domain/importGl';
import type {
  AccountGroupRow,
  AccountRow,
  ClientRow,
  EngagementBundle,
  EngagementRow,
} from '../lib/types';

export function buildBundleFromImport(
  imported: ImportedAccount[],
  groups: AccountGroupRow[],
  engagement: EngagementRow,
  client: ClientRow,
): EngagementBundle {
  const groupByCode = new Map(groups.map((g) => [g.code, g]));

  const accounts: AccountRow[] = imported.map((a, i) => {
    const suggestedCode = suggestGroupCode(a.name, a.code, a.type);
    const group = suggestedCode ? groupByCode.get(suggestedCode) : undefined;
    return {
      id: `imp-${i}-${a.code || a.name}`.slice(0, 60),
      firm_id: engagement.firm_id,
      engagement_id: engagement.id,
      code: a.code || String(1000 + i),
      name: a.name,
      type: a.type,
      group_id: group ? group.id : null,
      unadjusted: importedToUnadjusted(a),
    };
  });

  return { engagement, client, groups, accounts, adjustments: [], lines: [] };
}
