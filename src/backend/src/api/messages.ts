import { Router } from 'express';
import { prisma } from '../services/db.js';
import { io } from '../index.js';
import axios from 'axios';

export const messagesRouter = Router();

// ── Helper: run AI extraction via Python service ──────────────────────────────
async function runAiExtraction(content: string) {
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
      { content, type: 'text' },
      { timeout: 10000 },
    );
    aiIntent             = aiRes.data.intent;
    aiEntities           = aiRes.data.entities || {};
    aiLanguage           = aiRes.data.language;
    aiSentiment          = aiRes.data.sentiment || 'neutral';
    isPotentialCustomer  = aiRes.data.is_potential_customer || false;
    customerScore        = aiRes.data.customer_score || 0;
    customerSignals      = aiRes.data.customer_signals || [];
  } catch {
    // Fallback: keyword-based
    if (/rate|price|kitna|chahiye|quote|cost/i.test(content)) {
      aiIntent = 'quote_request'; isPotentialCustomer = true; customerScore = 55;
      customerSignals = ['asking price/rate'];
    } else if (/confirm|order|bhejo|send/i.test(content)) {
      aiIntent = 'order_confirm'; isPotentialCustomer = true; customerScore = 70;
      customerSignals = ['order intent'];
    } else if (/catalogue|catalog|list|variety/i.test(content)) {
      aiIntent = 'catalogue_request'; isPotentialCustomer = true; customerScore = 45;
      customerSignals = ['catalogue request'];
    } else if (/payment|paid|neft|upi/i.test(content)) {
      aiIntent = 'payment_info'; customerScore = 10;
    } else if (/bulk|wholesale|meter|kg/i.test(content)) {
      aiIntent = 'bulk_inquiry'; isPotentialCustomer = true; customerScore = 50;
      customerSignals = ['bulk/wholesale inquiry'];
    }
  }

  return { aiIntent, aiEntities, aiLanguage, aiSentiment, isPotentialCustomer, customerScore, customerSignals };
}

// ── Helper: store inbound WhatsApp message + auto-create lead ─────────────────
async function storeWhatsAppMessage(opts: {
  tenantId: string;
  from: string;
  senderName?: string;
  content: string;
  externalId?: string;
}) {
  const { tenantId, from, senderName, content, externalId } = opts;

  // Find or create party
  let party = await prisma.party.findFirst({ where: { tenantId, whatsapp: from } });
  if (!party) {
    party = await prisma.party.create({
      data: { tenantId, name: senderName || from, phone: from, whatsapp: from, type: 'CUSTOMER' },
    });
  } else if (senderName && party.name === party.phone) {
    // Update placeholder name if we now have a real name
    party = await prisma.party.update({ where: { id: party.id }, data: { name: senderName } });
  }

  const { aiIntent, aiEntities, aiLanguage, aiSentiment, isPotentialCustomer, customerScore, customerSignals } =
    await runAiExtraction(content);

  // Store message
  const message = await prisma.message.create({
    data: {
      tenantId,
      partyId: party.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      fromAddress: from,
      content,
      aiIntent,
      aiEntities: { ...aiEntities, customerScore, customerSignals },
      aiLanguage,
      aiSentiment,
      isRead: false,
      ...(externalId ? { externalId } : {}),
    },
    include: { party: true },
  });

  // Auto-create lead for strong buying signals
  let lead = null;
  const leadIntents = ['quote_request', 'new_customer_inquiry', 'bulk_inquiry', 'sample_request', 'order_confirm'];
  if (leadIntents.includes(aiIntent) || isPotentialCustomer) {
    // Check if a lead already exists for this party from the last 7 days
    const existingLead = await prisma.lead.findFirst({
      where: {
        tenantId,
        partyId: party.id,
        source: 'WHATSAPP',
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
    });

    if (!existingLead) {
      lead = await prisma.lead.create({
        data: {
          tenantId,
          partyId: party.id,
          sourceMessageId: message.id,
          source: 'WHATSAPP',
          status: 'NEW',
          title: `WhatsApp — ${(aiEntities as any).product || aiIntent.replace('_', ' ')} — ${new Date().toLocaleDateString('en-IN')}`,
          productInterest: (aiEntities as any).product,
          estimatedQty: (aiEntities as any).quantity ? parseFloat((aiEntities as any).quantity) : undefined,
          notes: customerSignals.length ? `Signals: ${customerSignals.join(', ')}` : undefined,
        },
      });
    }
  }

  // Push real-time notification
  io.to(`tenant:${tenantId}`).emit('new_whatsapp_message', {
    messageId: message.id,
    from,
    partyName: party.name,
    intent: aiIntent,
    isPotentialCustomer,
    customerScore,
    customerSignals,
    leadCreated: !!lead,
  });

  return { message, party, lead, aiIntent, aiSentiment, aiLanguage, isPotentialCustomer, customerScore, customerSignals };
}

// ── GET /api/v1/messages/inbox ────────────────────────────────────────────────
messagesRouter.get('/inbox', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { channel, intent, isRead, page = '1', limit = '30' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          tenantId,
          direction: 'INBOUND',
          ...(channel && { channel: channel as any }),
          ...(intent && { aiIntent: intent }),
          ...(isRead !== undefined && { isRead: isRead === 'true' }),
        },
        include: { party: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.message.count({
        where: {
          tenantId,
          direction: 'INBOUND',
          ...(channel && { channel: channel as any }),
          ...(intent && { aiIntent: intent }),
          ...(isRead !== undefined && { isRead: isRead === 'true' }),
        },
      }),
    ]);

    return res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/messages/:id/read ──────────────────────────────────────────
messagesRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    await prisma.message.updateMany({
      where: { id: req.params.id, tenantId },
      data: { isRead: true },
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/messages/reply ───────────────────────────────────────────────
messagesRouter.post('/reply', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { messageId, content, createLead } = req.body;

    const original = await prisma.message.findFirst({ where: { id: messageId, tenantId } });
    if (!original) return res.status(404).json({ error: 'Message not found' });

    // ── Actually send via WhatsApp if channel is WHATSAPP ────────────────────
    let externalId: string | undefined;
    let sendError: string | undefined;

    if (original.channel === 'WHATSAPP') {
      const waCfg = await prisma.integrationConfig.findFirst({
        where: { tenantId, type: 'WHATSAPP', isActive: true },
      });

      if (!waCfg) {
        return res.status(400).json({ error: 'WhatsApp not connected. Go to Inbox → Connect WA.' });
      }

      const { phoneNumberId, accessToken } = waCfg.config as any;
      const toPhone = (original.fromAddress || '').replace(/\D/g, '');
      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v25.0';

      try {
        const waRes = await axios.post(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: toPhone,
            type: 'text',
            text: { body: content },
          },
          {
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            timeout: 10000,
          },
        );
        externalId = waRes.data.messages?.[0]?.id;
      } catch (waErr: any) {
        sendError = waErr?.response?.data?.error?.message || waErr?.message;
        // Don't fail — save to DB anyway so message is not lost
      }
    }

    // Save outbound message to DB
    const reply = await prisma.message.create({
      data: {
        tenantId,
        partyId:     original.partyId,
        channel:     original.channel,
        direction:   'OUTBOUND',
        toAddress:   original.fromAddress,
        fromAddress: original.toAddress,
        content,
        threadId:    original.threadId,
        ...(externalId ? { externalId } : {}),
      },
    });

    await prisma.message.update({ where: { id: messageId }, data: { isReplied: true } });

    if (createLead && original.partyId) {
      await prisma.lead.create({
        data: {
          tenantId,
          partyId:         original.partyId,
          sourceMessageId: original.id,
          source:          original.channel as any,
          status:          'CONTACTED',
          title:           `Lead from ${original.channel} — ${new Date().toLocaleDateString()}`,
        },
      });
    }

    io.to(`tenant:${tenantId}`).emit('message_replied', { replyId: reply.id });
    return res.status(201).json({ ...reply, sendError });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/messages/potential-leads ─────────────────────────────────────
// Scan recent WhatsApp messages for potential new customers
messagesRouter.get('/potential-leads', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(); since.setDate(since.getDate() - days);

    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        createdAt: { gte: since },
      },
      include: { party: { select: { id: true, name: true, phone: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Group by sender phone
    const senderMap = new Map<string, {
      phone: string; partyName: string; partyId: string; isKnownCustomer: boolean;
      messages: any[]; intents: string[]; customerSignals: string[];
      hasQuoteRequest: boolean; hasOrderSignal: boolean;
      latestMessage: string; latestAt: Date; topScore: number;
    }>();

    for (const msg of messages) {
      const phone = msg.fromAddress || 'unknown';
      if (!senderMap.has(phone)) {
        senderMap.set(phone, {
          phone,
          partyName: msg.party?.name || phone,
          partyId: msg.party?.id || '',
          isKnownCustomer: msg.party?.type === 'CUSTOMER',
          messages: [], intents: [], customerSignals: [],
          hasQuoteRequest: false, hasOrderSignal: false,
          latestMessage: '', latestAt: msg.createdAt, topScore: 0,
        });
      }
      const sender = senderMap.get(phone)!;
      sender.messages.push(msg);
      if (msg.aiIntent) sender.intents.push(msg.aiIntent);
      if (msg.aiIntent === 'quote_request' || msg.aiIntent === 'new_customer_inquiry' || msg.aiIntent === 'bulk_inquiry') sender.hasQuoteRequest = true;
      if (msg.aiIntent === 'order_confirm') sender.hasOrderSignal = true;
      if (!sender.latestMessage) sender.latestMessage = msg.content || '';

      // Merge customer signals & score from stored aiEntities
      const entities = msg.aiEntities as any;
      if (entities?.customerSignals) {
        for (const s of entities.customerSignals) {
          if (!sender.customerSignals.includes(s)) sender.customerSignals.push(s);
        }
      }
      if (entities?.customerScore && entities.customerScore > sender.topScore) {
        sender.topScore = entities.customerScore;
      }
    }

    const potentialLeads = Array.from(senderMap.values())
      .filter(s => s.hasQuoteRequest || s.hasOrderSignal || s.intents.includes('catalogue_request') || s.topScore >= 40)
      .map(s => {
        let score = s.topScore;
        if (!score) {
          if (s.hasQuoteRequest) score += 50;
          if (s.hasOrderSignal) score += 30;
          if (s.intents.includes('catalogue_request')) score += 20;
          if (!s.isKnownCustomer) score += 20;
          if (s.messages.length >= 2) score += 10;
        }
        score = Math.min(100, score);

        return {
          phone: s.phone,
          partyId: s.partyId,
          partyName: s.partyName,
          isKnownCustomer: s.isKnownCustomer,
          messageCount: s.messages.length,
          intents: [...new Set(s.intents)],
          customerSignals: s.customerSignals,
          latestMessage: s.latestMessage,
          latestAt: s.latestAt,
          score,
          recommendation: score >= 70
            ? 'Hot lead — create lead immediately'
            : score >= 40
            ? 'Moderate interest — follow up soon'
            : 'Low signal — monitor',
        };
      })
      .sort((a, b) => b.score - a.score);

    return res.json({ data: potentialLeads, total: potentialLeads.length, periodDays: days });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/messages/whatsapp-leads ──────────────────────────────────────
// Structured endpoint used by AI chatbot to answer "who can be my customer" queries
messagesRouter.get('/whatsapp-leads', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const minScore = parseInt(req.query.minScore as string) || 40;
    const since = new Date(); since.setDate(since.getDate() - 30);

    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        aiIntent: { in: ['quote_request', 'new_customer_inquiry', 'bulk_inquiry', 'order_confirm', 'catalogue_request', 'sample_request'] },
        createdAt: { gte: since },
      },
      include: { party: { select: { id: true, name: true, phone: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Check which ones already have leads
    const partyIds = [...new Set(messages.map(m => m.partyId).filter(Boolean))];
    const existingLeads = await prisma.lead.findMany({
      where: { tenantId, partyId: { in: partyIds as string[] } },
      select: { partyId: true, status: true },
    });
    const leadPartyIds = new Set(existingLeads.map(l => l.partyId));

    const leads = messages.map(m => {
      const entities = m.aiEntities as any;
      const score = entities?.customerScore || 0;
      return {
        partyId: m.party?.id,
        name: m.party?.name || m.fromAddress,
        phone: m.fromAddress,
        intent: m.aiIntent,
        product: entities?.product,
        quantity: entities?.quantity,
        city: entities?.city,
        urgency: entities?.urgency,
        customerScore: score,
        customerSignals: entities?.customerSignals || [],
        message: m.content?.slice(0, 120),
        receivedAt: m.createdAt,
        alreadyHasLead: leadPartyIds.has(m.partyId),
        isNewContact: m.party?.type !== 'CUSTOMER',
      };
    }).filter(l => l.customerScore >= minScore || ['quote_request', 'order_confirm', 'bulk_inquiry'].includes(l.intent || ''));

    return res.json({ data: leads, total: leads.length });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/messages/simulate-whatsapp ───────────────────────────────────
// Simulate an incoming WhatsApp message (dev/demo)
messagesRouter.post('/simulate-whatsapp', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { from, content, senderName } = req.body;
    if (!from || !content) return res.status(400).json({ error: 'from and content required' });

    const result = await storeWhatsAppMessage({ tenantId, from, content, senderName });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/messages/whatsapp-webhook ─────────────────────────────────────
// Meta webhook verification (GET challenge)
messagesRouter.get('/whatsapp-webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'gspaces-wa-token';
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified');
    return res.status(200).send(challenge as string);
  }
  return res.sendStatus(403);
});

// ── POST /api/v1/messages/whatsapp-webhook ────────────────────────────────────
// Meta Cloud API — receive real inbound WhatsApp messages
messagesRouter.post('/whatsapp-webhook', async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        const wabaId = value?.metadata?.phone_number_id;

        // Look up which tenant owns this WABA phone number ID
        const integration = await prisma.integrationConfig.findFirst({
          where: { type: 'WHATSAPP', isActive: true, config: { path: ['phoneNumberId'], equals: wabaId } },
        });
        if (!integration) continue;

        const tenantId = integration.tenantId;

        for (const msg of (value.messages || [])) {
          if (msg.type !== 'text') continue; // images/audio handled separately
          const from        = msg.from;
          const content     = msg.text?.body || '';
          const externalId  = msg.id;
          const senderName  = value.contacts?.find((c: any) => c.wa_id === from)?.profile?.name;

          await storeWhatsAppMessage({ tenantId, from, senderName, content, externalId });
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp webhook error]', err);
  }
});

// ── PATCH /api/v1/messages/:id/convert-lead ──────────────────────────────────
messagesRouter.patch('/:id/convert-lead', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const msg = await prisma.message.findFirst({
      where: { id: req.params.id, tenantId },
      include: { party: true },
    });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const { title, productInterest, estimatedValue, notes } = req.body;

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        partyId: msg.partyId || undefined,
        sourceMessageId: msg.id,
        source: msg.channel as any,
        status: 'NEW',
        title: title || `Lead from ${msg.channel} — ${new Date().toLocaleDateString('en-IN')}`,
        productInterest: productInterest || (msg.aiEntities as any)?.product,
        estimatedValue: estimatedValue || undefined,
        notes,
      },
      include: { party: true },
    });

    await prisma.message.update({ where: { id: msg.id }, data: { isRead: true } });
    return res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/messages/bulk-convert-leads ─────────────────────────────────
// Convert all high-score potential customers to leads in one click
messagesRouter.post('/bulk-convert-leads', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { minScore = 70 } = req.body;
    const since = new Date(); since.setDate(since.getDate() - 30);

    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        aiIntent: { in: ['quote_request', 'new_customer_inquiry', 'bulk_inquiry', 'order_confirm'] },
        createdAt: { gte: since },
      },
      include: { party: true },
    });

    let created = 0;
    const errors: string[] = [];

    for (const msg of messages) {
      const entities = msg.aiEntities as any;
      const score = entities?.customerScore || 0;
      if (score < minScore) continue;
      if (!msg.partyId) continue;

      // Skip if lead already exists
      const existing = await prisma.lead.findFirst({
        where: { tenantId, partyId: msg.partyId, source: 'WHATSAPP', createdAt: { gte: since } },
      });
      if (existing) continue;

      try {
        await prisma.lead.create({
          data: {
            tenantId,
            partyId: msg.partyId,
            sourceMessageId: msg.id,
            source: 'WHATSAPP',
            status: 'NEW',
            title: `WhatsApp — ${entities?.product || msg.aiIntent} — ${new Date().toLocaleDateString('en-IN')}`,
            productInterest: entities?.product,
            notes: entities?.customerSignals?.length ? `Signals: ${entities.customerSignals.join(', ')}` : undefined,
          },
        });
        created++;
      } catch (e: any) {
        errors.push(msg.partyId);
      }
    }

    return res.json({ created, errors });
  } catch (err) {
    next(err);
  }
});
