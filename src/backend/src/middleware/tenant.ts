import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/db.js';

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: 'No tenant context', code: 'AUTH_001' });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true, isActive: true, planExpiresAt: true },
  });

  if (!tenant || !tenant.isActive) {
    return res.status(403).json({ error: 'Tenant inactive or not found', code: 'TENANT_002' });
  }

  if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
    return res.status(403).json({ error: 'Subscription expired', code: 'TENANT_002' });
  }

  (req as any).tenant = tenant;
  next();
};
