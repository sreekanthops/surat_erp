import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../../services/db.js';
import { logger } from '../../services/logger.js';
import { io } from '../../index.js';
import axios from 'axios';

export const whatsappWebhookRouter = Router();

// ── Helper: AI extraction ─────────────────────────────────────────────────────
async function extractIntent(content: string) {
  let aiIntent = 'general';
  let aiEntities: any = {};
  let aiLanguage = 'hi';
  let aiSentiment = 'neutral';
  let isPotentialCustomer = false;
  let customerScore = 0;
  let customerSignals: string[] = [];

  try {
    const r = await axios.post(
      `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/ai/extract-message-entities`,
      { content, type: 'text' },
      { timeout: 8000 },
    );
    aiIntent            = r.data.intent;
    aiEntities          = r.data.entities || {};
    aiLanguage          = r.data.language;
    aiSentiment         = r.data.sentiment || 'neutral';
    isPotentialCustomer = r.data.is_potential_customer || false;
    customerScore       = r.data.customer_score || 0;
    customerSignals     = r.data.customer_signals || [];
  } catch {
    // keyword fallback
    if (/rate|price|kitna|quote|cost/i.test(content))        { aiIntent = 'quote_request';   isPotentialCustomer = true; customerScore = 55; customerSignals = ['asking price/rate']; }
    else if (/confirm|order|bhejo/i.test(content))           { aiIntent = 'order_confirm';   isPotentialCustomer = true; customerScore = 70; customerSignals = ['order intent']; }
    else if (/catalogue|catalog|list/i.test(content))        { aiIntent = 'catalogue_request'; isPotentialCustomer = true; customerScore = 45; customerSignals = ['catalogue request']; }
    else if (/bulk|wholesale|meter|kg/i.test(content))       { aiIntent = 'bulk_inquiry';    isPotentialCustomer = true; customerScore = 50; customerSignals = ['bulk inquiry']; }
  }
  return { aiIntent, aiEntities, aiLanguage, aiSentiment, isPotentialCustomer, customerScore, customerSignals };
}

// ── Webhook verification (GET) — Meta challenge ───────────────────────────────
whatsappWebhookRouter.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'gspaces-wa-token-changeme';
  logger.info(`[WA Webhook] verify — mode:${mode} match:${token === expectedToken}`);

  if (mode === 'subscribe' && token === expectedToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ── Incoming messages (POST) — process directly, no queue needed ──────────────
whatsappWebhookRouter.post('/', async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    // Optional HMAC verification
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const sig      = req.headers['x-hub-signature-256'] as string;
      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(JSON.stringify(body)).digest('hex');
      if (sig !== expected) { logger.warn('[WA Webhook] HMAC mismatch'); return; }
    }

    logger.info(`[WA Webhook] raw body: ${JSON.stringify(body).slice(0, 400)}`);

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue;

        const value       = change.value;
        const phoneNumId  = value?.metadata?.phone_number_id;

        logger.info(`[WA Webhook] phoneNumId from Meta: "${phoneNumId}"`);

        // Find tenant — try exact match first, then fallback to any active WHATSAPP config
        let integration = await prisma.integrationConfig.findFirst({
          where: { type: 'WHATSAPP', isActive: true, config: { path: ['phoneNumberId'], equals: phoneNumId } },
        });
        if (!integration) {
          // Fallback: use the only active WhatsApp config for this server
          integration = await prisma.integrationConfig.findFirst({
            where: { type: 'WHATSAPP', isActive: true },
          });
          logger.warn(`[WA Webhook] phoneNumId "${phoneNumId}" not matched — falling back to first active config`);
        }
        if (!integration) {
          logger.warn(`[WA Webhook] No active WhatsApp integration found at all`);
          continue;
        }
        const tenantId = integration.tenantId;

        // Skip if this is only a status update (delivery receipt) — no messages to process
        if (!value.messages?.length) {
          logger.info(`[WA Webhook] status update only (delivery receipt) — skipping`);
          continue;
        }

        for (const msg of (value.messages || [])) {
          if (msg.type !== 'text') {
            logger.info(`[WA Webhook] skipping non-text message type: ${msg.type}`);
            continue;
          }

          const from       = msg.from as string;
          const content    = msg.text?.body as string || '';
          const externalId = msg.id as string;
          const senderName = value.contacts?.find((c: any) => c.wa_id === from)?.profile?.name as string | undefined;

          logger.info(`[WA Webhook] ✅ incoming from ${from} — "${content.slice(0, 60)}"`);

          // Find or create party
          let party = await prisma.party.findFirst({ where: { tenantId, whatsapp: from } });
          if (!party) {
            party = await prisma.party.create({
              data: { tenantId, name: senderName || from, phone: from, whatsapp: from, type: 'CUSTOMER' },
            });
          } else if (senderName && party.name === party.phone) {
            party = await prisma.party.update({ where: { id: party.id }, data: { name: senderName } });
          }

          // AI extraction
          const { aiIntent, aiEntities, aiLanguage, aiSentiment, isPotentialCustomer, customerScore, customerSignals } =
            await extractIntent(content);

          // Save message
          const message = await prisma.message.create({
            data: {
              tenantId,
              partyId:    party.id,
              channel:    'WHATSAPP',
              direction:  'INBOUND',
              fromAddress: from,
              content,
              externalId,
              aiIntent,
              aiEntities: { ...aiEntities, customerScore, customerSignals },
              aiLanguage,
              aiSentiment,
              isRead: false,
            },
          });

          // Auto-create lead for buying signals
          const leadIntents = ['quote_request', 'new_customer_inquiry', 'bulk_inquiry', 'sample_request', 'order_confirm'];
          if (leadIntents.includes(aiIntent) || isPotentialCustomer) {
            const existing = await prisma.lead.findFirst({
              where: { tenantId, partyId: party.id, source: 'WHATSAPP', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
            });
            if (!existing) {
              await prisma.lead.create({
                data: {
                  tenantId,
                  partyId:        party.id,
                  sourceMessageId: message.id,
                  source:         'WHATSAPP',
                  status:         'NEW',
                  title:          `WhatsApp — ${(aiEntities as any).product || aiIntent.replace('_', ' ')} — ${new Date().toLocaleDateString('en-IN')}`,
                  productInterest: (aiEntities as any).product,
                  notes:          customerSignals.length ? `Signals: ${customerSignals.join(', ')}` : undefined,
                },
              });
              logger.info(`[WA Webhook] Lead created for ${party.name} — ${aiIntent}`);
            }
          }

          // Push real-time to frontend
          io.to(`tenant:${tenantId}`).emit('new_whatsapp_message', {
            messageId: message.id,
            from,
            partyName:           party.name,
            intent:              aiIntent,
            isPotentialCustomer,
            customerScore,
            leadCreated:         false,
          });

          logger.info(`[WA Webhook] saved message ${message.id} — intent:${aiIntent} score:${customerScore}`);
        }
      }
    }
  } catch (err) {
    logger.error('[WA Webhook] error', { err });
  }
});
