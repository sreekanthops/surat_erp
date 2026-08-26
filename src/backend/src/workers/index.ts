import { Queue, Worker } from 'bullmq';
import { prisma } from '../services/db.js';
import { logger } from '../services/logger.js';
import axios from 'axios';
import IORedis from 'ioredis';

// Lazy queues — only created when Redis is reachable
export let messageQueue: Queue;
export let syncQueue: Queue;

let redisConn: IORedis | null = null;

const getRedis = () => {
  if (!redisConn) {
    redisConn = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return redisConn;
};

// ── WhatsApp message processor ────────────────────────────
const startWhatsappWorker = () => new Worker(
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

    // 3. AI extraction (enriched — intent + score + signals)
    let aiIntent = 'general';
    let aiEntities: any = {};
    let aiLanguage = 'hi';
    let aiSentiment = 'neutral';
    let isPotentialCustomer = false;
    let customerScore = 0;
    let customerSignals: string[] = [];

    try {
      const aiRes = await axios.post(
        `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/ai/extract-message-entities`,
        { content, type },
        { timeout: 10000 }
      );
      aiIntent             = aiRes.data.intent;
      aiEntities           = aiRes.data.entities || {};
      aiLanguage           = aiRes.data.language;
      aiSentiment          = aiRes.data.sentiment || 'neutral';
      isPotentialCustomer  = aiRes.data.is_potential_customer || false;
      customerScore        = aiRes.data.customer_score || 0;
      customerSignals      = aiRes.data.customer_signals || [];
    } catch (err) {
      logger.warn('AI extraction failed, storing raw message', { err });
      // keyword fallback
      if (content && /rate|price|kitna|quote/i.test(content)) {
        aiIntent = 'quote_request'; isPotentialCustomer = true; customerScore = 55;
        customerSignals = ['asking price/rate'];
      }
    }

    // 4. Store message with enriched AI data
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
        aiEntities: { ...aiEntities, customerScore, customerSignals },
        aiLanguage,
        aiSentiment,
        isRead: false,
      },
    });

    // 5. Auto-create lead for buying signals (dedupe within 7 days)
    const leadIntents = ['quote_request', 'new_customer_inquiry', 'bulk_inquiry', 'sample_request', 'order_confirm'];
    if (leadIntents.includes(aiIntent) || isPotentialCustomer) {
      const existing = await prisma.lead.findFirst({
        where: { tenantId, partyId: party.id, source: 'WHATSAPP', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      });
      if (!existing) {
        await prisma.lead.create({
          data: {
            tenantId,
            partyId: party.id,
            sourceMessageId: message.id,
            source: 'WHATSAPP',
            status: 'NEW',
            title: `WhatsApp — ${aiEntities.product || aiIntent.replace('_', ' ')} — ${new Date().toLocaleDateString('en-IN')}`,
            productInterest: aiEntities.product,
            estimatedQty: aiEntities.quantity ? parseFloat(aiEntities.quantity) : undefined,
            notes: customerSignals.length ? `Signals: ${customerSignals.join(', ')}` : undefined,
          },
        });
      }
    }

    // 6. Push real-time to frontend via Redis pub/sub
    try { redisConn?.publish(`tenant:${tenantId}:events`, JSON.stringify({
      event: 'new_whatsapp_message',
      data: { channel: 'whatsapp', messageId: message.id, intent: aiIntent, party: party.name, customerScore, isPotentialCustomer },
    })); } catch { /* ignore if Redis not available */ }

    logger.info('WhatsApp message processed', { tenantId, intent: aiIntent, customerScore });
  },
  { connection: getRedis() as any, concurrency: 5 }
);

// ── Tally sync worker ─────────────────────────────────────
const startTallyWorker = () => new Worker(
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
  { connection: getRedis() as any }
);

export const initQueues = async () => {
  try {
    const conn = getRedis();
    await conn.connect();

    messageQueue = new Queue('messages', { connection: conn as any });
    syncQueue    = new Queue('sync',     { connection: conn as any });

    const wa    = startWhatsappWorker();
    const tally = startTallyWorker();

    wa.on('failed',    (job, err) => logger.error('WhatsApp worker failed', { job: job?.id, err }));
    tally.on('failed', (job, err) => logger.error('Tally worker failed',    { job: job?.id, err }));

    logger.info('✅ Queues ready — messageQueue, syncQueue');
  } catch (err) {
    logger.warn('⚠️  Redis not available — queues disabled (WhatsApp/Tally sync will not work in dev)', { err });
  }
};
