import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/db.js';
import { requirePermission } from '../middleware/permissions.js';

export const usersRouter = Router();

// GET /api/v1/users  — list all users in this tenant (MANAGER+)
usersRouter.get('/', requirePermission('users:view'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, phone: true, email: true,
        role: true, isActive: true, lastLoginAt: true, createdAt: true,
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ data: users, total: users.length });
  } catch (err) { next(err); }
});

const createUserSchema = z.object({
  name:     z.string().min(1),
  phone:    z.string().min(10),
  email:    z.string().email().optional(),
  password: z.string().min(6),
  role:     z.enum(['MANAGER', 'ACCOUNTANT', 'STAFF', 'READONLY']).default('STAFF'),
  groupId:  z.string().uuid().optional(),
});

// POST /api/v1/users  — create a new team member (MANAGER+ but cannot create OWNER)
usersRouter.post('/', requirePermission('users:write'), async (req, res, next) => {
  try {
    const tenantId  = (req as any).user.tenantId;
    const callerRole = (req as any).user.role as string;
    const body = createUserSchema.parse(req.body);

    // Managers cannot create other Managers — only Owner+ can
    if (body.role === 'MANAGER' && !['OWNER', 'SUPER_ADMIN'].includes(callerRole)) {
      return res.status(403).json({ error: 'Only an Owner can create Manager accounts.' });
    }

    const existing = await prisma.user.findUnique({ where: { phone: body.phone } });
    if (existing) return res.status(409).json({ error: 'A user with this phone number already exists.' });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId,
        name:  body.name,
        phone: body.phone,
        email: body.email,
        passwordHash,
        role:    body.role as any,
        groupId: body.groupId,
      },
      select: {
        id: true, name: true, phone: true, email: true,
        role: true, isActive: true, createdAt: true,
        group: { select: { id: true, name: true } },
      },
    });
    return res.status(201).json(user);
  } catch (err) { next(err); }
});

const updateUserSchema = z.object({
  name:    z.string().min(1).optional(),
  email:   z.string().email().optional(),
  role:    z.enum(['MANAGER', 'ACCOUNTANT', 'STAFF', 'READONLY']).optional(),
  groupId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

// PUT /api/v1/users/:id  — update user (MANAGER+; cannot modify OWNER)
usersRouter.put('/:id', requirePermission('users:write'), async (req, res, next) => {
  try {
    const tenantId   = (req as any).user.tenantId;
    const callerId   = (req as any).user.userId;
    const callerRole = (req as any).user.role as string;
    const body = updateUserSchema.parse(req.body);

    const target = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Cannot modify the Owner unless you ARE the owner
    if (target.role === 'OWNER' && callerId !== target.id) {
      return res.status(403).json({ error: 'Cannot modify the Owner account.' });
    }
    // Cannot promote to Manager unless caller is Owner+
    if (body.role === 'MANAGER' && !['OWNER', 'SUPER_ADMIN'].includes(callerRole)) {
      return res.status(403).json({ error: 'Only an Owner can assign the Manager role.' });
    }

    const data: any = { ...body };
    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 12);
      delete data.password;
    }

    await prisma.user.update({ where: { id: req.params.id }, data });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/users/:id  — deactivate (soft) or hard-delete (OWNER only)
usersRouter.delete('/:id', requirePermission('users:delete'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const callerId = (req as any).user.userId;
    const target = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === callerId) return res.status(400).json({ error: 'You cannot delete your own account.' });
    if (target.role === 'OWNER') return res.status(403).json({ error: 'The Owner account cannot be deleted.' });
    // Soft-delete: just deactivate
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});
