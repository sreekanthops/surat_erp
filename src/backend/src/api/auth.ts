import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/db.js';
import { signToken, signRefreshToken, verifyToken } from '../services/jwt.js';

export const authRouter = Router();

// Login format: "groupname/username"
const loginSchema = z.object({
  login:    z.string().min(3).refine(v => v.includes('/'), { message: 'Login must be in format groupname/username' }),
  password: z.string().min(1),
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { login, password } = loginSchema.parse(req.body);

    const slashIdx  = login.indexOf('/');
    const groupName = login.slice(0, slashIdx).trim().toLowerCase();
    const username  = login.slice(slashIdx + 1).trim().toLowerCase();

    if (!groupName || !username) {
      return res.status(400).json({ error: 'Login must be in format groupname/username', code: 'AUTH_000' });
    }

    // Find group by name (case-insensitive) within any active tenant
    const group = await prisma.group.findFirst({
      where: { name: { equals: groupName, mode: 'insensitive' }, isActive: true },
      include: { tenant: { select: { id: true, name: true, plan: true, isActive: true } } },
    });

    if (!group) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });
    }

    if (!group.tenant.isActive) {
      return res.status(403).json({ error: 'Workspace is suspended. Contact your administrator.', code: 'AUTH_002' });
    }

    // Find user by username within that group
    const user = await prisma.user.findFirst({
      where: {
        groupId:  group.id,
        username: { equals: username, mode: 'insensitive' },
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });

    if (!user.isActive) return res.status(403).json({ error: 'Account inactive. Contact your administrator.', code: 'AUTH_003' });

    const token        = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, groupId: user.groupId ?? undefined });
    const refreshToken = signRefreshToken({ userId: user.id });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return res.json({
      token,
      refreshToken,
      user: {
        id:       user.id,
        name:     user.name,
        username: user.username,
        phone:    user.phone,
        role:     user.role,
        tenant:   group.tenant,
        group:    { id: group.id, name: group.name },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, username: true, phone: true, email: true, role: true, isActive: true,
        tenant: { select: { id: true, name: true, plan: true, isActive: true } },
        group:  { select: { id: true, name: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) { next(err); }
});

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const payload = verifyToken(refreshToken) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: true },
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    const newToken = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, groupId: user.groupId ?? undefined });
    return res.json({ token: newToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});
