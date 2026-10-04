import { useAuthStore } from '@/store/authStore';

// Role rank — mirrors the backend permissions.ts
const ROLE_RANK: Record<string, number> = {
  READONLY:    0,
  STAFF:       1,
  ACCOUNTANT:  2,
  MANAGER:     3,
  OWNER:       4,
  SUPER_ADMIN: 5,
};

function rank(role?: string | null): number {
  return ROLE_RANK[role ?? ''] ?? -1;
}

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const r = rank(user?.role);

  return {
    role: user?.role ?? null,

    // Inventory
    canViewInventory:       r >= ROLE_RANK.READONLY,
    canWriteStock:          r >= ROLE_RANK.STAFF,       // inward, adjustment, transfer, return
    canWriteProduct:        r >= ROLE_RANK.MANAGER,     // add / edit product
    canDeleteProduct:       r >= ROLE_RANK.MANAGER,
    canManageGodowns:       r >= ROLE_RANK.MANAGER,
    canBulkImport:          r >= ROLE_RANK.MANAGER,

    // Sales
    canViewSales:           r >= ROLE_RANK.READONLY,
    canWriteSales:          r >= ROLE_RANK.STAFF,       // create / edit invoice
    canDeleteSales:         r >= ROLE_RANK.MANAGER,
    canRecordPayment:       r >= ROLE_RANK.ACCOUNTANT,

    // Parties
    canViewParties:         r >= ROLE_RANK.READONLY,
    canWriteParties:        r >= ROLE_RANK.STAFF,
    canDeleteParties:       r >= ROLE_RANK.MANAGER,

    // Leads
    canViewLeads:           r >= ROLE_RANK.READONLY,
    canWriteLeads:          r >= ROLE_RANK.STAFF,
    canDeleteLeads:         r >= ROLE_RANK.MANAGER,

    // Integrations
    canViewIntegrations:      r >= ROLE_RANK.READONLY,  // ALL roles can view Gmail inbox
    canConfigureIntegrations: r >= ROLE_RANK.MANAGER,   // MANAGER + OWNER can connect/disconnect

    // Reports
    canViewReports:         r >= ROLE_RANK.ACCOUNTANT,

    // User management
    canViewUsers:           r >= ROLE_RANK.MANAGER,
    canWriteUsers:          r >= ROLE_RANK.MANAGER,
    canDeleteUsers:         r >= ROLE_RANK.OWNER,

    // Convenience
    isOwnerOrAbove:         r >= ROLE_RANK.OWNER,
    isManagerOrAbove:       r >= ROLE_RANK.MANAGER,
  };
}
