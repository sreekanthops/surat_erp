import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/db.js';
import { requireRole } from '../middleware/requireRole.js';

export const adminRouter = Router();

// All admin routes require OWNER or SUPER_ADMIN
adminRouter.use(requireRole('OWNER', 'SUPER_ADMIN'));

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
