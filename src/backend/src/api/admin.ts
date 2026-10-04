import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/db.js';
import { requireRole } from '../middleware/requireRole.js';

export const adminRouter = Router();

// All admin routes require OWNER or SUPER_ADMIN
adminRouter.use(requireRole('OWNER', 'SUPER_ADMIN'));

// ─────────────────────────────────────────────
// TENANT MANAGEMENT (SUPER_ADMIN only)
// ─────────────────────────────────────────────

// GET /api/v1/admin/tenants — list all tenants (SUPER_ADMIN only)
adminRouter.get('/tenants', requireRole('SUPER_ADMIN'), async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true, name: true, gstin: true, city: true, state: true,
        phone: true, email: true, plan: true, isActive: true,
        planExpiresAt: true, createdAt: true,
        _count: { select: { users: true } },
        users: {
          where: { role: 'OWNER' },
          select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, lastLoginAt: true },
          take: 1,
        },
        integrationConfigs: {
          select: { type: true, isActive: true, lastSyncAt: true, config: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // For each tenant, build a safe summary — strip tokens from config
    const safe = tenants.map(t => ({
      ...t,
      integrationConfigs: t.integrationConfigs.map(cfg => ({
        type: cfg.type,
        isActive: cfg.isActive,
        lastSyncAt: cfg.lastSyncAt,
        email: (cfg.config as any)?.email ?? null,
      })),
    }));

    return res.json({ data: safe });
  } catch (err) { next(err); }
});

const createTenantSchema = z.object({
  // Tenant details
  companyName:   z.string().min(1),
  gstin:         z.string().optional(),
  city:          z.string().default('Surat'),
  state:         z.string().default('Gujarat'),
  phone:         z.string().optional(),
  email:         z.string().email().optional(),
  plan:          z.enum(['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']).default('STARTER'),
  planDays:      z.number().default(30),
  // Default group name (login prefix for all users in this tenant)
  groupName:     z.string().min(1),
  // First OWNER user
  ownerName:     z.string().min(1),
  ownerUsername: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  ownerPhone:    z.string().optional(),
  ownerEmail:    z.string().email().optional(),
  ownerPassword: z.string().min(6),
});

// POST /api/v1/admin/tenants — create a new client tenant + default group + owner (SUPER_ADMIN only)
adminRouter.post('/tenants', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const body = createTenantSchema.parse(req.body);

    const planExpiresAt = new Date();
    planExpiresAt.setDate(planExpiresAt.getDate() + body.planDays);

    const passwordHash = await bcrypt.hash(body.ownerPassword, 10);

    // Create tenant + default group + owner in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name:          body.companyName,
          gstin:         body.gstin,
          city:          body.city,
          state:         body.state,
          phone:         body.phone,
          email:         body.email,
          plan:          body.plan as any,
          planExpiresAt,
          isActive:      true,
          settings:      {},
        },
      });

      // Create the default group (login prefix)
      const group = await tx.group.create({
        data: {
          tenantId:    tenant.id,
          name:        body.groupName.toLowerCase(),
          description: `Default group for ${body.companyName}`,
          isActive:    true,
        },
      });

      const owner = await tx.user.create({
        data: {
          tenantId:     tenant.id,
          groupId:      group.id,
          name:         body.ownerName,
          username:     body.ownerUsername.toLowerCase(),
          phone:        body.ownerPhone || null,
          email:        body.ownerEmail,
          passwordHash,
          role:         'OWNER',
          isActive:     true,
        },
        select: { id: true, name: true, username: true, phone: true, email: true, role: true },
      });

      return { tenant, group, owner };
    });

    return res.status(201).json(result);
  } catch (err) { next(err); }
});

// PATCH /api/v1/admin/tenants/:id — toggle active / update plan (SUPER_ADMIN only)
adminRouter.patch('/tenants/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const schema = z.object({
      isActive:      z.boolean().optional(),
      plan:          z.enum(['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']).optional(),
      planDays:      z.number().optional(),
    });
    const body = schema.parse(req.body);
    const data: any = {};
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.plan)     data.plan = body.plan;
    if (body.planDays) { const d = new Date(); d.setDate(d.getDate() + body.planDays); data.planExpiresAt = d; }

    await prisma.tenant.update({ where: { id: req.params.id }, data });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// GROUPS
// ─────────────────────────────────────────────

// GET /api/v1/admin/groups
adminRouter.get('/groups', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groups = await prisma.group.findMany({
      where: { tenantId },
      include: {
        _count: { select: { users: true } },
        users: {
          select: { id: true, name: true, phone: true, role: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ data: groups });
  } catch (err) {
    next(err);
  }
});

const groupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
});

// POST /api/v1/admin/groups
adminRouter.post('/groups', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const body = groupSchema.parse(req.body);
    const group = await prisma.group.create({
      data: { tenantId, ...body },
    });
    return res.status(201).json(group);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/admin/groups/:id
adminRouter.put('/groups/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const body = groupSchema.partial().parse(req.body);
    const group = await prisma.group.updateMany({
      where: { id: req.params.id, tenantId },
      data: body,
    });
    if (!group.count) return res.status(404).json({ error: 'Group not found' });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/groups/:id
adminRouter.delete('/groups/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    // Unlink users first
    await prisma.user.updateMany({
      where: { groupId: req.params.id, tenantId },
      data: { groupId: null },
    });
    const result = await prisma.group.deleteMany({
      where: { id: req.params.id, tenantId },
    });
    if (!result.count) return res.status(404).json({ error: 'Group not found' });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────

// GET /api/v1/admin/users
adminRouter.get('/users', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        groupId: true,
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6),
  role: z.enum(['OWNER', 'MANAGER', 'ACCOUNTANT', 'STAFF', 'READONLY']).default('STAFF'),
  groupId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

// POST /api/v1/admin/users
adminRouter.post('/users', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const body = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { phone: body.phone } });
    if (existing) return res.status(409).json({ error: 'Phone number already in use' });

    const passwordHash = await bcrypt.hash(body.password, 10);
    const { password, ...rest } = body;

    // Validate groupId belongs to same tenant
    if (rest.groupId) {
      const group = await prisma.group.findFirst({ where: { id: rest.groupId, tenantId } });
      if (!group) return res.status(400).json({ error: 'Group not found in this tenant' });
    }

    const user = await prisma.user.create({
      data: { tenantId, passwordHash, ...rest },
      select: { id: true, name: true, phone: true, role: true, isActive: true, groupId: true },
    });
    return res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['OWNER', 'MANAGER', 'ACCOUNTANT', 'STAFF', 'READONLY']).optional(),
  groupId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// PUT /api/v1/admin/users/:id
adminRouter.put('/users/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const callerId = (req as any).user.userId;
    const body = updateUserSchema.parse(req.body);

    // Prevent owner from deactivating themselves
    if (req.params.id === callerId && body.isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    // Validate groupId belongs to same tenant
    if (body.groupId) {
      const group = await prisma.group.findFirst({ where: { id: body.groupId, tenantId } });
      if (!group) return res.status(400).json({ error: 'Group not found in this tenant' });
    }

    const { password, ...rest } = body;
    const data: Record<string, any> = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await prisma.user.updateMany({
      where: { id: req.params.id, tenantId },
      data,
    });
    if (!result.count) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/users/:id/toggle-active  (convenience endpoint)
adminRouter.patch('/users/:id/toggle-active', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const callerId = (req as any).user.userId;
    if (req.params.id === callerId) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });
    return res.json({ ok: true, isActive: !user.isActive });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/users/:id
adminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const callerId = (req as any).user.userId;
    if (req.params.id === callerId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const result = await prisma.user.deleteMany({
      where: { id: req.params.id, tenantId },
    });
    if (!result.count) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// GROUP MEMBERSHIP (assign/unassign users)
// ─────────────────────────────────────────────

// POST /api/v1/admin/groups/:id/members  { userIds: string[] }
adminRouter.post('/groups/:id/members', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { userIds } = z.object({ userIds: z.array(z.string().uuid()) }).parse(req.body);

    const group = await prisma.group.findFirst({ where: { id: req.params.id, tenantId } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    await prisma.user.updateMany({
      where: { id: { in: userIds }, tenantId },
      data: { groupId: req.params.id },
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/admin/groups/:id/members/:userId
adminRouter.delete('/groups/:id/members/:userId', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const result = await prisma.user.updateMany({
      where: { id: req.params.userId, tenantId, groupId: req.params.id },
      data: { groupId: null },
    });
    if (!result.count) return res.status(404).json({ error: 'User not in group or not found' });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
