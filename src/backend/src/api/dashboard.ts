import { Router } from 'express';
import { prisma } from '../services/db.js';
import { TransactionType, TransactionStatus } from '@prisma/client';

export const dashboardRouter = Router();

// GET /api/v1/dashboard/summary
dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todaySales,
      todayPurchases,
      monthSales,
      monthPurchases,
      pendingPayments,
      lowStockProducts,
      overdueTransactions,
      newMessages,
      newLeads,
    ] = await Promise.all([
      // Today's sales
      prisma.transaction.aggregate({
        where: { tenantId, type: TransactionType.SALE, date: { gte: today } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Today's purchases
      prisma.transaction.aggregate({
        where: { tenantId, type: TransactionType.PURCHASE, date: { gte: today } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      // Month sales
      prisma.transaction.aggregate({
        where: { tenantId, type: TransactionType.SALE, date: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      // Month purchases
      prisma.transaction.aggregate({
        where: { tenantId, type: TransactionType.PURCHASE, date: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      // Pending payments total
      prisma.transaction.aggregate({
        where: {
          tenantId,
          type: TransactionType.SALE,
          status: { in: [TransactionStatus.PENDING, TransactionStatus.PARTIAL] },
        },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      // Low stock products
      prisma.product.findMany({
        where: { tenantId, isActive: true, currentStock: { lte: prisma.product.fields.reorderLevel } },
        select: { id: true, name: true, currentStock: true, reorderLevel: true, unit: true },
        take: 5,
      }),
      // Overdue transactions (due date passed, not fully paid)
      prisma.transaction.findMany({
        where: {
          tenantId,
          type: TransactionType.SALE,
          status: { in: [TransactionStatus.PENDING, TransactionStatus.PARTIAL] },
          dueDate: { lt: today },
        },
        include: { party: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      // Unread messages today
      prisma.message.count({
        where: { tenantId, direction: 'INBOUND', isRead: false },
      }),
      // New leads today
      prisma.lead.count({
        where: { tenantId, createdAt: { gte: today } },
      }),
    ]);

    // Simple profit estimate: sales - purchases for month
    const monthSalesAmt = Number(monthSales._sum.totalAmount ?? 0);
    const monthPurchasesAmt = Number(monthPurchases._sum.totalAmount ?? 0);
    const profitAmount = monthSalesAmt - monthPurchasesAmt;
    const profitMargin = monthSalesAmt > 0 ? (profitAmount / monthSalesAmt) * 100 : 0;

    const pendingTotal = Number(pendingPayments._sum.totalAmount ?? 0) -
      Number(pendingPayments._sum.paidAmount ?? 0);

    return res.json({
      today: {
        salesAmount: Number(todaySales._sum.totalAmount ?? 0),
        salesCount: todaySales._count,
        purchaseAmount: Number(todayPurchases._sum.totalAmount ?? 0),
        newMessages,
        newLeads,
      },
      month: {
        salesAmount: monthSalesAmt,
        purchaseAmount: monthPurchasesAmt,
        profitAmount,
        profitMargin: Math.round(profitMargin * 10) / 10,
      },
      alerts: {
        pendingPayments: pendingTotal,
        lowStockProducts,
        overdueTransactions: overdueTransactions.map((t) => ({
          id: t.id,
          party: t.party?.name,
          amount: Number(t.totalAmount) - Number(t.paidAmount),
          dueDate: t.dueDate,
          daysPastDue: t.dueDate
            ? Math.floor((today.getTime() - t.dueDate.getTime()) / 86400000)
            : 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/cash-flow?days=30
dashboardRouter.get('/cash-flow', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const days = parseInt(req.query.days as string) || 30;
    const from = new Date();
    from.setDate(from.getDate() - days);

    const rows = await prisma.cashFlowDaily.findMany({
      where: { tenantId, date: { gte: from } },
      orderBy: { date: 'asc' },
    });

    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});
