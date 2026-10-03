import { Router } from 'express';
import { prisma } from '../services/db.js';
import { z } from 'zod';
import { groupFilter, groupWrite } from '../middleware/groupFilter.js';
import { requirePermission } from '../middleware/permissions.js';

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

inventoryRouter.post('/movements', requirePermission('inventory:stock_write'), async (req, res, next) => {
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

inventoryRouter.post('/stock-inward', requirePermission('inventory:stock_write'), async (req, res, next) => {
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

inventoryRouter.post('/sales-return', requirePermission('inventory:stock_write'), async (req, res, next) => {
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

inventoryRouter.post('/purchase-return', requirePermission('inventory:stock_write'), async (req, res, next) => {
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
inventoryRouter.post('/products', requirePermission('inventory:product_write'), async (req, res, next) => {
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
inventoryRouter.put('/products/:id', requirePermission('inventory:product_write'), async (req, res, next) => {
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
inventoryRouter.delete('/products/:id', requirePermission('inventory:product_delete'), async (req, res, next) => {
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

// ══════════════════════════════════════════════════════════════════════════════
// P3 — GODOWNS, STOCK TRANSFER, BULK IMPORT, STOCK AGING
// ══════════════════════════════════════════════════════════════════════════════

// ── Godown CRUD ───────────────────────────────────────────────────────────────

const godownSchema = z.object({
  name:    z.string().min(1),
  address: z.string().optional(),
});

// GET /api/v1/inventory/godowns
inventoryRouter.get('/godowns', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const data = await prisma.godown.findMany({
      where: { tenantId, ...gf, isActive: true },
      orderBy: { name: 'asc' },
    });
    return res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/v1/inventory/godowns
inventoryRouter.post('/godowns', requirePermission('inventory:godown_write'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId  = groupWrite(req);
    const body = godownSchema.parse(req.body);
    const godown = await prisma.godown.create({ data: { ...body, tenantId, groupId } });
    return res.status(201).json(godown);
  } catch (err) { next(err); }
});

// PUT /api/v1/inventory/godowns/:id
inventoryRouter.put('/godowns/:id', requirePermission('inventory:godown_write'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const body = godownSchema.partial().parse(req.body);
    const result = await prisma.godown.updateMany({
      where: { id: req.params.id, tenantId },
      data: body,
    });
    if (!result.count) return res.status(404).json({ error: 'Godown not found' });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/inventory/godowns/:id
inventoryRouter.delete('/godowns/:id', requirePermission('inventory:godown_write'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    await prisma.godown.updateMany({
      where: { id: req.params.id, tenantId },
      data: { isActive: false },
    });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Stock by Godown ───────────────────────────────────────────────────────────

// GET /api/v1/inventory/godowns/:id/stock — products + quantities for one godown
inventoryRouter.get('/godowns/:id/stock', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const godownId = req.params.id;

    // Verify godown belongs to tenant
    const godown = await prisma.godown.findFirst({ where: { id: godownId, tenantId } });
    if (!godown) return res.status(404).json({ error: 'Godown not found' });

    const data = await prisma.productStockByGodown.findMany({
      where: { tenantId, godownId },
      include: {
        product: {
          select: { id: true, name: true, code: true, unit: true, category: true, reorderLevel: true, saleRate: true, purchaseRate: true },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    return res.json({ godown, data });
  } catch (err) { next(err); }
});

// GET /api/v1/inventory/stock-by-godown — all products across all godowns
inventoryRouter.get('/stock-by-godown', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);

    const [godowns, stockRows] = await Promise.all([
      prisma.godown.findMany({ where: { tenantId, ...gf, isActive: true }, orderBy: { name: 'asc' } }),
      prisma.productStockByGodown.findMany({
        where: { tenantId },
        include: {
          product: { select: { id: true, name: true, code: true, unit: true, category: true } },
          godown:  { select: { id: true, name: true } },
        },
      }),
    ]);

    return res.json({ godowns, data: stockRows });
  } catch (err) { next(err); }
});

// ── Stock Transfer between Godowns ───────────────────────────────────────────

const transferSchema = z.object({
  productId:    z.string().uuid(),
  fromGodownId: z.string().uuid(),
  toGodownId:   z.string().uuid(),
  quantity:     z.number().positive(),
  notes:        z.string().optional(),
});

// POST /api/v1/inventory/transfer
inventoryRouter.post('/transfer', requirePermission('inventory:stock_write'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId  = groupWrite(req);
    const body = transferSchema.parse(req.body);

    if (body.fromGodownId === body.toGodownId) {
      return res.status(400).json({ error: 'Source and destination godown must be different' });
    }

    const [product, fromGodown, toGodown] = await Promise.all([
      prisma.product.findFirst({ where: { id: body.productId, tenantId } }),
      prisma.godown.findFirst({ where: { id: body.fromGodownId, tenantId } }),
      prisma.godown.findFirst({ where: { id: body.toGodownId, tenantId } }),
    ]);

    if (!product)    return res.status(404).json({ error: 'Product not found' });
    if (!fromGodown) return res.status(404).json({ error: 'Source godown not found' });
    if (!toGodown)   return res.status(404).json({ error: 'Destination godown not found' });

    // Check stock in source godown
    const fromStock = await prisma.productStockByGodown.findUnique({
      where: { productId_godownId: { productId: body.productId, godownId: body.fromGodownId } },
    });
    const available = Number(fromStock?.quantity ?? 0);
    if (available < body.quantity) {
      return res.status(400).json({ error: `Insufficient stock in ${fromGodown.name}. Available: ${available} ${product.unit}` });
    }

    await prisma.$transaction(async (tx) => {
      // Create TRANSFER_OUT movement from source
      await tx.stockMovement.create({
        data: {
          tenantId, groupId,
          productId: body.productId,
          godownId:  body.fromGodownId,
          type:      'TRANSFER_OUT',
          quantity:  -body.quantity,
          notes:     body.notes || `Transfer to ${toGodown.name}`,
        },
      });

      // Create TRANSFER_IN movement to destination
      await tx.stockMovement.create({
        data: {
          tenantId, groupId,
          productId: body.productId,
          godownId:  body.toGodownId,
          type:      'TRANSFER_IN',
          quantity:  body.quantity,
          notes:     body.notes || `Transfer from ${fromGodown.name}`,
        },
      });

      // Update ProductStockByGodown for source (decrement)
      await tx.productStockByGodown.upsert({
        where: { productId_godownId: { productId: body.productId, godownId: body.fromGodownId } },
        update: { quantity: { decrement: body.quantity } },
        create: { tenantId, productId: body.productId, godownId: body.fromGodownId, quantity: -body.quantity },
      });

      // Update ProductStockByGodown for destination (increment)
      await tx.productStockByGodown.upsert({
        where: { productId_godownId: { productId: body.productId, godownId: body.toGodownId } },
        update: { quantity: { increment: body.quantity } },
        create: { tenantId, productId: body.productId, godownId: body.toGodownId, quantity: body.quantity },
      });
    });

    return res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// ── Bulk CSV Import ───────────────────────────────────────────────────────────

// POST /api/v1/inventory/bulk-import
// Body: { products: Array<{name,code,category,subcategory,unit,hsnCode,gstRate,purchaseRate,saleRate,currentStock,reorderLevel,maxStock}> }
const bulkImportItemSchema = z.object({
  name:          z.string().min(1),
  code:          z.string().optional(),
  category:      z.string().optional(),
  subcategory:   z.string().optional(),
  unit:          z.enum(['METER', 'KG', 'PIECE', 'BUNDLE', 'BOX', 'ROLL']).default('METER'),
  hsnCode:       z.string().optional(),
  gstRate:       z.number().default(5),
  purchaseRate:  z.number().optional(),
  saleRate:      z.number().optional(),
  currentStock:  z.number().default(0),
  reorderLevel:  z.number().default(0),
  maxStock:      z.number().optional(),
});

inventoryRouter.post('/bulk-import', requirePermission('inventory:bulk_import'), async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const groupId  = groupWrite(req);
    const { products: rawProducts } = req.body as { products: unknown[] };

    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }
    if (rawProducts.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 products per import' });
    }

    const results = { created: 0, updated: 0, errors: [] as { row: number; error: string }[] };

    for (let i = 0; i < rawProducts.length; i++) {
      try {
        const item = bulkImportItemSchema.parse(rawProducts[i]);

        // If code provided, try to find existing product and update it
        if (item.code) {
          const existing = await prisma.product.findFirst({
            where: { tenantId, code: item.code, isActive: true },
          });
          if (existing) {
            await prisma.product.update({ where: { id: existing.id }, data: item });
            results.updated++;
            continue;
          }
        }

        // Otherwise create new
        await prisma.product.create({ data: { ...item, tenantId, groupId } });
        results.created++;
      } catch (e: any) {
        results.errors.push({ row: i + 1, error: e?.message || 'Invalid data' });
      }
    }

    return res.json(results);
  } catch (err) { next(err); }
});

// ── Stock Aging Report ────────────────────────────────────────────────────────

// GET /api/v1/inventory/aging?days=30,60,90
inventoryRouter.get('/aging', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
    const thresholds = [30, 60, 90, 180];

    // Get all active products
    const products = await prisma.product.findMany({
      where: { tenantId, ...gf, isActive: true },
      select: { id: true, name: true, code: true, category: true, unit: true, currentStock: true, purchaseRate: true, saleRate: true, reorderLevel: true },
    });

    // For each product get last sale movement date
    const productIds = products.map(p => p.id);

    const lastSales = await prisma.stockMovement.findMany({
      where: {
        tenantId,
        productId: { in: productIds },
        type: 'SALE',
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['productId'],
      select: { productId: true, createdAt: true },
    });

    const lastSaleMap = new Map(lastSales.map(s => [s.productId, s.createdAt]));
    const now = new Date();

    const data = products.map(p => {
      const lastSale = lastSaleMap.get(p.id);
      const daysSinceLastSale = lastSale
        ? Math.floor((now.getTime() - lastSale.getTime()) / 86400000)
        : null;

      const bucket = daysSinceLastSale === null ? 'never_sold'
        : daysSinceLastSale <= 30  ? '0_30'
        : daysSinceLastSale <= 60  ? '31_60'
        : daysSinceLastSale <= 90  ? '61_90'
        : daysSinceLastSale <= 180 ? '91_180'
        : 'over_180';

      const stockValue = Number(p.currentStock) * Number(p.purchaseRate ?? 0);

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        category: p.category,
        unit: p.unit,
        currentStock: Number(p.currentStock),
        purchaseRate: Number(p.purchaseRate ?? 0),
        saleRate: Number(p.saleRate ?? 0),
        stockValue,
        lastSaleDate: lastSale ?? null,
        daysSinceLastSale,
        bucket,
      };
    });

    // Summary counts by bucket
    const summary = {
      never_sold: data.filter(p => p.bucket === 'never_sold').length,
      '0_30':     data.filter(p => p.bucket === '0_30').length,
      '31_60':    data.filter(p => p.bucket === '31_60').length,
      '61_90':    data.filter(p => p.bucket === '61_90').length,
      '91_180':   data.filter(p => p.bucket === '91_180').length,
      over_180:   data.filter(p => p.bucket === 'over_180').length,
    };

    return res.json({ data: data.sort((a, b) => (b.daysSinceLastSale ?? 9999) - (a.daysSinceLastSale ?? 9999)), summary });
  } catch (err) { next(err); }
});
