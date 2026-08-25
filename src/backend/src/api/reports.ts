import { Router } from 'express';
import { prisma } from '../services/db.js';
import { TransactionType } from '@prisma/client';

export const reportsRouter = Router();

// GET /api/v1/reports/profit-loss?from=&to=
reportsRouter.get('/profit-loss', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { from, to } = req.query as Record<string, string>;
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
    const toDate = to ? new Date(to) : new Date();

    const [sales, purchases] = await Promise.all([
      prisma.transaction.aggregate({
        where: { tenantId, type: TransactionType.SALE, date: { gte: fromDate, lte: toDate } },
        _sum: { totalAmount: true, taxableAmount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { tenantId, type: TransactionType.PURCHASE, date: { gte: fromDate, lte: toDate } },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    const salesAmt = Number(sales._sum.totalAmount ?? 0);
    const purchasesAmt = Number(purchases._sum.totalAmount ?? 0);
    const grossProfit = salesAmt - purchasesAmt;
    const grossMargin = salesAmt > 0 ? (grossProfit / salesAmt) * 100 : 0;

    return res.json({
      period: { from: fromDate, to: toDate },
      sales: salesAmt,
      salesCount: sales._count,
      purchases: purchasesAmt,
      grossProfit,
      grossMargin: Math.round(grossMargin * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/stock-summary
reportsRouter.get('/stock-summary', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true, name: true, category: true, unit: true,
        currentStock: true, reorderLevel: true, purchaseRate: true, saleRate: true,
      },
      orderBy: { category: 'asc' },
    });

    const data = products.map((p) => ({
      ...p,
      stockValue: Number(p.currentStock) * Number(p.purchaseRate ?? 0),
      status: Number(p.currentStock) <= Number(p.reorderLevel)
        ? 'low'
        : Number(p.currentStock) === 0 ? 'out' : 'ok',
    }));

    const totalValue = data.reduce((s, p) => s + p.stockValue, 0);

    return res.json({ data, totalValue });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/party-outstanding
reportsRouter.get('/party-outstanding', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { type = 'CUSTOMER' } = req.query as Record<string, string>;

    const parties = await prisma.party.findMany({
      where: { tenantId, type: type as any, currentBalance: { gt: 0 } },
      orderBy: { currentBalance: 'desc' },
      select: { id: true, name: true, phone: true, city: true, currentBalance: true, creditLimit: true },
    });

    return res.json({ data: parties });
  } catch (err) {
    next(err);
  }
});
