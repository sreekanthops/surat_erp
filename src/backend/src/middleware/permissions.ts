import { Request, Response, NextFunction } from 'express';

/**
 * Role hierarchy (higher index = more privilege):
 *   READONLY < STAFF < ACCOUNTANT < MANAGER < OWNER < SUPER_ADMIN
 *
 * Permission map — each action lists the MINIMUM roles allowed.
 */

const ROLE_RANK: Record<string, number> = {
  READONLY:    0,
  STAFF:       1,
  ACCOUNTANT:  2,
  MANAGER:     3,
  OWNER:       4,
  SUPER_ADMIN: 5,
};

// Minimum role required for each action
const PERMISSIONS: Record<string, number> = {
  // ── Inventory ──────────────────────────────────────────────
  'inventory:view':          ROLE_RANK.READONLY,
  'inventory:stock_write':   ROLE_RANK.STAFF,        // inward, adjustment, transfer, return
  'inventory:product_write': ROLE_RANK.MANAGER,      // add / edit product
  'inventory:product_delete':ROLE_RANK.MANAGER,      // delete product
  'inventory:bulk_import':   ROLE_RANK.MANAGER,
  'inventory:godown_write':  ROLE_RANK.MANAGER,

  // ── Sales ──────────────────────────────────────────────────
  'sales:view':              ROLE_RANK.READONLY,
  'sales:write':             ROLE_RANK.STAFF,        // create / edit invoice
  'sales:delete':            ROLE_RANK.MANAGER,
  'sales:payment_record':    ROLE_RANK.ACCOUNTANT,

  // ── Parties ────────────────────────────────────────────────
  'parties:view':            ROLE_RANK.READONLY,
  'parties:write':           ROLE_RANK.STAFF,        // add / edit party
  'parties:delete':          ROLE_RANK.MANAGER,

  // ── Leads ──────────────────────────────────────────────────
  'leads:view':              ROLE_RANK.READONLY,
  'leads:write':             ROLE_RANK.STAFF,        // add / edit / status change
  'leads:delete':            ROLE_RANK.MANAGER,

  // ── Integrations ───────────────────────────────────────────
  'integrations:view':       ROLE_RANK.MANAGER,      // see connection status
  'integrations:configure':  ROLE_RANK.MANAGER,      // connect / disconnect / change credentials (OWNER + MANAGER)

  // ── Users ──────────────────────────────────────────────────
  'users:view':              ROLE_RANK.MANAGER,
  'users:write':             ROLE_RANK.MANAGER,      // invite / edit (no owner escalation)
  'users:delete':            ROLE_RANK.OWNER,

  // ── Reports ────────────────────────────────────────────────
  'reports:view':            ROLE_RANK.ACCOUNTANT,
};

export const can = (userRole: string, action: string): boolean => {
  const userRank = ROLE_RANK[userRole] ?? -1;
  const required = PERMISSIONS[action] ?? ROLE_RANK.OWNER; // unknown action defaults to OWNER
  return userRank >= required;
};

/**
 * Express middleware factory.
 * Usage: requirePermission('inventory:product_write')
 */
export const requirePermission = (action: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const role: string = (req as any).user?.role;
    if (!role) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_002' });
    }
    if (!can(role, action)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action.',
        required: action,
        code: 'AUTH_004',
      });
    }
    next();
  };
