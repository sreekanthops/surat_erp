import { Router } from 'express';
import { prisma } from '../services/db.js';
import axios from 'axios';
import { z } from 'zod';

export const aiRouter = Router();

const chatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1),
});

// POST /api/v1/ai/chat
aiRouter.post('/chat', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const userId = (req as any).user.userId;
    const body = chatSchema.parse(req.body);

    // Get or create session
    let session;
    if (body.sessionId) {
      session = await prisma.aiChatSession.findFirst({ where: { id: body.sessionId, tenantId } });
    }
    if (!session) {
      session = await prisma.aiChatSession.create({ data: { tenantId, userId } });
    }

    // Get last 10 messages for context
    const history = await prisma.aiChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    // Call Python AI service
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/ai/chat`,
      {
        tenantId,
        message: body.message,
        history: history.map((m) => ({ role: m.role.toLowerCase(), content: m.content })),
      },
      { timeout: 30000 }
    );

    const { response, sqlQuery, tokensUsed } = aiResponse.data;

    // Store both messages
    await prisma.aiChatMessage.createMany({
      data: [
        { sessionId: session.id, role: 'USER', content: body.message },
        { sessionId: session.id, role: 'ASSISTANT', content: response, sqlQuery, tokensUsed },
      ],
    });

    return res.json({ sessionId: session.id, response, sqlQuery });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/ai/suggestions
aiRouter.get('/suggestions', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/ai/daily-suggestions`,
      { tenantId },
      { timeout: 30000 }
    );

    return res.json(aiResponse.data);
  } catch (err) {
    next(err);
  }
});
