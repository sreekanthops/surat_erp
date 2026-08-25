import { Router } from 'express';

export const gmailWebhookRouter = Router();

// Google Cloud Pub/Sub push endpoint
gmailWebhookRouter.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.data) return res.sendStatus(204);

    const decoded = Buffer.from(message.data, 'base64').toString('utf8');
    const notification = JSON.parse(decoded);

    // notification: { emailAddress, historyId }
    // TODO: look up tenant by Gmail address, queue a history fetch job
    // For now just acknowledge
    return res.sendStatus(204);
  } catch {
    return res.sendStatus(204);
  }
});
