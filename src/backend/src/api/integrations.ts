import { Router } from 'express';
import { prisma } from '../services/db.js';
import axios from 'axios';

export const integrationsRouter = Router();

// ── GET /api/v1/integrations/status ──────────────────────────────────────────
integrationsRouter.get('/status', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const configs = await prisma.integrationConfig.findMany({
      where: { tenantId },
      select: { type: true, isActive: true, lastSyncAt: true, syncStatus: true, config: true },
    });

    const statusMap = Object.fromEntries(configs.map((c) => [c.type.toLowerCase(), c]));

    // Strip sensitive fields from config before sending to frontend
    const safeWa = statusMap['whatsapp'];
    if (safeWa?.config) {
      const cfg = safeWa.config as any;
      safeWa.config = {
        displayPhone: cfg.displayPhone || '',
        phoneNumberId: cfg.phoneNumberId || '',
        wabaId: cfg.wabaId || '',
        hasToken: !!cfg.accessToken,
        hasAppSecret: !!cfg.appSecret,
        verifyToken: cfg.verifyToken || '',
      };
    }

    return res.json({
      whatsapp: safeWa ?? { isActive: false, config: {} },
      gmail: statusMap['gmail'] ?? { isActive: false },
      tally: statusMap['tally'] ?? { isActive: false },
      marg: statusMap['marg'] ?? { isActive: false },
      busy: statusMap['busy'] ?? { isActive: false },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/integrations/whatsapp/setup ─────────────────────────────────
// Save WhatsApp Business credentials. Verifies the token against Meta API.
integrationsRouter.post('/whatsapp/setup', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { displayPhone, phoneNumberId, wabaId, accessToken, appSecret, verifyToken } = req.body;

    if (!phoneNumberId || !accessToken || !wabaId) {
      return res.status(400).json({ error: 'phoneNumberId, wabaId, and accessToken are required' });
    }

    // Verify the credentials against Meta Graph API before saving
    let metaPhone = '';
    try {
      const verifyRes = await axios.get(
        `https://graph.facebook.com/v19.0/${phoneNumberId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { fields: 'display_phone_number,verified_name,quality_rating' },
          timeout: 8000,
        },
      );
      metaPhone = verifyRes.data.display_phone_number || displayPhone;
    } catch (metaErr: any) {
      const detail = metaErr?.response?.data?.error?.message || 'Could not verify with Meta';
      return res.status(400).json({ error: `Meta API verification failed: ${detail}` });
    }

    // Upsert the integration config
    const config = await prisma.integrationConfig.upsert({
      where: { tenantId_type: { tenantId, type: 'WHATSAPP' } },
      update: {
        isActive: true,
        syncStatus: 'connected',
        lastSyncAt: new Date(),
        config: {
          displayPhone: metaPhone || displayPhone,
          phoneNumberId,
          wabaId,
          accessToken,          // stored server-side only
          appSecret: appSecret || '',
          verifyToken: verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'gspaces-wa-token',
        },
      },
      create: {
        tenantId,
        type: 'WHATSAPP',
        isActive: true,
        syncStatus: 'connected',
        lastSyncAt: new Date(),
        config: {
          displayPhone: metaPhone || displayPhone,
          phoneNumberId,
          wabaId,
          accessToken,
          appSecret: appSecret || '',
          verifyToken: verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'gspaces-wa-token',
        },
      },
    });

    return res.json({
      ok: true,
      displayPhone: metaPhone || displayPhone,
      phoneNumberId,
      wabaId,
      message: `WhatsApp connected: ${metaPhone || displayPhone}`,
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/integrations/whatsapp/disconnect ──────────────────────────
integrationsRouter.delete('/whatsapp/disconnect', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    await prisma.integrationConfig.updateMany({
      where: { tenantId, type: 'WHATSAPP' },
      data: { isActive: false, syncStatus: 'disconnected' },
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/integrations/whatsapp/test ──────────────────────────────────
// Send a test WhatsApp message to the owner's own number to confirm it works
integrationsRouter.post('/whatsapp/test', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { toPhone } = req.body; // number to send test message to

    const cfg = await prisma.integrationConfig.findFirst({
      where: { tenantId, type: 'WHATSAPP', isActive: true },
    });
    if (!cfg) return res.status(400).json({ error: 'WhatsApp not connected' });

    const { phoneNumberId, accessToken } = cfg.config as any;
    const target = (toPhone || '').replace(/\D/g, '');
    if (!target) return res.status(400).json({ error: 'toPhone required' });

    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v25.0';
    await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: target,
        type: 'text',
        text: { body: '✅ GSpaces TextileIQ — WhatsApp connection test successful! Your messages will now appear in the Inbox automatically.' },
      },
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      },
    );

    return res.json({ ok: true, message: `Test message sent to +${target}` });
  } catch (err: any) {
    const detail = err?.response?.data?.error?.message || err?.message;
    return res.status(400).json({ error: detail });
  }
});

// ── POST /api/v1/integrations/tally/sync ─────────────────────────────────────
integrationsRouter.post('/tally/sync', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { syncQueue } = await import('../workers/index.js');
    await syncQueue.add('tally-sync', { tenantId }, { priority: 1 });
    return res.json({ ok: true, message: 'Tally sync job queued' });
  } catch (err) {
    next(err);
  }
});
