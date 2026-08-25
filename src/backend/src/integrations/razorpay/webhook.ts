import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../../services/db.js';

export const razorpayWebhookRouter = Router();

razorpayWebhookRouter.post('/', async (req, res) => {
  try {
    const sig = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');

    if (sig !== expected) return res.sendStatus(400);

    const { event, payload } = req.body;
    const tenantId = payload?.subscription?.entity?.notes?.tenant_id;
    if (!tenantId) return res.sendStatus(200);

    if (event === 'subscription.activated') {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: true, planExpiresAt: new Date(Date.now() + 31 * 86400000) },
      });
    } else if (event === 'subscription.halted' || event === 'subscription.cancelled') {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: false },
      });
    } else if (event === 'subscription.charged') {
      // Extend expiry by 30 days
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { planExpiresAt: new Date(Date.now() + 31 * 86400000) },
      });
    }

    return res.sendStatus(200);
  } catch {
    return res.sendStatus(200);
  }
});
