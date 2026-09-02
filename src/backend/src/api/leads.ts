import { Router } from 'express';
import { prisma } from '../services/db.js';
import { z } from 'zod';
import { groupFilter, groupWrite } from '../middleware/groupFilter.js';

export const leadsRouter = Router();

// GET /api/v1/leads
leadsRouter.get('/', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const { status, source, assignedTo, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      tenantId, ...gf,
      ...(status && { status: status as any }),
      ...(source && { source: source as any }),
      ...(assignedTo && { assignedToId: assignedTo }),
    };

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          party: { select: { id: true, name: true, phone: true, city: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.lead.count({ where }),
    ]);

    return res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

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

// POST /api/v1/leads
leadsRouter.post('/', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId = groupWrite(req);
    const data = createLeadSchema.parse(req.body);
    const lead = await prisma.lead.create({
      data: {
        ...data,
        tenantId,
        groupId,
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
    const gf = groupFilter(req);
    const data = createLeadSchema.partial().parse(req.body);
    const result = await prisma.lead.updateMany({
      where: { id: req.params.id, tenantId, ...gf },
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
    const gf = groupFilter(req);
    await prisma.lead.deleteMany({ where: { id: req.params.id, tenantId, ...gf } });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/leads/:id/status
leadsRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const { status, quotedValue, notes, lostReason, wonTransactionId } = req.body;

    const lead = await prisma.lead.updateMany({
      where: { id: req.params.id, tenantId, ...gf },
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
