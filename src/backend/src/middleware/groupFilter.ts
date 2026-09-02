/**
 * groupFilter — centralises group-scoped data isolation.
 *
 * Rules:
 *  - OWNER / SUPER_ADMIN (no groupId in token)  → see ALL data for the tenant
 *  - Any user WITH a groupId                     → see only data belonging to their group
 *
 * Usage:
 *   where: { tenantId, ...groupFilter(req) }
 */
export const groupFilter = (req: any): { groupId?: string | null } => {
  const { role, groupId } = req.user as { role: string; groupId?: string };
  // Owners and super-admins see everything
  if (role === 'OWNER' || role === 'SUPER_ADMIN') return {};
  // Grouped users see only their group's data
  if (groupId) return { groupId };
  // Ungrouped non-owner users see only ungrouped (null) data
  return { groupId: null };
};

/**
 * groupWrite — returns the groupId to stamp on newly created records.
 * OWNER / SUPER_ADMIN without a group → null (visible to all owners).
 */
export const groupWrite = (req: any): string | null => {
  const { role, groupId } = req.user as { role: string; groupId?: string };
  if (role === 'OWNER' || role === 'SUPER_ADMIN') return groupId ?? null;
  return groupId ?? null;
};
