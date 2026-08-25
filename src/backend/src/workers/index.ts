import { Queue, Worker } from 'bullmq';
import { redis } from '../services/redis.js';
import { prisma } from '../services/db.js';
import { logger } from '../services/logger.js';
import axios from 'axios';

// ── Queues ────────────────────────────────────────────────
export const messageQueue = new Queue('messages', { connection: redis as any });
export const syncQueue = new Queue('sync', { connection: redis as any });

// ── WhatsApp message processor ────────────────────────────
const whatsappWorker = new Worker(
  'messages',
  async (job) => {
    if (job.name !== 'process-whatsapp') return;

    const { externalId, from, type, content, mediaId, phoneNumberId } = job.data;

    // 1. Find tenant by WhatsApp phone number ID
    const config = await prisma.integrationConfig.findFirst({
      where: { type: 'WHATSAPP', config: { path: ['phoneNumberId'], equals: phoneNumberId } },
    });
    if (!config) {
      logger.warn('No tenant found for WhatsApp phoneNumberId', { phoneNumberId });
      return;
    }

    const tenantId = config.tenantId;

    // 2. Find or create party by phone number
    let party = await prisma.party.findFirst({ where: { tenantId, whatsapp: from } });
    if (!party) {
      party = await prisma.party.create({
        data: { tenantId, name: from, phone: from, whatsapp: from, type: 'CUSTOMER' },
      });
    }

    // 3. AI extraction
    let aiIntent = 'general';
    let aiEntities = {};
    let aiLanguage = 'hi';

    try {
      const aiRes = await axios.post(
        `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/ai/extract-message-entities`,
        { content, type },
        { timeout: 10000 }
      );
      aiIntent = aiRes.data.intent;
      aiEntities = aiRes.data.entities;
      aiLanguage = aiRes.data.language;
    } catch (err) {
      logger.warn('AI extraction failed, storing raw message', { err });
    }

    // 4. Store message
    const message = await prisma.message.create({
      data: {
        tenantId,
        partyId: party.id,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        fromAddress: from,
        content,
        externalId,
        aiIntent,
        aiEntities,
        aiLanguage,
      },
    });

    // 5. Auto-create lead for quote requests
    if (aiIntent === 'quote_request') {
      await prisma.lead.create({
        data: {
          tenantId,
          partyId: party.id,
          sourceMessageId: message.id,
          source: 'WHATSAPP',
          status: 'NEW',
          title: `WhatsApp inquiry — ${(aiEntities as any).product || 'product'} — ${new Date().toLocaleDateString('en-IN')}`,
          productInterest: (aiEntities as any).product,
          estimatedQty: (aiEntities as any).quantity ? parseFloat((aiEntities as any).quantity) : undefined,
        },
      });
    }

    // 6. Push real-time to frontend
    // io is not directly accessible in workers — use Redis pub/sub
    await redis.publish(`tenant:${tenantId}:events`, JSON.stringify({
      event: 'new_message',
      data: { channel: 'whatsapp', messageId: message.id, intent: aiIntent, party: party.name },
    }));

    logger.info('WhatsApp message processed', { tenantId, intent: aiIntent });
  },
  { connection: redis as any, concurrency: 5 }
);

// ── Tally sync worker ─────────────────────────────────────
const tallyWorker = new Worker(
  'sync',
  async (job) => {
    if (job.name !== 'tally-sync') return;

    const { tenantId } = job.data;
    logger.info('Tally sync started', { tenantId });

    // TODO: implement full Tally XML bridge sync
    // 1. Fetch config for tenant
    // 2. Connect to Tally HTTP server
    // 3. Fetch sales, purchases, stock, parties
    // 4. Upsert into our DB

    await prisma.integrationConfig.updateMany({
      where: { tenantId, type: 'TALLY' },
      data: { lastSyncAt: new Date(), syncStatus: 'ok' },
    });

    logger.info('Tally sync completed', { tenantId });
  },
  { connection: redis as any }
);

whatsappWorker.on('failed', (job, err) => logger.error('WhatsApp worker failed', { job: job?.id, err }));
tallyWorker.on('failed', (job, err) => logger.error('Tally worker failed', { job: job?.id, err }));

export const initQueues = async () => {
  await redis.connect();
  logger.info('✅ Queues ready — messageQueue, syncQueue');
};
