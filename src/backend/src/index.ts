// Backend entry point
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { authRouter } from './api/auth.js';
import { adminRouter } from './api/admin.js';
import { dashboardRouter } from './api/dashboard.js';
import { inventoryRouter } from './api/inventory.js';
import { salesRouter } from './api/sales.js';
import { partiesRouter } from './api/parties.js';
import { messagesRouter } from './api/messages.js';
import { leadsRouter } from './api/leads.js';
import { aiRouter } from './api/ai.js';
import { reportsRouter } from './api/reports.js';
import { integrationsRouter, gmailCallbackRouter } from './api/integrations.js';
import { whatsappWebhookRouter } from './integrations/whatsapp/webhook.js';
import { gmailWebhookRouter } from './integrations/gmail/webhook.js';
import { razorpayWebhookRouter } from './integrations/razorpay/webhook.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { logger } from './services/logger.js';
import { initQueues } from './workers/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ── Socket.io ──────────────────────────────────────────────
export const io = new Server(server, {
  cors: { origin: process.env.APP_URL, credentials: true },
});

io.use((socket, next) => {
  // Validate JWT on WS connection
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const payload = verifyToken(token);
    (socket as any).tenantId = payload.tenantId;
    (socket as any).userId = payload.userId;
    socket.join(`tenant:${payload.tenantId}`);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

// ── Global Middleware ──────────────────────────────────────
app.use(helmet());
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.APP_URL as string]
  : [process.env.APP_URL || 'http://localhost:3000', 'http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// ── Public Webhooks (no auth) ──────────────────────────────
app.use('/webhooks/whatsapp', whatsappWebhookRouter);
app.use('/webhooks/gmail', gmailWebhookRouter);
app.use('/webhooks/razorpay', razorpayWebhookRouter);

// ── Auth Routes (no auth middleware) ──────────────────────
app.use('/api/v1/auth', authRouter);

// ── Gmail OAuth callback (no auth — Google redirects here without JWT) ────────
app.use('/api/v1/integrations/gmail/callback', gmailCallbackRouter);

// ── Protected Routes ──────────────────────────────────────
app.use('/api/v1', authMiddleware, tenantMiddleware);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/sales', salesRouter);
app.use('/api/v1/parties', partiesRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/leads', leadsRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/integrations', integrationsRouter);
app.use('/api/v1/admin', adminRouter);

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  logger.info(`🚀 Backend running on port ${PORT}`);
  await initQueues();
  logger.info('✅ BullMQ workers started');
});

// helper imported inline to avoid circular deps
import { verifyToken } from './services/jwt.js';
