import { Router } from 'express';
import { prisma } from '../services/db.js';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { groupFilter } from '../middleware/groupFilter.js';

export const dashboardRouter = Router();

// GET /api/v1/dashboard/charts  — all chart data in one call
dashboardRouter.get('/charts', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);

    const now = new Date();
    const { from: fromQ, to: toQ } = req.query as Record<string, string>;

    // If custom range provided use it, else default to last 30 days / current month
    const rangeFrom = fromQ ? new Date(fromQ) : (() => { const d = new Date(now); d.setDate(now.getDate() - 29); d.setHours(0,0,0,0); return d; })();
    const rangeTo   = toQ   ? (() => { const d = new Date(toQ); d.setHours(23,59,59,999); return d; })() : now;

    const day30ago    = rangeFrom;
    const monthStart  = fromQ ? rangeFrom : new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

    // For monthly trend: span from 6 months before rangeFrom if custom, else last 6 months
    const trendStart = fromQ
      ? (() => { const d = new Date(rangeFrom); d.setMonth(d.getMonth() - 5); d.setDate(1); d.setHours(0,0,0,0); return d; })()
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [dailyRaw, topProductsRaw, statusBreakdown, categoryRaw, monthlyTrendRaw, prevMonth] = await Promise.all([

      // Daily sales last 30 days — camelCase cols (Prisma default)
      prisma.$queryRawUnsafe(`
        SELECT DATE(date) as day, SUM("totalAmount")::float as amount, COUNT(*)::int as count
        FROM transactions
        WHERE "tenantId" = '${tenantId}'::uuid
          AND type = 'SALE'::"TransactionType"
          AND date >= $1 AND date <= $2
          ${gf.groupId === undefined ? '' : gf.groupId === null ? 'AND "groupId" IS NULL' : `AND "groupId" = '${gf.groupId}'::uuid`}
        GROUP BY DATE(date) ORDER BY day
      `, day30ago, rangeTo) as Promise<any[]>,

      // Top 6 products by revenue in selected range
      prisma.$queryRawUnsafe(`
        SELECT ti."productName" as name,
               SUM(ti."totalAmount")::float as revenue,
               SUM(ti.quantity)::float as qty
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti."transactionId"
        WHERE t."tenantId" = '${tenantId}'::uuid
          AND t.type = 'SALE'::"TransactionType"
          AND t.date >= $1 AND t.date <= $2
          ${gf.groupId === undefined ? '' : gf.groupId === null ? 'AND t."groupId" IS NULL' : `AND t."groupId" = '${gf.groupId}'::uuid`}
        GROUP BY ti."productName"
        ORDER BY revenue DESC LIMIT 6
      `, rangeFrom, rangeTo) as Promise<any[]>,

      // Payment status breakdown — within selected range
      prisma.transaction.groupBy({
        by: ['status'],
        where: { tenantId, ...gf, type: TransactionType.SALE, date: { gte: rangeFrom, lte: rangeTo } },
        _count: true,
        _sum: { totalAmount: true },
      }),

      // Sales by product category in selected range
      prisma.$queryRawUnsafe(`
        SELECT COALESCE(p.category, 'Other') as category,
               SUM(ti."totalAmount")::float as revenue
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti."transactionId"
        LEFT JOIN products p ON p.id = ti."productId"
        WHERE t."tenantId" = '${tenantId}'::uuid
          AND t.type = 'SALE'::"TransactionType"
          AND t.date >= $1 AND t.date <= $2
          ${gf.groupId === undefined ? '' : gf.groupId === null ? 'AND t."groupId" IS NULL' : `AND t."groupId" = '${gf.groupId}'::uuid`}
        GROUP BY COALESCE(p.category, 'Other')
        ORDER BY revenue DESC
      `, rangeFrom, rangeTo) as Promise<any[]>,

      // Monthly revenue (span of selected range or last 6 months)
      prisma.$queryRawUnsafe(`
        SELECT TO_CHAR(DATE_TRUNC('month', date), 'Mon YY') as month,
               DATE_TRUNC('month', date) as month_date,
               SUM(CASE WHEN type='SALE'::"TransactionType" THEN "totalAmount" ELSE 0 END)::float as sales,
               SUM(CASE WHEN type='PURCHASE'::"TransactionType" THEN "totalAmount" ELSE 0 END)::float as purchases
        FROM transactions
        WHERE "tenantId" = '${tenantId}'::uuid
          AND date >= $1
          ${gf.groupId === undefined ? '' : gf.groupId === null ? 'AND "groupId" IS NULL' : `AND "groupId" = '${gf.groupId}'::uuid`}
        GROUP BY DATE_TRUNC('month', date), TO_CHAR(DATE_TRUNC('month', date), 'Mon YY')
        ORDER BY month_date
      `, trendStart) as Promise<any[]>,      // intentionally no upper bound — show full months including future if range spans them

      // Prev period sales for MoM comparison
      prisma.transaction.aggregate({
        where: { tenantId, ...gf, type: TransactionType.SALE, date: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { totalAmount: true },
      }),
    ]);

    // Fill in missing days with 0 across the selected range
    const totalDays = Math.min(Math.ceil((rangeTo.getTime() - rangeFrom.getTime()) / 86400000) + 1, 90);
    const dailyMap = new Map<string, { amount: number; count: number }>();
    for (const r of dailyRaw) {
      dailyMap.set(new Date(r.day).toISOString().split('T')[0], { amount: r.amount, count: r.count });
    }
    const daily30: { day: string; amount: number; count: number }[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(rangeTo); d.setDate(rangeTo.getDate() - i); d.setHours(0,0,0,0);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const entry = dailyMap.get(key);
      daily30.push({ day: label, amount: entry?.amount ?? 0, count: entry?.count ?? 0 });
    }

    const statusPie = statusBreakdown.map(s => ({
      name: s.status,
      value: Number(s._sum.totalAmount ?? 0),
      count: s._count,
    }));

    const currentMonthSales = Number((await prisma.transaction.aggregate({
      where: { tenantId, ...gf, type: TransactionType.SALE, date: { gte: rangeFrom, lte: rangeTo } },
      _sum: { totalAmount: true },
    }))._sum.totalAmount ?? 0);

    const prevMonthSales = Number(prevMonth._sum.totalAmount ?? 0);
    const momGrowth = prevMonthSales > 0 ? ((currentMonthSales - prevMonthSales) / prevMonthSales * 100) : 0;

    return res.json({
      daily30,
      topProducts: topProductsRaw,
      statusPie,
      categoryPie: categoryRaw,
      monthlyTrend: monthlyTrendRaw,
      momGrowth: Math.round(momGrowth * 10) / 10,
      currentMonthSales,
      prevMonthSales,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/dashboard/summary
dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const gf = groupFilter(req);
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
      prisma.transaction.aggregate({
        where: { tenantId, ...gf, type: TransactionType.SALE, date: { gte: today } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { tenantId, ...gf, type: TransactionType.PURCHASE, date: { gte: today } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { tenantId, ...gf, type: TransactionType.SALE, date: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { tenantId, ...gf, type: TransactionType.PURCHASE, date: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          tenantId, ...gf,
          type: TransactionType.SALE,
          status: { in: [TransactionStatus.PENDING, TransactionStatus.PARTIAL] },
        },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.product.findMany({
        where: { tenantId, ...gf, isActive: true, currentStock: { lte: prisma.product.fields.reorderLevel } },
        select: { id: true, name: true, currentStock: true, reorderLevel: true, unit: true },
        take: 5,
      }),
      prisma.transaction.findMany({
        where: {
          tenantId, ...gf,
          type: TransactionType.SALE,
          status: { in: [TransactionStatus.PENDING, TransactionStatus.PARTIAL] },
          dueDate: { lt: today },
        },
        include: { party: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.message.count({
        where: { tenantId, ...gf, direction: 'INBOUND', isRead: false },
      }),
      prisma.lead.count({
        where: { tenantId, ...gf, createdAt: { gte: today } },
      }),
    ]);

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
    const gf = groupFilter(req);
    const days = parseInt(req.query.days as string) || 30;
    const from = new Date();
    from.setDate(from.getDate() - days);

    const rows = await prisma.cashFlowDaily.findMany({
      where: { tenantId, ...gf, date: { gte: from } },
      orderBy: { date: 'asc' },
    });

    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});
