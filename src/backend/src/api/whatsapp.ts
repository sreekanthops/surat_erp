import { Router } from 'express';
import { prisma } from '../services/db.js';
import { io } from '../index.js';
import axios from 'axios';
import { groupFilter } from '../middleware/groupFilter.js';
import { requireRole } from '../middleware/requireRole.js';
import { logger } from '../services/logger.js';

export const whatsappRouter = Router();

// Helper to get WhatsApp config for tenant
export async function getWhatsAppConfig(tenantId: string) {
  const cfg = await prisma.integrationConfig.findFirst({
    where: { tenantId, type: 'WHATSAPP', isActive: true },
  });
  if (!cfg || !cfg.config) return null;
  return cfg.config as {
    phoneNumberId?: string;
    wabaId?: string;
    accessToken?: string;
    appSecret?: string;
    displayPhone?: string;
    verifyToken?: string;
  };
}

// ── GET /api/v1/whatsapp/conversations ────────────────────────────────────────
// List all conversations for the inbox
whatsappRouter.get('/conversations', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { status, search, assignedAgentId, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {
      tenantId,
      ...(status && status !== 'all' ? { status } : {}),
      ...(assignedAgentId ? { assignedAgentId } : {}),
    };

    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { latestContent: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.waConversation.findMany({
        where,
        include: {
          party: { select: { id: true, name: true, phone: true, type: true } },
          assignedAgent: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(limit),
      }),
      prisma.waConversation.count({ where }),
    ]);

    // Format remaining time on 24h window for each conversation
    const now = Date.now();
    const data = conversations.map(c => {
      const expiresAt = c.windowExpiresAt ? new Date(c.windowExpiresAt).getTime() : 0;
      const isWindowOpen = expiresAt > now;
      const windowRemainingSeconds = isWindowOpen ? Math.floor((expiresAt - now) / 1000) : 0;
      return {
        ...c,
        isWindowOpen,
        windowRemainingSeconds,
      };
    });

    return res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/whatsapp/conversations/:id/messages ───────────────────────────
// Get full message history for one conversation thread
whatsappRouter.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const conversationId = req.params.id;

    const conversation = await prisma.waConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        party: true,
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.waMessage.findMany({
      where: { conversationId },
      include: {
        sentByAgent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark as read and reset unread count
    if (conversation.unreadCount > 0) {
      await prisma.waConversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
    }

    const now = Date.now();
    const expiresAt = conversation.windowExpiresAt ? new Date(conversation.windowExpiresAt).getTime() : 0;
    const isWindowOpen = expiresAt > now;
    const windowRemainingSeconds = isWindowOpen ? Math.floor((expiresAt - now) / 1000) : 0;

    return res.json({
      conversation: {
        ...conversation,
        unreadCount: 0,
        isWindowOpen,
        windowRemainingSeconds,
      },
      messages,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/whatsapp/conversations/:id/send ──────────────────────────────
// Send a free-form reply (valid only if 24h window is still open)
whatsappRouter.post('/conversations/:id/send', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const userId = (req as any).user.id;
    const conversationId = req.params.id;
    const { message: textBody } = req.body;

    if (!textBody || !textBody.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }

    const conversation = await prisma.waConversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check 24-hour window
    const now = Date.now();
    const expiresAt = conversation.windowExpiresAt ? new Date(conversation.windowExpiresAt).getTime() : 0;
    const isWindowOpen = expiresAt > now;

    if (!isWindowOpen) {
      return res.status(400).json({
        error: '24h window closed — customer must message first or you must send an approved template instead.',
        windowExpired: true,
      });
    }

    const config = await getWhatsAppConfig(tenantId);
    if (!config || !config.phoneNumberId || !config.accessToken) {
      return res.status(400).json({ error: 'WhatsApp is not configured or missing credentials.' });
    }

    const cleanTo = conversation.phoneNumber.replace(/\D/g, '');
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    let waMessageId: string | undefined;
    let status = 'sent';
    let errorMessage: string | undefined;

    try {
      const waRes = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: { body: textBody },
        },
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      waMessageId = waRes.data?.messages?.[0]?.id;
    } catch (err: any) {
      logger.error(`[WhatsApp Send Error] ${err.response?.data?.error?.message || err.message}`);
      status = 'failed';
      errorMessage = err.response?.data?.error?.message || err.message;
    }

    // Save outbound message to DB
    const message = await prisma.waMessage.create({
      data: {
        conversationId,
        waMessageId,
        direction: 'OUTBOUND',
        messageType: 'text',
        content: textBody,
        status,
        errorMessage,
        sentByAgentId: userId,
      },
    });

    // Update conversation metadata
    await prisma.waConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        latestContent: textBody,
      },
    });

    // Also mirror to legacy Message table for compatibility
    try {
      await prisma.message.create({
        data: {
          tenantId,
          partyId: conversation.partyId,
          channel: 'WHATSAPP',
          direction: 'OUTBOUND',
          toAddress: conversation.phoneNumber,
          content: textBody,
          externalId: waMessageId,
        },
      });
    } catch (_) {}

    // Emit live event via Socket.IO
    io.to(`tenant:${tenantId}`).emit('whatsapp_message_sent', {
      conversationId,
      message,
    });

    return res.status(201).json({
      message,
      status,
      errorMessage,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/whatsapp/send-template ───────────────────────────────────────
// Send an approved Meta template message (starts or re-opens conversation)
whatsappRouter.post('/send-template', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const userId = (req as any).user.id;
    const { toPhone, templateName, language = 'en', parameters = [], contactName } = req.body;

    if (!toPhone || !templateName) {
      return res.status(400).json({ error: 'toPhone and templateName are required' });
    }

    const config = await getWhatsAppConfig(tenantId);
    if (!config || !config.phoneNumberId || !config.accessToken) {
      return res.status(400).json({ error: 'WhatsApp is not configured or missing credentials.' });
    }

    const cleanPhone = toPhone.replace(/\D/g, '');
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    // Format components payload for Meta Cloud API
    const components: any[] = [];
    if (parameters && parameters.length > 0) {
      components.push({
        type: 'body',
        parameters: parameters.map((val: string) => ({
          type: 'text',
          text: String(val),
        })),
      });
    }

    const metaPayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length > 0 ? { components } : {}),
      },
    };

    let waMessageId: string | undefined;
    let status = 'sent';
    let errorMessage: string | undefined;

    try {
      const waRes = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${config.phoneNumberId}/messages`,
        metaPayload,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        }
      );
      waMessageId = waRes.data?.messages?.[0]?.id;
    } catch (err: any) {
      logger.error(`[WhatsApp Template Send Error] ${err.response?.data?.error?.message || err.message}`);
      status = 'failed';
      errorMessage = err.response?.data?.error?.message || err.message;
      return res.status(400).json({
        error: `Meta Template Send Failed: ${errorMessage}`,
        details: err.response?.data,
      });
    }

    // Find or create Party
    let party = await prisma.party.findFirst({
      where: { tenantId, OR: [{ whatsapp: cleanPhone }, { phone: cleanPhone }] },
    });
    if (!party) {
      party = await prisma.party.create({
        data: {
          tenantId,
          name: contactName || cleanPhone,
          phone: cleanPhone,
          whatsapp: cleanPhone,
          type: 'CUSTOMER',
        },
      });
    }

    // Find or create WaConversation
    let conversation = await prisma.waConversation.findFirst({
      where: { tenantId, phoneNumber: cleanPhone },
    });

    if (!conversation) {
      conversation = await prisma.waConversation.create({
        data: {
          tenantId,
          partyId: party.id,
          phoneNumber: cleanPhone,
          contactName: party.name,
          lastMessageAt: new Date(),
          latestContent: `[Template: ${templateName}]`,
          assignedAgentId: userId,
          status: 'open',
        },
      });
    } else {
      conversation = await prisma.waConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          latestContent: `[Template: ${templateName}]`,
          status: 'open',
        },
      });
    }

    // Create WaMessage
    const msg = await prisma.waMessage.create({
      data: {
        conversationId: conversation.id,
        waMessageId,
        direction: 'OUTBOUND',
        messageType: 'template',
        content: `[Template: ${templateName}] ${parameters.join(' ')}`,
        templateName,
        templateParams: parameters,
        status,
        errorMessage,
        sentByAgentId: userId,
      },
    });

    io.to(`tenant:${tenantId}`).emit('whatsapp_message_sent', {
      conversationId: conversation.id,
      message: msg,
    });

    return res.status(201).json({
      success: true,
      conversationId: conversation.id,
      message: msg,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/whatsapp/templates ────────────────────────────────────────────
// Fetch templates from Meta API or fallback to synced local DB templates
whatsappRouter.get('/templates', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const config = await getWhatsAppConfig(tenantId);

    // Try fetching live templates from Meta Graph API if WABA ID is configured
    if (config && config.wabaId && config.accessToken) {
      try {
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
        const metaRes = await axios.get(
          `https://graph.facebook.com/${apiVersion}/${config.wabaId}/message_templates`,
          {
            headers: { Authorization: `Bearer ${config.accessToken}` },
            params: { limit: 100 },
            timeout: 8000,
          }
        );

        if (metaRes.data?.data) {
          // Sync to local DB
          for (const t of metaRes.data.data) {
            const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
            const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
            const footerComp = t.components?.find((c: any) => c.type === 'FOOTER');
            const buttonComp = t.components?.find((c: any) => c.type === 'BUTTONS');

            await prisma.waTemplate.upsert({
              where: {
                tenantId_metaTemplateName_language: {
                  tenantId,
                  metaTemplateName: t.name,
                  language: t.language || 'en',
                },
              },
              update: {
                category: t.category,
                body: bodyComp?.text || '',
                header: headerComp?.text || '',
                footer: footerComp?.text || '',
                buttons: buttonComp?.buttons || null,
                status: t.status || 'APPROVED',
              },
              create: {
                tenantId,
                metaTemplateName: t.name,
                language: t.language || 'en',
                category: t.category,
                body: bodyComp?.text || '',
                header: headerComp?.text || '',
                footer: footerComp?.text || '',
                buttons: buttonComp?.buttons || null,
                status: t.status || 'APPROVED',
              },
            });
          }

          return res.json({ templates: metaRes.data.data });
        }
      } catch (metaErr: any) {
        logger.warn(`[WA Templates Meta Fetch] ${metaErr.message}`);
      }
    }

    // Fallback: Read from local wa_templates table or default seed templates
    let templates = await prisma.waTemplate.findMany({
      where: { tenantId },
      orderBy: { metaTemplateName: 'asc' },
    });

    if (templates.length === 0) {
      // Provide standard default sample templates if none exist
      templates = [
        {
          id: 'tpl-1',
          tenantId,
          metaTemplateName: 'order_status_update',
          category: 'UTILITY',
          language: 'en',
          body: 'Hello {{1}}, your order #{{2}} of {{3}} meters is currently {{4}}. Thank you for choosing us!',
          header: 'Order Update',
          footer: 'Shah Fabrics Surat',
          buttons: null,
          status: 'APPROVED',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'tpl-2',
          tenantId,
          metaTemplateName: 'catalogue_inquiry_response',
          category: 'MARKETING',
          language: 'en',
          body: 'Hello {{1}}, thank you for contacting us regarding our latest fabric collection. Please check our latest catalogues and price list for {{2}}.',
          header: 'New Collection Catalogue',
          footer: 'Shah Fabrics Surat',
          buttons: null,
          status: 'APPROVED',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'tpl-3',
          tenantId,
          metaTemplateName: 'payment_reminder',
          category: 'UTILITY',
          language: 'en',
          body: 'Dear {{1}}, gentle reminder regarding invoice #{{2}} for Rs. {{3}} due on {{4}}. Please let us know if you need any assistance.',
          header: 'Payment Reminder',
          footer: 'Shah Fabrics Accounts',
          buttons: null,
          status: 'APPROVED',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    return res.json({ templates });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/whatsapp/conversations/:id/assign ───────────────────────────
// Assign a conversation thread to an ERP staff agent
whatsappRouter.patch('/conversations/:id/assign', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { assignedAgentId } = req.body;

    const updated = await prisma.waConversation.update({
      where: { id: req.params.id, tenantId },
      data: { assignedAgentId: assignedAgentId || null },
      include: { assignedAgent: { select: { id: true, name: true } } },
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/whatsapp/conversations/:id/status ───────────────────────────
// Open / Close a conversation
whatsappRouter.patch('/conversations/:id/status', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { status } = req.body;

    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be open or closed' });
    }

    const updated = await prisma.waConversation.update({
      where: { id: req.params.id, tenantId },
      data: { status },
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/whatsapp/simulate ────────────────────────────────────────────
// Simulate an incoming WhatsApp message for dev and testing
whatsappRouter.post('/simulate', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { from = '919876543210', senderName = 'Test Customer', content = 'Hello, can you send rate list for Cotton 60s?' } = req.body;

    const cleanPhone = from.replace(/\D/g, '');

    // 1. Party
    let party = await prisma.party.findFirst({
      where: { tenantId, OR: [{ whatsapp: cleanPhone }, { phone: cleanPhone }] },
    });
    if (!party) {
      party = await prisma.party.create({
        data: {
          tenantId,
          name: senderName || cleanPhone,
          phone: cleanPhone,
          whatsapp: cleanPhone,
          type: 'CUSTOMER',
        },
      });
    }

    // 2. Window expires in 24 hours
    const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // AI keyword check
    let aiIntent = 'general';
    let customerScore = 30;
    let customerSignals: string[] = [];
    if (/rate|price|kitna|quote|cost/i.test(content)) {
      aiIntent = 'quote_request';
      customerScore = 75;
      customerSignals = ['asking price/rate'];
    } else if (/order|bhejo|confirm/i.test(content)) {
      aiIntent = 'order_confirm';
      customerScore = 90;
      customerSignals = ['order placement intent'];
    } else if (/catalogue|sample/i.test(content)) {
      aiIntent = 'catalogue_request';
      customerScore = 65;
      customerSignals = ['catalog inquiry'];
    }

    // 3. Conversation
    let conversation = await prisma.waConversation.findFirst({
      where: { tenantId, phoneNumber: cleanPhone },
    });

    if (!conversation) {
      conversation = await prisma.waConversation.create({
        data: {
          tenantId,
          partyId: party.id,
          phoneNumber: cleanPhone,
          contactName: senderName || party.name,
          lastMessageAt: new Date(),
          windowExpiresAt,
          unreadCount: 1,
          latestContent: content,
          aiIntent,
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
          customerScore: Math.max(conversation.customerScore || 0, customerScore),
          customerSignals: Array.from(new Set([...(conversation.customerSignals || []), ...customerSignals])),
          status: 'open',
        },
      });
    }

    // 4. Message
    const simulatedWaId = 'wamid.' + Math.random().toString(36).substring(2, 12);
    const message = await prisma.waMessage.create({
      data: {
        conversationId: conversation.id,
        waMessageId: simulatedWaId,
        direction: 'INBOUND',
        messageType: 'text',
        content,
        status: 'delivered',
      },
    });

    // 5. Auto lead creation if high score
    let lead = null;
    if (customerScore >= 70) {
      lead = await prisma.lead.create({
        data: {
          tenantId,
          partyId: party.id,
          source: 'WHATSAPP',
          status: 'NEW',
          title: `WhatsApp Inquiry from ${party.name} (${aiIntent.replace('_', ' ')})`,
          notes: customerSignals.join(', '),
        },
      });
    }

    // Emit live event
    io.to(`tenant:${tenantId}`).emit('new_whatsapp_message', {
      conversationId: conversation.id,
      message,
      conversation,
    });

    return res.status(201).json({
      success: true,
      conversation,
      message,
      lead,
    });
  } catch (err) {
    next(err);
  }
});
