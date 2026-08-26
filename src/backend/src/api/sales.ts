import { Router } from 'express';
import { prisma } from '../services/db.js';
import { z } from 'zod';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { io } from '../index.js';

export const salesRouter = Router();

const transactionItemSchema = z.object({
  productId: z.string().uuid().optional(),
  productName: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  rate: z.number().positive(),
  discountPct: z.number().default(0),
  gstRate: z.number().optional(),
  godownId: z.string().uuid().optional(),
  batchNo: z.string().optional(),
});

const createInvoiceSchema = z.object({
  partyId: z.string().uuid(),
  date: z.string().default(() => new Date().toISOString()),
  dueDate: z.string().optional(),
  items: z.array(transactionItemSchema).min(1),
  paymentMode: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/v1/sales/invoices
salesRouter.get('/invoices', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { from, to, partyId, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          tenantId,
          type: TransactionType.SALE,
          ...(partyId && { partyId }),
          ...(status && { status: status as TransactionStatus }),
          ...(from && to && { date: { gte: new Date(from), lte: new Date(to) } }),
        },
        include: { party: { select: { id: true, name: true, phone: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({
        where: {
          tenantId,
          type: TransactionType.SALE,
          ...(partyId && { partyId }),
          ...(status && { status: status as TransactionStatus }),
          ...(from && to && { date: { gte: new Date(from), lte: new Date(to) } }),
        },
      }),
    ]);

    return res.json({ data, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sales/invoices/:id
salesRouter.get('/invoices/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const invoice = await prisma.transaction.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        party: true,
        items: { include: { product: { select: { name: true, unit: true } } } },
        createdBy: { select: { name: true } },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    return res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sales/invoices
salesRouter.post('/invoices', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const userId = (req as any).user.userId;
    const body = createInvoiceSchema.parse(req.body);

    // Calculate totals
    let subtotal = 0;
    const processedItems = body.items.map((item, idx) => {
      const amount = item.quantity * item.rate * (1 - (item.discountPct || 0) / 100);
      const gstAmount = item.gstRate ? amount * (item.gstRate / 100) : 0;
      subtotal += amount;
      return { ...item, amount, gstAmount, totalAmount: amount + gstAmount, sortOrder: idx };
    });

    const totalGst = processedItems.reduce((s, i) => s + (i.gstAmount || 0), 0);
    const totalAmount = subtotal + totalGst;

    // Auto-generate reference number
    const count = await prisma.transaction.count({ where: { tenantId, type: TransactionType.SALE } });
    const referenceNo = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.$transaction(async (tx) => {
      // Create transaction
      const trx = await tx.transaction.create({
        data: {
          tenantId,
          type: TransactionType.SALE,
          partyId: body.partyId,
          referenceNo,
          date: new Date(body.date),
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          subtotal,
          taxableAmount: subtotal,
          totalAmount,
          status: TransactionStatus.PENDING,
          paymentMode: body.paymentMode,
          notes: body.notes,
          createdById: userId,
          items: { create: processedItems },
        },
        include: { party: true, items: true },
      });

      // Deduct stock for each item
      for (const item of processedItems) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: item.productId,
              transactionId: trx.id,
              godownId: item.godownId,
              type: 'SALE',
              quantity: -item.quantity,
              rate: item.rate,
              batchNo: item.batchNo,
            },
          });
        }
      }

      // Update party balance
      await tx.party.update({
        where: { id: body.partyId },
        data: { currentBalance: { increment: totalAmount } },
      });

      return trx;
    });

    // Push real-time event
    io.to(`tenant:${tenantId}`).emit('stock_updated', { type: 'sale', invoiceId: invoice.id });

    return res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/sales/invoices/:id
salesRouter.delete('/invoices/:id', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const inv = await prisma.transaction.findFirst({ where: { id: req.params.id, tenantId }, include: { items: true } });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    await prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of inv.items) {
        if (item.productId) {
          await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: Number(item.quantity) } } });
        }
      }
      // Reverse party balance
      if (inv.partyId) {
        await tx.party.update({ where: { id: inv.partyId }, data: { currentBalance: { decrement: Number(inv.totalAmount) } } });
      }
      await tx.transactionItem.deleteMany({ where: { transactionId: req.params.id } });
      await tx.transaction.delete({ where: { id: req.params.id } });
    });
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/sales/invoices/:id/payment
salesRouter.patch('/invoices/:id/payment', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { amount, paymentMode } = req.body;
    const inv = await prisma.transaction.findFirst({ where: { id: req.params.id, tenantId } });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const newPaid = Math.min(Number(inv.paidAmount) + Number(amount), Number(inv.totalAmount));
    const status = newPaid >= Number(inv.totalAmount) ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING';
    await prisma.transaction.update({
      where: { id: req.params.id },
      data: { paidAmount: newPaid, status: status as any, paymentMode },
    });
    // Reduce party balance by payment amount
    if (inv.partyId) {
      await prisma.party.update({ where: { id: inv.partyId }, data: { currentBalance: { decrement: Number(amount) } } });
    }
    return res.json({ ok: true, paidAmount: newPaid, status });
  } catch (err) { next(err); }
});

// GET /api/v1/sales/analytics
salesRouter.get('/analytics', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { from, to } = req.query as Record<string, string>;

    const fromDate = from ? new Date(from) : new Date(new Date().setDate(1)); // month start
    const toDate = to ? new Date(to) : new Date();

    const dailySales = await prisma.$queryRaw`
      SELECT DATE(date) as day, 
             SUM(total_amount) as amount, 
             COUNT(*) as count
      FROM transactions
      WHERE tenant_id = ${tenantId}::uuid
        AND type = 'SALE'
        AND date BETWEEN ${fromDate} AND ${toDate}
      GROUP BY DATE(date)
      ORDER BY day
    `;

    return res.json({ data: dailySales });
  } catch (err) {
    next(err);
  }
});
