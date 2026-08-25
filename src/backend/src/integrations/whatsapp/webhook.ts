import { Router } from 'express';
import crypto from 'crypto';
import { redis } from '../../services/redis.js';
import { messageQueue } from '../../workers/index.js';

export const whatsappWebhookRouter = Router();

// Webhook verification (GET) — Meta challenge
whatsappWebhookRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming messages (POST)
whatsappWebhookRouter.post('/', async (req, res) => {
  try {
    // Verify HMAC signature
    const sig = req.headers['x-hub-signature-256'] as string;
    const expected = 'sha256=' + crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (sig !== expected) return res.sendStatus(403);

    const { entry } = req.body;
    if (!Array.isArray(entry)) return res.sendStatus(200);

    for (const e of entry) {
      for (const change of (e.changes || [])) {
        const value = change.value;
        const messages = value?.messages;
        if (!messages?.length) continue;

        for (const msg of messages) {
          // Prevent duplicate processing
          const dedupKey = `wa:msg:${msg.id}`;
          const exists = await redis.get(dedupKey);
          if (exists) continue;
          await redis.set(dedupKey, '1', 'EX', 86400);

          await messageQueue.add('process-whatsapp', {
            externalId: msg.id,
            from: msg.from,
            type: msg.type,
            content: msg.text?.body || msg.caption || null,
            mediaId: msg.image?.id || msg.audio?.id || msg.document?.id || null,
            timestamp: msg.timestamp,
            phoneNumberId: value.metadata?.phone_number_id,
          });
        }
      }
    }

    return res.sendStatus(200);
  } catch {
    return res.sendStatus(200); // Always 200 to Meta
  }
});
