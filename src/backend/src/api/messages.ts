import { Router } from 'express';
import { prisma } from '../services/db.js';
import { io } from '../index.js';

export const messagesRouter = Router();

// GET /api/v1/messages/inbox
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

// PATCH /api/v1/messages/:id/read
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

// POST /api/v1/messages/reply
messagesRouter.post('/reply', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { messageId, content, createLead } = req.body;

    const original = await prisma.message.findFirst({ where: { id: messageId, tenantId } });
    if (!original) return res.status(404).json({ error: 'Message not found' });

    // Record outbound reply
    const reply = await prisma.message.create({
      data: {
        tenantId,
        partyId: original.partyId,
        channel: original.channel,
        direction: 'OUTBOUND',
        toAddress: original.fromAddress,
        fromAddress: original.toAddress,
        content,
        threadId: original.threadId,
      },
    });

    await prisma.message.update({ where: { id: messageId }, data: { isReplied: true } });

    // TODO: actually send via WhatsApp / Gmail SDK based on channel

    if (createLead && original.partyId) {
      await prisma.lead.create({
        data: {
          tenantId,
          partyId: original.partyId,
          sourceMessageId: original.id,
          source: original.channel as any,
          status: 'CONTACTED',
          title: `Lead from ${original.channel} — ${new Date().toLocaleDateString()}`,
        },
      });
    }

    io.to(`tenant:${tenantId}`).emit('message_replied', { replyId: reply.id });
    return res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});
