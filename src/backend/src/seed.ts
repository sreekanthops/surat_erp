import { PrismaClient, TransactionType, TransactionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d; };
const dateOnly = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays  = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const rand     = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick     = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('🌱 Seeding database with rich dummy data...\n');

  // ── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { id: TENANT_ID },
    update: { name: 'GSpaces TextileIQ' },
    create: {
      id: TENANT_ID, name: 'GSpaces TextileIQ', gstin: '24AABCS1429B1ZB',
      address: 'Ring Road, Surat', city: 'Surat', state: 'Gujarat',
      phone: '7075077384', email: 'shah@shahfabrics.com',
      plan: 'GROWTH', planExpiresAt: addDays(new Date(), 365), isActive: true,
    },
  });
  console.log('✅ Tenant:', tenant.name);

  // ── Users ─────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where:  { phone: '7075077384' },
    update: {},
    create: { tenantId: TENANT_ID, name: 'Owner', phone: '7075077384', passwordHash: hash, role: 'OWNER', isActive: true },
  });
  await prisma.user.upsert({
    where:  { phone: '9876543210' },
    update: {},
    create: { tenantId: TENANT_ID, name: 'Ramesh Shah', phone: '9876543210', passwordHash: hash, role: 'MANAGER', isActive: true },
  });
  console.log('✅ Users created');

  // ── Godown ────────────────────────────────────────────────────────────────
  const godown = await prisma.godown.upsert({
    where:  { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000010', tenantId: TENANT_ID, name: 'Main Godown — Ring Road', address: 'Ring Road, Surat', isActive: true },
  });
  console.log('✅ Godown:', godown.name);

  // ── Products ──────────────────────────────────────────────────────────────
  const productDefs = [
    { id: '00000000-0000-0000-0000-000000000020', name: 'Georgette 4-Way', code: 'GEO-4W', category: 'Fabric', sub: 'Georgette', unit: 'METER', hsn: '5407', gst: 5, buy: 72, sell: 88, stock: 3200, reorder: 500 },
    { id: '00000000-0000-0000-0000-000000000021', name: 'Pure Chiffon',     code: 'CHF-PUR', category: 'Fabric', sub: 'Chiffon',   unit: 'METER', hsn: '5407', gst: 5, buy: 55, sell: 68, stock: 420,  reorder: 500 },
    { id: '00000000-0000-0000-0000-000000000022', name: 'Banarasi Silk',    code: 'SLK-BNR', category: 'Saree',  sub: 'Silk',      unit: 'PIECE', hsn: '5007', gst: 5, buy: 850, sell: 1100, stock: 180, reorder: 50 },
    { id: '00000000-0000-0000-0000-000000000023', name: 'Cotton Dress Material', code: 'CTN-DRS', category: 'Dress Material', sub: 'Cotton', unit: 'METER', hsn: '5208', gst: 5, buy: 42, sell: 58, stock: 1800, reorder: 300 },
    { id: '00000000-0000-0000-0000-000000000024', name: 'Velvet Upholstery', code: 'VLV-UPH', category: 'Fabric', sub: 'Velvet', unit: 'METER', hsn: '5801', gst: 12, buy: 180, sell: 240, stock: 600, reorder: 100 },
    { id: '00000000-0000-0000-0000-000000000025', name: 'Organza Embroidered', code: 'ORG-EMB', category: 'Fabric', sub: 'Organza', unit: 'METER', hsn: '5407', gst: 5, buy: 95, sell: 130, stock: 950, reorder: 200 },
  ] as const;

  const products = await Promise.all(productDefs.map((p) =>
    prisma.product.upsert({
      where:  { id: p.id },
      update: { currentStock: p.stock },
      create: {
        id: p.id, tenantId: TENANT_ID, name: p.name, code: p.code,
        category: p.category, subcategory: p.sub, unit: p.unit as any,
        hsnCode: p.hsn, gstRate: p.gst, purchaseRate: p.buy, saleRate: p.sell,
        currentStock: p.stock, reorderLevel: p.reorder,
      },
    })
  ));
  console.log('✅ Products:', products.map((p) => p.name).join(', '));

  // ── Parties ───────────────────────────────────────────────────────────────
  const partyDefs = [
    { id: '00000000-0000-0000-0000-000000000030', name: 'Sharma Traders',      type: 'CUSTOMER', phone: '9988776655', city: 'Ahmedabad', limit: 200000, bal: 45000 },
    { id: '00000000-0000-0000-0000-000000000031', name: 'Modi Fabrics',         type: 'CUSTOMER', phone: '9876512345', city: 'Surat',     limit: 100000, bal: 28000 },
    { id: '00000000-0000-0000-0000-000000000032', name: 'Patel Yarn Mills',     type: 'SUPPLIER', phone: '9090909090', city: 'Surat',     limit: 500000, bal: -85000 },
    { id: '00000000-0000-0000-0000-000000000033', name: 'Jain Saree House',     type: 'CUSTOMER', phone: '9111222333', city: 'Mumbai',    limit: 300000, bal: 62000 },
    { id: '00000000-0000-0000-0000-000000000034', name: 'Gupta Wholesale',      type: 'CUSTOMER', phone: '9444555666', city: 'Jaipur',    limit: 150000, bal: 0 },
    { id: '00000000-0000-0000-0000-000000000035', name: 'Rajesh Textiles',      type: 'CUSTOMER', phone: '9777888999', city: 'Bangalore', limit: 250000, bal: 91000 },
    { id: '00000000-0000-0000-0000-000000000036', name: 'Mehta Cloth Stores',   type: 'CUSTOMER', phone: '9222333444', city: 'Pune',      limit: 80000,  bal: 15000 },
    { id: '00000000-0000-0000-0000-000000000037', name: 'Silk India Suppliers', type: 'SUPPLIER', phone: '9333444555', city: 'Varanasi',  limit: 400000, bal: -120000 },
  ] as const;

  const parties = await Promise.all(partyDefs.map((p) =>
    prisma.party.upsert({
      where:  { id: p.id },
      update: { currentBalance: p.bal },
      create: {
        id: p.id, tenantId: TENANT_ID, name: p.name, type: p.type as any,
        phone: p.phone, whatsapp: p.phone, city: p.city, state: 'Gujarat',
        creditLimit: p.limit, currentBalance: p.bal,
      },
    })
  ));
  console.log('✅ Parties:', parties.map((p) => p.name).join(', '));

  const customers = parties.filter((_, i) => partyDefs[i].type === 'CUSTOMER');

  // ── Sales transactions — last 90 days ────────────────────────────────────
  console.log('\n📦 Creating 90 days of sales...');

  // Clean old transactions to avoid duplicates on re-seed
  await prisma.transactionItem.deleteMany({ where: { transaction: { tenantId: TENANT_ID } } });
  await prisma.transaction.deleteMany({ where: { tenantId: TENANT_ID } });

  const salesData: { day: number; party: typeof parties[0]; prod: typeof products[0]; qty: number; paid: number }[] = [];

  // Generate ~2-4 sales per day for last 90 days
  for (let d = 89; d >= 0; d--) {
    const count = rand(1, 4);
    for (let s = 0; s < count; s++) {
      salesData.push({
        day:   d,
        party: pick(customers),
        prod:  pick(products),
        qty:   rand(50, 800),
        paid:  rand(0, 1),   // 0 = unpaid, 1 = paid
      });
    }
  }

  let invNo = 1;
  for (const s of salesData) {
    const date       = daysAgo(s.day);
    const rate       = Number((s.prod as any).saleRate);
    const subtotal   = s.qty * rate;
    const gst        = Number((s.prod as any).gstRate);
    const gstAmt     = subtotal * gst / 100;
    const total      = subtotal + gstAmt;
    const paid       = s.paid ? total : (rand(0, 1) ? total * rand(3, 8) / 10 : 0);
    const status: TransactionStatus = paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
    const dueDate    = addDays(date, 30);

    await prisma.transaction.create({
      data: {
        tenantId:      TENANT_ID,
        type:          'SALE',
        partyId:       s.party.id,
        referenceNo:   `INV-2025-${String(invNo++).padStart(4, '0')}`,
        date:          dateOnly(date),
        dueDate:       dateOnly(dueDate),
        subtotal,
        taxableAmount: subtotal,
        cgstAmount:    gstAmt / 2,
        sgstAmount:    gstAmt / 2,
        totalAmount:   total,
        paidAmount:    paid,
        status,
        paymentMode:   s.paid ? pick(['cash', 'upi', 'neft', 'cheque']) : 'credit',
        items: {
          create: [{
            productId:   s.prod.id,
            productName: s.prod.name,
            quantity:    s.qty,
            unit:        (s.prod as any).unit,
            rate,
            amount:      subtotal,
            gstRate:     gst,
            gstAmount:   gstAmt,
            totalAmount: total,
          }],
        },
      },
    });
  }
  console.log(`✅ Created ${salesData.length} sale transactions`);

  // ── Purchases — last 90 days ───────────────────────────────────────────────
  console.log('📥 Creating purchases...');
  const suppliers = parties.filter((_, i) => partyDefs[i].type === 'SUPPLIER');
  let purNo = 1;

  for (let d = 85; d >= 0; d -= rand(5, 12)) {
    const prod     = pick(products);
    const sup      = pick(suppliers);
    const qty      = rand(500, 3000);
    const rate     = Number((prod as any).purchaseRate);
    const subtotal = qty * rate;
    const gst      = Number((prod as any).gstRate);
    const gstAmt   = subtotal * gst / 100;
    const total    = subtotal + gstAmt;
    const date     = daysAgo(d);

    await prisma.transaction.create({
      data: {
        tenantId:      TENANT_ID,
        type:          'PURCHASE',
        partyId:       sup.id,
        referenceNo:   `PUR-2025-${String(purNo++).padStart(4, '0')}`,
        date:          dateOnly(date),
        dueDate:       dateOnly(addDays(date, 30)),
        subtotal,
        taxableAmount: subtotal,
        cgstAmount:    gstAmt / 2,
        sgstAmount:    gstAmt / 2,
        totalAmount:   total,
        paidAmount:    rand(0, 1) ? total : 0,
        status:        rand(0, 1) ? 'PAID' : 'PENDING',
        paymentMode:   pick(['neft', 'cheque', 'credit']),
        items: {
          create: [{
            productId:   prod.id,
            productName: prod.name,
            quantity:    qty,
            unit:        (prod as any).unit,
            rate,
            amount:      subtotal,
            gstRate:     gst,
            gstAmount:   gstAmt,
            totalAmount: total,
          }],
        },
      },
    });
  }
  console.log('✅ Purchases created');

  // ── Cash flow — last 30 days ───────────────────────────────────────────────
  console.log('💰 Creating cash flow...');
  await prisma.cashFlowDaily.deleteMany({ where: { tenantId: TENANT_ID } });

  let balance = 450000;
  for (let d = 29; d >= 0; d--) {
    const cashIn  = rand(15000, 95000);
    const cashOut = rand(8000,  55000);
    balance       = balance + cashIn - cashOut;
    await prisma.cashFlowDaily.create({
      data: {
        tenantId:       TENANT_ID,
        date:           dateOnly(daysAgo(d)),
        openingBalance: balance - cashIn + cashOut,
        cashIn,
        cashOut,
        closingBalance: balance,
        bankBalance:    balance + rand(20000, 80000),
      },
    });
  }
  console.log('✅ 30 days of cash flow created');

  // ── Stock movements ────────────────────────────────────────────────────────
  console.log('📊 Creating stock movements...');
  await prisma.stockMovement.deleteMany({ where: { tenantId: TENANT_ID } });

  for (const prod of products) {
    // Opening stock
    await prisma.stockMovement.create({
      data: {
        tenantId:  TENANT_ID,
        productId: prod.id,
        godownId:  godown.id,
        type:      'OPENING',
        quantity:  Number((prod as any).currentStock),
        rate:      Number((prod as any).purchaseRate),
        createdAt: daysAgo(90),
      },
    });
    // Random sales movements over 30 days
    for (let d = 29; d >= 0; d -= rand(2, 5)) {
      await prisma.stockMovement.create({
        data: {
          tenantId:  TENANT_ID,
          productId: prod.id,
          godownId:  godown.id,
          type:      'SALE',
          quantity:  -rand(20, 200),
          rate:      Number((prod as any).saleRate),
          createdAt: daysAgo(d),
        },
      });
    }
  }
  console.log('✅ Stock movements created');

  // ── Leads ─────────────────────────────────────────────────────────────────
  console.log('🎯 Creating leads...');
  await prisma.lead.deleteMany({ where: { tenantId: TENANT_ID } });

  const leadDefs = [
    { party: customers[0], title: 'Sharma Traders — Georgette 500m bulk', prod: 'Georgette 4-Way', qty: 500,  val: 44000,  status: 'QUOTED',      src: 'WHATSAPP', days: 3  },
    { party: customers[1], title: 'Modi Fabrics — Chiffon inquiry',        prod: 'Pure Chiffon',   qty: 1000, val: 68000,  status: 'NEW',         src: 'WHATSAPP', days: 1  },
    { party: customers[2], title: 'Jain Saree — Banarasi Silk 50pcs',      prod: 'Banarasi Silk',  qty: 50,   val: 55000,  status: 'NEGOTIATING', src: 'GMAIL',    days: 7  },
    { party: customers[3], title: 'Gupta Wholesale — Cotton bulk',          prod: 'Cotton Dress',   qty: 2000, val: 116000, status: 'WON',         src: 'REFERRAL', days: 15 },
    { party: customers[4], title: 'Rajesh Textiles — Velvet order',         prod: 'Velvet Upholstery', qty: 200, val: 48000, status: 'CONTACTED', src: 'COLD_CALL', days: 5 },
    { party: customers[0], title: 'Sharma — Organza reorder 300m',          prod: 'Organza Embroidered', qty: 300, val: 39000, status: 'NEW',    src: 'WHATSAPP', days: 0  },
    { party: customers[1], title: 'Modi — Cotton Dress 500m',               prod: 'Cotton Dress',   qty: 500,  val: 29000,  status: 'LOST',        src: 'GMAIL',    days: 20 },
  ];

  for (const l of leadDefs) {
    await prisma.lead.create({
      data: {
        tenantId:       TENANT_ID,
        partyId:        l.party.id,
        title:          l.title,
        source:         l.src as any,
        status:         l.status as any,
        productInterest: l.prod,
        estimatedQty:   l.qty,
        estimatedValue: l.val,
        followUpDate:   l.days === 0 ? addDays(new Date(), 1) : l.days < 10 ? addDays(new Date(), l.days) : undefined,
        createdAt:      daysAgo(rand(0, 30)),
      },
    });
  }
  console.log('✅ Leads created');

  // ── Messages / Inbox ───────────────────────────────────────────────────────
  console.log('💬 Creating messages...');
  await prisma.message.deleteMany({ where: { tenantId: TENANT_ID } });

  const msgs = [
    { party: customers[0], ch: 'WHATSAPP', content: 'Bhai georgette 4-way ka rate kya hai? 500 meter chahiye urgent',                intent: 'quote_request',  read: false, days: 0 },
    { party: customers[1], ch: 'WHATSAPP', content: 'Maine 28000 NEFT kar diye abhi',                                                intent: 'payment_info',   read: false, days: 0 },
    { party: customers[2], ch: 'GMAIL',    content: 'Please send catalogue for Banarasi silk sarees with latest prices',             intent: 'quote_request',  read: false, days: 1 },
    { party: customers[4], ch: 'WHATSAPP', content: 'Mera order kab aayega? 3 din ho gaye',                                          intent: 'delivery_query', read: false, days: 1 },
    { party: customers[3], ch: 'WHATSAPP', content: 'Order confirm hai — 2000m cotton. Invoice bhejo',                               intent: 'order_confirm',  read: true,  days: 2 },
    { party: customers[0], ch: 'WHATSAPP', content: 'Sharma here — quality thodi kharab thi last shipment mein, please check karo',  intent: 'complaint',      read: true,  days: 3 },
    { party: customers[1], ch: 'GMAIL',    content: 'Hi, interested in velvet fabric samples. Can you send swatches?',               intent: 'quote_request',  read: true,  days: 4 },
    { party: customers[2], ch: 'WHATSAPP', content: 'Bhai 91000 overdue hai please confirm',                                         intent: 'payment_info',   read: true,  days: 5 },
    { party: customers[4], ch: 'WHATSAPP', content: 'New season ke liye organza ka stock hai? 500m chahiye',                         intent: 'quote_request',  read: true,  days: 6 },
    { party: customers[3], ch: 'GMAIL',    content: 'Invoice INV-2025-0032 received. Payment will be done by Friday.',               intent: 'payment_info',   read: true,  days: 7 },
  ];

  for (const m of msgs) {
    await prisma.message.create({
      data: {
        tenantId:    TENANT_ID,
        partyId:     m.party.id,
        channel:     m.ch as any,
        direction:   'INBOUND',
        fromAddress: (m.party as any).phone,
        content:     m.content,
        aiIntent:    m.intent,
        aiLanguage:  m.content.match(/[^\x00-\x7F]/) || m.content.includes('bhai') || m.content.includes('chahiye') ? 'hi' : 'en',
        aiSentiment: m.intent === 'complaint' ? 'negative' : m.intent === 'order_confirm' ? 'positive' : 'neutral',
        isRead:      m.read,
        createdAt:   daysAgo(m.days),
      },
    });
  }
  console.log('✅ Messages created');

  // ── Summary ────────────────────────────────────────────────────────────────
  const [txCount, leadCount, msgCount] = await Promise.all([
    prisma.transaction.count({ where: { tenantId: TENANT_ID } }),
    prisma.lead.count({ where: { tenantId: TENANT_ID } }),
    prisma.message.count({ where: { tenantId: TENANT_ID } }),
  ]);

  const totalSales = await prisma.transaction.aggregate({
    where: { tenantId: TENANT_ID, type: 'SALE' },
    _sum: { totalAmount: true },
  });

  console.log('\n🎉 Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Transactions : ${txCount}`);
  console.log(`  Total Sales  : ₹${Number(totalSales._sum.totalAmount || 0).toLocaleString('en-IN')}`);
  console.log(`  Leads        : ${leadCount}`);
  console.log(`  Messages     : ${msgCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Login → Phone: 7075077384  Pass: admin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── Update system prompt in ai.ts to include actual DB context ─────────────
  console.log('💡 Tip: Ask the bot things like:');
  console.log('  • "Aaj ki total sale kitni hai?"');
  console.log('  • "Is mahine ka profit kya hai?"');
  console.log('  • "Georgette ka stock kitna bacha hai?"');
  console.log('  • "Kaun se customers ka payment pending hai?"');
  console.log('  • "Top 3 selling products this month?"');
  console.log('  • "Cash flow last week kaisi rahi?"');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
