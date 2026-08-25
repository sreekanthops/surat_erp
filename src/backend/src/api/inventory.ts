import { Router } from 'express';
import { prisma } from '../services/db.js';
import { z } from 'zod';

export const inventoryRouter = Router();

// GET /api/v1/inventory/products
inventoryRouter.get('/products', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { search, category, page = '1', limit = '20' } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where: {
          tenantId,
          isActive: true,
          ...(search && { name: { contains: search, mode: 'insensitive' } }),
          ...(category && { category }),
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({
        where: {
          tenantId,
          isActive: true,
          ...(search && { name: { contains: search, mode: 'insensitive' } }),
          ...(category && { category }),
        },
      }),
    ]);

    return res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inventory/products
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

inventoryRouter.post('/products', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const data = createProductSchema.parse(req.body);
    const product = await prisma.product.create({ data: { ...data, tenantId } });
    return res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/movements
inventoryRouter.get('/movements', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { productId, from, to, type, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const data = await prisma.stockMovement.findMany({
      where: {
        tenantId,
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

// GET /api/v1/inventory/low-stock
inventoryRouter.get('/low-stock', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const data = await prisma.$queryRaw`
      SELECT id, name, category, unit, current_stock, reorder_level
      FROM products
      WHERE tenant_id = ${tenantId}::uuid
        AND is_active = true
        AND current_stock <= reorder_level
      ORDER BY (current_stock - reorder_level) ASC
    `;
    return res.json({ data });
  } catch (err) {
    next(err);
  }
});
