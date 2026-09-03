import { Router } from 'express';
import { prisma } from '../services/db.js';
import axios from 'axios';
import { google } from 'googleapis';
import { requireRole } from '../middleware/requireRole.js';

export const integrationsRouter = Router();

// Separate public router for the Gmail OAuth callback (no JWT — Google redirects here)
export const gmailCallbackRouter = Router();

// ── Gmail OAuth helpers ───────────────────────────────────────────────────────

// Read Google OAuth credentials from DB (per-tenant), fall back to .env
const GMAIL_CALLBACK = process.env.GOOGLE_REDIRECT_URI
  || `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/gmail/callback`;

async function getGoogleCreds(tenantId: string): Promise<{ clientId: string; clientSecret: string; redirectUri: string }> {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { tenantId, type: 'GMAIL' },
    select: { config: true },
  });
  const stored = (cfg?.config as any) || {};
  return {
    clientId:     stored.googleClientId     || process.env.GOOGLE_CLIENT_ID     || '',
    clientSecret: stored.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
    // Always use the canonical backend callback — never trust a stored value that may be stale
    redirectUri:  GMAIL_CALLBACK,
  };
}

async function getOAuthClient(tenantId: string) {
  const { clientId, clientSecret, redirectUri } = await getGoogleCreds(tenantId);
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Strip HTML tags, collapse whitespace
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Decode base64url Gmail body
function decodeBody(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

// Extract plain text or html from message parts recursively
function extractBody(parts: any[]): string {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) return decodeBody(part.body.data);
  }
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) return htmlToText(decodeBody(part.body.data));
  }
  for (const part of parts) {
    if (part.parts) {
      const found = extractBody(part.parts);
      if (found) return found;
    }
  }
  return '';
}

// ── GET /api/v1/integrations/app-credentials ─────────────────────────────────
// Returns the tenant's saved Google OAuth app credentials (clientId only — never secret)
// OWNER / MANAGER only
integrationsRouter.get('/app-credentials', requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const cfg = await prisma.integrationConfig.findFirst({
      where: { tenantId, type: 'GMAIL' },
      select: { config: true },
    });
    const stored = (cfg?.config as any) || {};
    // Always return the canonical URI — same one the backend will actually use
    const redirectUri = GMAIL_CALLBACK;
    return res.json({
      googleClientId:    stored.googleClientId || '',
      googleRedirectUri: redirectUri,
      hasClientSecret:   !!(stored.googleClientSecret),
    });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/v1/integrations/app-credentials ─────────────────────────────────
// Admin saves Google OAuth client credentials for this tenant
// OWNER / MANAGER only
integrationsRouter.put('/app-credentials', requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { googleClientId, googleClientSecret, googleRedirectUri } = req.body;

    if (!googleClientId) {
      return res.status(400).json({ error: 'googleClientId is required' });
    }

    // Merge into existing GMAIL config (preserving access/refresh tokens and existing secret)
    const existing = await prisma.integrationConfig.findFirst({ where: { tenantId, type: 'GMAIL' } });
    const existingConfig = (existing?.config as any) || {};

    // If no new secret provided, keep the stored one; if no stored one either, it's required
    const resolvedSecret = googleClientSecret || existingConfig.googleClientSecret || '';
    if (!resolvedSecret) {
      return res.status(400).json({ error: 'googleClientSecret is required (not yet saved)' });
    }

    await prisma.integrationConfig.upsert({
      where: { tenantId_type: { tenantId, type: 'GMAIL' } },
      update: {
        config: {
          ...existingConfig,
          googleClientId,
          googleClientSecret: resolvedSecret,
          googleRedirectUri: GMAIL_CALLBACK,   // always overwrite with canonical URI
        },
      },
      create: {
        tenantId, type: 'GMAIL', isActive: false,
        config: {
          googleClientId,
          googleClientSecret: resolvedSecret,
          googleRedirectUri: GMAIL_CALLBACK,
        },
      },
    });

    return res.json({ ok: true, googleRedirectUri: GMAIL_CALLBACK });
  } catch (err) {
    next(err);
  }
});

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
// OWNER / MANAGER only
integrationsRouter.post('/whatsapp/setup', requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN'), async (req, res, next) => {
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
integrationsRouter.delete('/whatsapp/disconnect', requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN'), async (req, res, next) => {
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

// ── GET /api/v1/integrations/gmail/connect ────────────────────────────────────
// Returns the Google OAuth URL for the user to visit and authorize
// OWNER / MANAGER only
integrationsRouter.get('/gmail/connect', requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { clientId } = await getGoogleCreds(tenantId);
    if (!clientId) return res.status(400).json({ error: 'Google OAuth credentials not configured. Go to Settings → Integrations → Google OAuth and save your Client ID and Secret first.' });
    const oauth2 = await getOAuthClient(tenantId);
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: tenantId,
    });
    return res.json({ url });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/integrations/gmail/callback ───────────────────────────────────
// Google redirects here after the user authorizes. Exchanges code for tokens.
// Mounted PUBLIC (before authMiddleware) in index.ts — no JWT present.
gmailCallbackRouter.get('/', async (req, res, next) => {
  try {
    const { code, state: tenantId, error } = req.query as Record<string, string>;
    if (error) return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/settings?error=${encodeURIComponent(error)}`);
    if (!code || !tenantId) return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/settings?error=missing_params`);

    const oauth2 = await getOAuthClient(tenantId);
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Get user email to display in UI
    const oauth2Info = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: profile } = await oauth2Info.userinfo.get();
    const email = profile.email || '';

    // Preserve existing google credentials (clientId, clientSecret) when saving tokens
    const existing = await prisma.integrationConfig.findFirst({ where: { tenantId, type: 'GMAIL' } });
    const existingConfig = (existing?.config as any) || {};

    await prisma.integrationConfig.upsert({
      where: { tenantId_type: { tenantId, type: 'GMAIL' } },
      update: {
        isActive: true, syncStatus: 'connected', lastSyncAt: new Date(),
        config: {
          ...existingConfig,
          email,
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token || existingConfig.refreshToken,
          expiryDate:   tokens.expiry_date,
        },
      },
      create: {
        tenantId, type: 'GMAIL', isActive: true, syncStatus: 'connected', lastSyncAt: new Date(),
        config: { email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiryDate: tokens.expiry_date },
      },
    });

    return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/settings?connected=1`);
  } catch (err: any) {
    const msg = err?.message || 'OAuth error';
    return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/settings?error=${encodeURIComponent(msg)}`);
  }
});

// ── DELETE /api/v1/integrations/gmail/disconnect ──────────────────────────────
integrationsRouter.delete('/gmail/disconnect', requireRole('OWNER', 'MANAGER', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    // Preserve google credentials (clientId/secret), only clear OAuth tokens
    const existing = await prisma.integrationConfig.findFirst({ where: { tenantId, type: 'GMAIL' } });
    const existingConfig = (existing?.config as any) || {};
    await prisma.integrationConfig.updateMany({
      where: { tenantId, type: 'GMAIL' },
      data: {
        isActive: false, syncStatus: 'disconnected',
        config: {
          googleClientId:     existingConfig.googleClientId    || '',
          googleClientSecret: existingConfig.googleClientSecret || '',
          googleRedirectUri:  existingConfig.googleRedirectUri  || '',
          // tokens cleared:
        },
      },
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/integrations/gmail/sync ─────────────────────────────────────
// Fetches latest emails from Gmail and stores them as Messages in the DB
integrationsRouter.post('/gmail/sync', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const maxResults = parseInt(String(req.query.max || '50'));

    const cfg = await prisma.integrationConfig.findFirst({ where: { tenantId, type: 'GMAIL', isActive: true } });
    if (!cfg) return res.status(400).json({ error: 'Gmail not connected. Connect Gmail first.' });

    const { accessToken, refreshToken, expiryDate, email: connectedEmail } = cfg.config as any;
    const oauth2 = await getOAuthClient(tenantId);
    oauth2.setCredentials({ access_token: accessToken, refresh_token: refreshToken, expiry_date: expiryDate });

    // Auto-refresh token
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);
    // Persist refreshed token
    if (credentials.access_token !== accessToken || credentials.refresh_token) {
      await prisma.integrationConfig.updateMany({
        where: { tenantId, type: 'GMAIL' },
        data: {
          lastSyncAt: new Date(),
          config: { email: connectedEmail, accessToken: credentials.access_token, refreshToken: credentials.refresh_token || refreshToken, expiryDate: credentials.expiry_date },
        },
      });
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });

    // Fetch list of message IDs — inbox only
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults,
      q: 'in:inbox',
    });

    const ids = (listRes.data.messages || []).map((m: any) => m.id as string);
    if (ids.length === 0) return res.json({ synced: 0, total: 0 });

    // Check which message IDs are already stored
    const existing = await prisma.message.findMany({
      where: { tenantId, channel: 'GMAIL', externalId: { in: ids } },
      select: { externalId: true },
    });
    const existingIds = new Set(existing.map((m) => m.externalId));
    const newIds = ids.filter((id) => !existingIds.has(id));

    let synced = 0;
    for (const msgId of newIds.slice(0, 30)) {
      try {
        const detail = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' });
        const msg = detail.data;
        const headers: Record<string, string> = {};
        for (const h of (msg.payload?.headers || [])) {
          headers[(h.name || '').toLowerCase()] = h.value || '';
        }

        const from    = headers['from'] || '';
        const subject = headers['subject'] || '(no subject)';
        const date    = headers['date'] || '';
        const threadId = msg.threadId || msgId;

        // Extract body
        let body = '';
        if (msg.payload?.parts) {
          body = extractBody(msg.payload.parts);
        } else if (msg.payload?.body?.data) {
          const raw = decodeBody(msg.payload.body.data);
          body = msg.payload.mimeType === 'text/html' ? htmlToText(raw) : raw;
        }
        if (!body) body = msg.snippet || '';

        // Trim to 2000 chars for storage
        body = body.slice(0, 2000);

        // Parse from address: "Name <email@domain.com>"
        const fromEmail = (from.match(/<([^>]+)>/) || [])[1] || from.trim();
        const fromName  = (from.match(/^([^<]+)</) || [])[1]?.trim() || fromEmail;

        // Find or create party by email
        let party = await prisma.party.findFirst({ where: { tenantId, email: fromEmail } });
        if (!party && fromEmail && fromEmail !== connectedEmail) {
          party = await prisma.party.upsert({
            where: { id: '00000000-0000-0000-0000-000000000000' }, // dummy — always goes to create
            update: {},
            create: { tenantId, name: fromName || fromEmail, email: fromEmail, type: 'CUSTOMER' },
          }).catch(() => null);
          if (!party) {
            party = await prisma.party.findFirst({ where: { tenantId, email: fromEmail } });
          }
        }

        await prisma.message.create({
          data: {
            tenantId,
            partyId:     party?.id,
            channel:     'GMAIL',
            direction:   'INBOUND',
            fromAddress: fromEmail,
            toAddress:   connectedEmail,
            subject,
            content:     body,
            threadId,
            externalId:  msgId,
            isRead:      !(msg.labelIds || []).includes('UNREAD'),
            createdAt:   new Date(date) || new Date(),
          },
        });
        synced++;
      } catch (e: any) {
        // Skip individual message errors
        console.warn(`Gmail sync skip ${msgId}:`, e?.message);
      }
    }

    return res.json({ synced, total: ids.length, skipped: ids.length - synced });
  } catch (err: any) {
    if (err?.code === 401 || err?.status === 401) {
      await prisma.integrationConfig.updateMany({ where: { tenantId: (req as any).user.tenantId, type: 'GMAIL' }, data: { isActive: false, syncStatus: 'token_expired' } });
      return res.status(401).json({ error: 'Gmail token expired. Please reconnect.' });
    }
    next(err);
  }
});

// ── POST /api/v1/integrations/gmail/reply ─────────────────────────────────────
// Send a reply email via the connected Gmail account
integrationsRouter.post('/gmail/reply', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { to, subject, body, threadId, inReplyTo } = req.body;
    if (!to || !body) return res.status(400).json({ error: 'to and body are required' });

    const cfg = await prisma.integrationConfig.findFirst({ where: { tenantId, type: 'GMAIL', isActive: true } });
    if (!cfg) return res.status(400).json({ error: 'Gmail not connected' });

    const { accessToken, refreshToken, expiryDate, email: connectedEmail } = cfg.config as any;
    const oauth2 = await getOAuthClient(tenantId);
    oauth2.setCredentials({ access_token: accessToken, refresh_token: refreshToken, expiry_date: expiryDate });
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);

    const gmail = google.gmail({ version: 'v1', auth: oauth2 });

    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    const raw = [
      `From: ${connectedEmail}`,
      `To: ${to}`,
      `Subject: ${replySubject}`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
      inReplyTo ? `References: ${inReplyTo}` : '',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].filter(Boolean).join('\r\n');

    const encoded = Buffer.from(raw).toString('base64url');
    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, threadId: threadId || undefined },
    });

    // Store outbound message
    await prisma.message.create({
      data: {
        tenantId, channel: 'GMAIL', direction: 'OUTBOUND',
        fromAddress: connectedEmail, toAddress: to,
        subject: replySubject, content: body,
        threadId: sent.data.threadId || threadId,
        externalId: sent.data.id || undefined,
        isRead: true, isReplied: true,
      },
    });

    return res.json({ ok: true, messageId: sent.data.id });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/integrations/gmail/inbox ─────────────────────────────────────
// Paginated list of Gmail messages stored in DB
integrationsRouter.get('/gmail/inbox', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { page = '1', limit = '30', unread, search } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { tenantId, channel: 'GMAIL', direction: 'INBOUND' };
    if (unread === 'true') where.isRead = false;
    if (search?.trim()) {
      where.OR = [
        { subject:     { contains: search, mode: 'insensitive' } },
        { fromAddress: { contains: search, mode: 'insensitive' } },
        { content:     { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: { party: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.message.count({ where }),
    ]);

    return res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});
