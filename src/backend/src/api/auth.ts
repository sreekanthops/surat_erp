import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/db.js';
import { signToken, signRefreshToken, verifyToken } from '../services/jwt.js';

export const authRouter = Router();

const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(6),
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { tenant: { select: { id: true, name: true, plan: true, isActive: true } } },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'AUTH_001' });

    if (!user.isActive) return res.status(403).json({ error: 'Account inactive', code: 'AUTH_003' });

    const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        tenant: user.tenant,
      },
    });
  } catch (err) {
    next(err);
  }
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

    const newToken = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role });
    return res.json({ token: newToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});
