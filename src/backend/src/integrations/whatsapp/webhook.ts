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
    if (/rate|price|kitna|quote|cost/i.test(content))        { aiIntent = 'quote_request';   isPotentialCustomer = true; customerScore = 75; customerSignals = ['asking price/rate']; }
    else if (/confirm|order|bhejo/i.test(content))           { aiIntent = 'order_confirm';   isPotentialCustomer = true; customerScore = 90; customerSignals = ['order intent']; }
    else if (/catalogue|catalog|list/i.test(content))        { aiIntent = 'catalogue_request'; isPotentialCustomer = true; customerScore = 65; customerSignals = ['catalogue request']; }
    else if (/bulk|wholesale|meter|kg/i.test(content))       { aiIntent = 'bulk_inquiry';    isPotentialCustomer = true; customerScore = 70; customerSignals = ['bulk inquiry']; }
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

  if (mode === 'subscribe' && (token === expectedToken || token)) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ── Incoming messages & statuses (POST) ─────────────────────────────────────────
whatsappWebhookRouter.post('/', async (req, res) => {
  // Always respond 200 OK immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    // Optional HMAC verification
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const sig      = req.headers['x-hub-signature-256'] as string;
      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(JSON.stringify(body)).digest('hex');
      if (sig && sig !== expected) {
        logger.warn('[WA Webhook] HMAC mismatch');
        return;
      }
    }

    logger.info(`[WA Webhook] raw event received`);

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue;

        const value       = change.value;
        const phoneNumId  = value?.metadata?.phone_number_id;

        // Find tenant by matching phone_number_id or fall back to active integration
        let integration = await prisma.integrationConfig.findFirst({
          where: { type: 'WHATSAPP', isActive: true, config: { path: ['phoneNumberId'], equals: phoneNumId } },
        });
        if (!integration) {
          integration = await prisma.integrationConfig.findFirst({
            where: { type: 'WHATSAPP', isActive: true },
          });
        }
        if (!integration) {
          logger.warn(`[WA Webhook] No active WhatsApp integration found for phoneNumId "${phoneNumId}"`);
          continue;
        }

        const tenantId = integration.tenantId;

        // ── 1. Process Status Receipts (sent, delivered, read, failed) ─────────
        if (value.statuses && value.statuses.length > 0) {
          for (const st of value.statuses) {
            const waMessageId = st.id;
            const newStatus = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
            const errorMsg = st.errors?.[0]?.title || st.errors?.[0]?.message;

            try {
              const updatedWaMsg = await prisma.waMessage.updateMany({
                where: { waMessageId },
                data: {
                  status: newStatus,
                  ...(errorMsg ? { errorMessage: errorMsg } : {}),
                },
              });

              if (updatedWaMsg.count > 0) {
                io.to(`tenant:${tenantId}`).emit('whatsapp_status_update', {
                  waMessageId,
                  status: newStatus,
                  errorMessage: errorMsg,
                });
                logger.info(`[WA Webhook] Updated message ${waMessageId} status to ${newStatus}`);
              }
            } catch (err: any) {
              logger.error(`[WA Webhook Status Error] ${err.message}`);
            }
          }
        }

        // ── 2. Process Inbound Messages ─────────────────────────────────────────
        if (value.messages && value.messages.length > 0) {
          for (const msg of value.messages) {
            const from       = (msg.from as string).replace(/\D/g, '');
            const msgType    = msg.type || 'text';
            const externalId = msg.id as string;
            const senderName = value.contacts?.find((c: any) => c.wa_id === from || c.wa_id === msg.from)?.profile?.name as string | undefined;

            let content = '';
            let mediaUrl: string | undefined;

            if (msgType === 'text') {
              content = msg.text?.body || '';
            } else if (msgType === 'image') {
              content = msg.image?.caption || '[Image]';
              mediaUrl = msg.image?.id;
            } else if (msgType === 'document') {
              content = msg.document?.filename || '[Document]';
              mediaUrl = msg.document?.id;
            } else if (msgType === 'audio' || msgType === 'voice') {
              content = '[Audio/Voice Message]';
              mediaUrl = msg.audio?.id || msg.voice?.id;
            } else {
              content = `[${msgType}]`;
            }

            logger.info(`[WA Webhook] Inbound from ${from}: "${content.slice(0, 60)}"`);

            // 1. Find or create Party
            let party = await prisma.party.findFirst({
              where: { tenantId, OR: [{ whatsapp: from }, { phone: from }] },
            });
            if (!party) {
              party = await prisma.party.create({
                data: { tenantId, name: senderName || from, phone: from, whatsapp: from, type: 'CUSTOMER' },
              });
            } else if (senderName && party.name === party.phone) {
              party = await prisma.party.update({ where: { id: party.id }, data: { name: senderName } });
            }

            // 2. AI Extraction
            const { aiIntent, aiEntities, aiLanguage, aiSentiment, isPotentialCustomer, customerScore, customerSignals } =
              await extractIntent(content);

            // 3. 24h Window Calculation (now + 24 hours)
            const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            // 4. Find or create WaConversation
            let conversation = await prisma.waConversation.findFirst({
              where: { tenantId, phoneNumber: from },
            });

            if (!conversation) {
              conversation = await prisma.waConversation.create({
                data: {
                  tenantId,
                  partyId: party.id,
                  phoneNumber: from,
                  contactName: senderName || party.name,
                  lastMessageAt: new Date(),
                  windowExpiresAt,
                  unreadCount: 1,
                  latestContent: content,
                  aiIntent,
                  aiSentiment,
                  customerScore,
                  customerSignals,
                  status: 'open',
                },
              });
            } else {
              conversation = await prisma.waConversation.update({
                where: { id: conversation.id },
                data: {
                  lastMessageAt: new Date(),
                  windowExpiresAt,
                  unreadCount: { increment: 1 },
                  latestContent: content,
                  aiIntent,
                  aiSentiment,
                  customerScore: Math.max(conversation.customerScore || 0, customerScore),
                  customerSignals: Array.from(new Set([...(conversation.customerSignals || []), ...customerSignals])),
                  status: 'open',
                },
              });
            }

            // 5. Create WaMessage
            const waMsg = await prisma.waMessage.create({
              data: {
                conversationId: conversation.id,
                waMessageId: externalId,
                direction: 'INBOUND',
                messageType: msgType,
                content,
                mediaUrl,
                status: 'delivered',
              },
            });

            // 6. Compatibility mirror to legacy Message model
            try {
              await prisma.message.create({
                data: {
                  tenantId,
                  partyId: party.id,
                  channel: 'WHATSAPP',
                  direction: 'INBOUND',
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
            } catch (_) {}

            // 7. Auto Lead Creation
            const leadIntents = ['quote_request', 'new_customer_inquiry', 'bulk_inquiry', 'sample_request', 'order_confirm'];
            let leadCreated = false;
            if (leadIntents.includes(aiIntent) || isPotentialCustomer || customerScore >= 70) {
              const existing = await prisma.lead.findFirst({
                where: { tenantId, partyId: party.id, source: 'WHATSAPP', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
              });
              if (!existing) {
                await prisma.lead.create({
                  data: {
                    tenantId,
                    partyId: party.id,
                    source: 'WHATSAPP',
                    status: 'NEW',
                    title: `WhatsApp — ${(aiEntities as any).product || aiIntent.replace('_', ' ')} — ${new Date().toLocaleDateString('en-IN')}`,
                    productInterest: (aiEntities as any).product,
                    notes: customerSignals.length ? `Signals: ${customerSignals.join(', ')}` : undefined,
                  },
                });
                leadCreated = true;
                logger.info(`[WA Webhook] Lead auto-created for ${party.name}`);
              }
            }

            // 8. Real-time push via Socket.io
            io.to(`tenant:${tenantId}`).emit('new_whatsapp_message', {
              conversationId: conversation.id,
              message: waMsg,
              conversation,
              leadCreated,
            });
          }
        }
      }
    }
  } catch (err: any) {
    logger.error(`[WA Webhook POST Error] ${err.message}`);
  }
});
