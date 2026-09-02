import { Router } from 'express';
import { prisma } from '../services/db.js';
import { z } from 'zod';
import { groupFilter, groupWrite } from '../middleware/groupFilter.js';

export const partiesRouter = Router();

// GET /api/v1/parties
partiesRouter.get('/', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const { search, type, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      tenantId, ...gf,
      ...(type && { type: type as any }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.party.findMany({ where, orderBy: { name: 'asc' }, skip, take: parseInt(limit) }),
      prisma.party.count({ where }),
    ]);

    return res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/parties/:id/ledger
partiesRouter.get('/:id/ledger', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);

    const party = await prisma.party.findFirst({ where: { id: req.params.id, tenantId, ...gf } });
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const { from, to } = req.query as Record<string, string>;
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId, ...gf,
        partyId: req.params.id,
        ...(from && to && { date: { gte: new Date(from), lte: new Date(to) } }),
      },
      orderBy: { date: 'asc' },
    });

    return res.json({ party, transactions, balance: Number(party.currentBalance) });
  } catch (err) {
    next(err);
  }
});

const createPartySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']).default('CUSTOMER'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  gstin: z.string().optional(),
  creditLimit: z.number().default(0),
  notes: z.string().optional(),
});

// POST /api/v1/parties
partiesRouter.post('/', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId = groupWrite(req);
    const data = createPartySchema.parse(req.body);
    const party = await prisma.party.create({ data: { ...data, tenantId, groupId } });
    return res.status(201).json(party);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/parties/:id
partiesRouter.put('/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const data = createPartySchema.partial().parse(req.body);
    const result = await prisma.party.updateMany({ where: { id: req.params.id, tenantId, ...gf }, data });
    if (!result.count) return res.status(404).json({ error: 'Party not found' });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/parties/:id
partiesRouter.delete('/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    await prisma.party.deleteMany({ where: { id: req.params.id, tenantId, ...gf } });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});
