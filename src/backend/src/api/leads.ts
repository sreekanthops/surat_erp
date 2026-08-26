import { Router } from 'express';
import { prisma } from '../services/db.js';
import { z } from 'zod';

export const leadsRouter = Router();

// GET /api/v1/leads
leadsRouter.get('/', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { status, source, assignedTo, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where: {
          tenantId,
          ...(status && { status: status as any }),
          ...(source && { source: source as any }),
          ...(assignedTo && { assignedToId: assignedTo }),
        },
        include: {
          party: { select: { id: true, name: true, phone: true, city: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.lead.count({ where: { tenantId, ...(status && { status: status as any }) } }),
    ]);

    return res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/leads
const createLeadSchema = z.object({
  partyId: z.string().uuid().optional(),
  title: z.string().optional(),
  source: z.enum(['WHATSAPP', 'GMAIL', 'REFERRAL', 'WALK_IN', 'COLD_CALL', 'EXHIBITION', 'MANUAL']).optional(),
  productInterest: z.string().optional(),
  estimatedQty: z.number().optional(),
  estimatedValue: z.number().optional(),
  assignedToId: z.string().uuid().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
});

leadsRouter.post('/', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const data = createLeadSchema.parse(req.body);
    const lead = await prisma.lead.create({
      data: {
        ...data,
        tenantId,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      },
      include: { party: true },
    });
    return res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/leads/:id
leadsRouter.put('/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const data = createLeadSchema.partial().parse(req.body);
    const result = await prisma.lead.updateMany({
      where: { id: req.params.id, tenantId },
      data: { ...data, followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined },
    });
    if (!result.count) return res.status(404).json({ error: 'Lead not found' });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/leads/:id
leadsRouter.delete('/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    await prisma.lead.deleteMany({ where: { id: req.params.id, tenantId } });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/leads/:id/status
leadsRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { status, quotedValue, notes, lostReason, wonTransactionId } = req.body;

    const lead = await prisma.lead.updateMany({
      where: { id: req.params.id, tenantId },
      data: {
        status,
        ...(quotedValue !== undefined && { quotedValue }),
        ...(notes && { notes }),
        ...(lostReason && { lostReason }),
        ...(wonTransactionId && { wonTransactionId }),
      },
    });

    return res.json({ ok: true, updated: lead.count });
  } catch (err) {
    next(err);
  }
});
