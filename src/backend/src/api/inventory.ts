import { Router } from 'express';
import { prisma } from '../services/db.js';
import { z } from 'zod';
import { groupFilter, groupWrite } from '../middleware/groupFilter.js';

export const inventoryRouter = Router();

// ── POST /api/v1/inventory/movements — manual adjustment / inward / return ────
const movementSchema = z.object({
  productId:  z.string().uuid(),
  type:       z.enum(['PURCHASE', 'ADJUSTMENT', 'DAMAGE', 'SAMPLE', 'OPENING', 'RETURN_IN', 'RETURN_OUT']),
  quantity:   z.number(),          // positive = add stock, negative = remove
  rate:       z.number().optional(),
  batchNo:    z.string().optional(),
  notes:      z.string().optional(),
  godownId:   z.string().uuid().optional(),
});

inventoryRouter.post('/movements', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId  = groupWrite(req);
    const body     = movementSchema.parse(req.body);

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const movement = await prisma.$transaction(async (tx) => {
      const mv = await tx.stockMovement.create({
        data: {
          tenantId, groupId,
          productId: body.productId,
          type:      body.type as any,
          quantity:  body.quantity,
          rate:      body.rate,
          batchNo:   body.batchNo,
          notes:     body.notes,
          godownId:  body.godownId,
        },
      });
      // Update currentStock
      await tx.product.update({
        where: { id: body.productId },
        data:  { currentStock: { increment: body.quantity } },
      });
      return mv;
    });

    return res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/inventory/stock-inward — quick purchase entry ───────────────
const inwardSchema = z.object({
  productId:  z.string().uuid(),
  quantity:   z.number().positive(),
  rate:       z.number().optional(),
  partyId:    z.string().uuid().optional(),
  batchNo:    z.string().optional(),
  notes:      z.string().optional(),
  date:       z.string().optional(),
});

inventoryRouter.post('/stock-inward', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId  = groupWrite(req);
    const body     = inwardSchema.parse(req.body);

    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const entryDate = body.date ? new Date(body.date) : new Date();

    await prisma.$transaction(async (tx) => {
      // Create stock movement
      await tx.stockMovement.create({
        data: {
          tenantId, groupId,
          productId: body.productId,
          type:      'PURCHASE',
          quantity:  body.quantity,
          rate:      body.rate ?? product.purchaseRate,
          batchNo:   body.batchNo,
          notes:     body.notes || 'Quick stock inward',
        },
      });
      // Update stock
      await tx.product.update({
        where: { id: body.productId },
        data:  { currentStock: { increment: body.quantity } },
      });
      // Optionally create a PURCHASE transaction record
      if (body.partyId && body.rate) {
        const totalAmount = body.quantity * body.rate;
        const count = await tx.transaction.count({ where: { tenantId, type: 'PURCHASE' } });
        await tx.transaction.create({
          data: {
            tenantId, groupId,
            type:        'PURCHASE',
            partyId:     body.partyId,
            referenceNo: `PUR-${entryDate.getFullYear()}-${String(count + 1).padStart(4, '0')}`,
            date:        entryDate,
            totalAmount,
            paidAmount:  0,
            subtotal:    totalAmount,
            taxableAmount: totalAmount,
            status:      'PENDING',
            notes:       body.notes,
            items: {
              create: [{
                productId:   body.productId,
                productName: product.name,
                quantity:    body.quantity,
                unit:        product.unit,
                rate:        body.rate,
                amount:      totalAmount,
                totalAmount,
                sortOrder:   0,
              }],
            },
          },
        });
      }
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/inventory/sales-return — customer return ────────────────────
const salesReturnSchema = z.object({
  transactionId: z.string().uuid().optional(),
  productId:     z.string().uuid(),
  quantity:      z.number().positive(),
  rate:          z.number().optional(),
  notes:         z.string().optional(),
});

inventoryRouter.post('/sales-return', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId  = groupWrite(req);
    const body     = salesReturnSchema.parse(req.body);

    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          tenantId, groupId,
          productId:     body.productId,
          transactionId: body.transactionId,
          type:          'RETURN_IN',
          quantity:      body.quantity,
          rate:          body.rate ?? product.saleRate,
          notes:         body.notes || 'Customer return',
        },
      });
      await tx.product.update({
        where: { id: body.productId },
        data:  { currentStock: { increment: body.quantity } },
      });
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/inventory/purchase-return — return to supplier ───────────────
const purchaseReturnSchema = z.object({
  productId: z.string().uuid(),
  quantity:  z.number().positive(),
  rate:      z.number().optional(),
  notes:     z.string().optional(),
});

inventoryRouter.post('/purchase-return', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId  = groupWrite(req);
    const body     = purchaseReturnSchema.parse(req.body);

    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (Number(product.currentStock) < body.quantity) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${product.currentStock} ${product.unit}` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          tenantId, groupId,
          productId: body.productId,
          type:      'RETURN_OUT',
          quantity:  -body.quantity,
          rate:      body.rate ?? product.purchaseRate,
          notes:     body.notes || 'Return to supplier',
        },
      });
      await tx.product.update({
        where: { id: body.productId },
        data:  { currentStock: { decrement: body.quantity } },
      });
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/inventory/valuation — stock valuation report ─────────────────
inventoryRouter.get('/valuation', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);

    const products = await prisma.product.findMany({
      where: { tenantId, ...gf, isActive: true },
      orderBy: { category: 'asc' },
    });

    const data = products.map((p) => {
      const stock     = Number(p.currentStock);
      const buyRate   = Number(p.purchaseRate ?? 0);
      const sellRate  = Number(p.saleRate ?? 0);
      const costValue = stock * buyRate;
      const sellValue = stock * sellRate;
      const margin    = sellRate > 0 ? ((sellRate - buyRate) / sellRate) * 100 : 0;
      return {
        id: p.id, name: p.name, code: p.code, category: p.category,
        unit: p.unit, currentStock: stock, purchaseRate: buyRate,
        saleRate: sellRate, costValue, sellValue,
        potentialProfit: sellValue - costValue,
        marginPct: Math.round(margin * 10) / 10,
        status: stock === 0 ? 'out' : stock <= Number(p.reorderLevel) ? 'low' : 'ok',
      };
    });

    const totals = data.reduce((acc, p) => ({
      totalCostValue:    acc.totalCostValue    + p.costValue,
      totalSellValue:    acc.totalSellValue    + p.sellValue,
      totalPotentialProfit: acc.totalPotentialProfit + p.potentialProfit,
    }), { totalCostValue: 0, totalSellValue: 0, totalPotentialProfit: 0 });

    return res.json({ data, ...totals });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/products
inventoryRouter.get('/products', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const { search, category, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      tenantId, ...gf,
      isActive: true,
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
      ...(category && { category }),
    };

    const [data, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip, take: parseInt(limit) }),
      prisma.product.count({ where }),
    ]);

    return res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

const createProductSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  unit: z.enum(['METER', 'KG', 'PIECE', 'BUNDLE', 'BOX', 'ROLL']).default('METER'),
  hsnCode: z.string().optional(),
  gstRate: z.number().default(5),
  purchaseRate: z.number().optional(),
  saleRate: z.number().optional(),
  currentStock: z.number().default(0),
  reorderLevel: z.number().default(0),
  maxStock: z.number().optional(),
});

// POST /api/v1/inventory/products
inventoryRouter.post('/products', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId = groupWrite(req);
    const data = createProductSchema.parse(req.body);
    const product = await prisma.product.create({ data: { ...data, tenantId, groupId } });
    return res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/movements
inventoryRouter.get('/movements', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const { productId, from, to, type, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const data = await prisma.stockMovement.findMany({
      where: {
        tenantId, ...gf,
        ...(productId && { productId }),
        ...(type && { type: type as any }),
        ...(from && to && { createdAt: { gte: new Date(from), lte: new Date(to) } }),
      },
      include: {
        product: { select: { name: true, unit: true } },
        godown: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    });

    return res.json({ data });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/inventory/products/:id
inventoryRouter.put('/products/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const data = createProductSchema.partial().parse(req.body);
    const product = await prisma.product.updateMany({
      where: { id: req.params.id, tenantId, ...gf },
      data,
    });
    if (!product.count) return res.status(404).json({ error: 'Product not found' });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/inventory/products/:id
inventoryRouter.delete('/products/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    await prisma.product.updateMany({
      where: { id: req.params.id, tenantId, ...gf },
      data: { isActive: false },
    });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/v1/inventory/low-stock
inventoryRouter.get('/low-stock', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const groupCondition = gf.groupId === undefined
      ? ''
      : gf.groupId === null
        ? 'AND group_id IS NULL'
        : `AND group_id = '${gf.groupId}'::uuid`;

    const data = await prisma.$queryRawUnsafe(`
      SELECT id, name, category, unit, current_stock, reorder_level
      FROM products
      WHERE tenant_id = '${tenantId}'::uuid
        AND is_active = true
        AND current_stock <= reorder_level
        ${groupCondition}
      ORDER BY (current_stock - reorder_level) ASC
    `);
    return res.json({ data });
  } catch (err) {
    next(err);
  }
});
