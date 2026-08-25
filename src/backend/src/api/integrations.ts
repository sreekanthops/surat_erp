import { Router } from 'express';
import { prisma } from '../services/db.js';

export const integrationsRouter = Router();

// GET /api/v1/integrations/status
integrationsRouter.get('/status', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const configs = await prisma.integrationConfig.findMany({
      where: { tenantId },
      select: { type: true, isActive: true, lastSyncAt: true, syncStatus: true },
    });

    const statusMap = Object.fromEntries(configs.map((c) => [c.type.toLowerCase(), c]));

    return res.json({
      whatsapp: statusMap['whatsapp'] ?? { isActive: false },
      gmail: statusMap['gmail'] ?? { isActive: false },
      tally: statusMap['tally'] ?? { isActive: false },
      marg: statusMap['marg'] ?? { isActive: false },
      busy: statusMap['busy'] ?? { isActive: false },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/integrations/tally/sync
integrationsRouter.post('/tally/sync', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;

    // Import and enqueue the Tally sync job
    const { syncQueue } = await import('../workers/index.js');
    await syncQueue.add('tally-sync', { tenantId }, { priority: 1 });

    return res.json({ ok: true, message: 'Tally sync job queued' });
  } catch (err) {
    next(err);
  }
});
