import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Shah Fabrics Pvt Ltd',
      gstin: '24AABCS1429B1ZB',
      address: 'Ring Road, Surat',
      city: 'Surat',
      state: 'Gujarat',
      phone: '9876543210',
      email: 'shah@shahfabrics.com',
      plan: 'GROWTH',
      planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });
  console.log('✅ Tenant:', tenant.name);

  // Create owner user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const owner = await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Ramesh Shah',
      phone: '9876543210',
      email: 'ramesh@shahfabrics.com',
      passwordHash,
      role: 'OWNER',
      isActive: true,
    },
  });
  console.log('✅ Owner user:', owner.name, '| phone:', owner.phone);

  // Create godown
  const godown = await prisma.godown.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: tenant.id,
      name: 'Main Godown — Ring Road',
      address: 'Ring Road, Surat',
      isActive: true,
    },
  });
  console.log('✅ Godown:', godown.name);

  // Create sample products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000020' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000020',
        tenantId: tenant.id,
        name: 'Georgette 4-Way',
        code: 'GEO-4W',
        category: 'Fabric',
        subcategory: 'Georgette',
        unit: 'METER',
        hsnCode: '5407',
        gstRate: 5,
        purchaseRate: 72,
        saleRate: 88,
        currentStock: 3200,
        reorderLevel: 500,
      },
    }),
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000021' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000021',
        tenantId: tenant.id,
        name: 'Pure Chiffon',
        code: 'CHF-PUR',
        category: 'Fabric',
        subcategory: 'Chiffon',
        unit: 'METER',
        hsnCode: '5407',
        gstRate: 5,
        purchaseRate: 55,
        saleRate: 68,
        currentStock: 420,
        reorderLevel: 500,
      },
    }),
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000022' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000022',
        tenantId: tenant.id,
        name: 'Banarasi Silk',
        code: 'SLK-BNR',
        category: 'Saree',
        subcategory: 'Silk',
        unit: 'PIECE',
        hsnCode: '5007',
        gstRate: 5,
        purchaseRate: 850,
        saleRate: 1100,
        currentStock: 180,
        reorderLevel: 50,
      },
    }),
    prisma.product.upsert({
      where: { id: '00000000-0000-0000-0000-000000000023' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000023',
        tenantId: tenant.id,
        name: 'Cotton Dress Material',
        code: 'CTN-DRS',
        category: 'Dress Material',
        subcategory: 'Cotton',
        unit: 'METER',
        hsnCode: '5208',
        gstRate: 5,
        purchaseRate: 42,
        saleRate: 58,
        currentStock: 1800,
        reorderLevel: 300,
      },
    }),
  ]);
  console.log('✅ Products:', products.map((p) => p.name).join(', '));

  // Create sample parties
  const party1 = await prisma.party.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      tenantId: tenant.id,
      name: 'Sharma Traders',
      type: 'CUSTOMER',
      phone: '9988776655',
      whatsapp: '9988776655',
      email: 'sharma@sharmatraders.com',
      city: 'Ahmedabad',
      state: 'Gujarat',
      creditLimit: 200000,
      currentBalance: 45000,
    },
  });

  const party2 = await prisma.party.upsert({
    where: { id: '00000000-0000-0000-0000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000031',
      tenantId: tenant.id,
      name: 'Modi Fabrics',
      type: 'CUSTOMER',
      phone: '9876512345',
      whatsapp: '9876512345',
      city: 'Surat',
      state: 'Gujarat',
      creditLimit: 100000,
      currentBalance: 12000,
    },
  });

  const supplier = await prisma.party.upsert({
    where: { id: '00000000-0000-0000-0000-000000000032' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000032',
      tenantId: tenant.id,
      name: 'Patel Yarn Mills',
      type: 'SUPPLIER',
      phone: '9090909090',
      city: 'Surat',
      state: 'Gujarat',
      creditLimit: 500000,
      currentBalance: -85000,
    },
  });
  console.log('✅ Parties:', party1.name, ',', party2.name, ',', supplier.name);

  // Create a sample sale transaction
  const today = new Date();
  const sale = await prisma.transaction.create({
    data: {
      tenantId: tenant.id,
      type: 'SALE',
      partyId: party1.id,
      referenceNo: 'INV-2024-0001',
      date: today,
      dueDate: new Date(today.getTime() + 30 * 86400000),
      subtotal: 44000,
      taxableAmount: 44000,
      cgstAmount: 1100,
      sgstAmount: 1100,
      totalAmount: 46200,
      paidAmount: 0,
      status: 'PENDING',
      paymentMode: 'credit',
      items: {
        create: [
          {
            productId: products[0].id,
            productName: 'Georgette 4-Way',
            quantity: 500,
            unit: 'METER',
            rate: 88,
            amount: 44000,
            gstRate: 5,
            gstAmount: 2200,
            totalAmount: 46200,
          },
        ],
      },
    },
  });
  console.log('✅ Sample sale:', sale.referenceNo, '₹', sale.totalAmount.toString());

  // Create a sample WhatsApp message with AI intent
  await prisma.message.create({
    data: {
      tenantId: tenant.id,
      partyId: party2.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      fromAddress: '9876512345',
      content: 'Bhai georgette 4-way ka rate kya hai? 1000 meter chahiye',
      aiIntent: 'quote_request',
      aiEntities: { product: 'georgette 4-way', quantity: '1000', unit: 'meter' },
      aiLanguage: 'hi',
      aiSentiment: 'neutral',
      isRead: false,
    },
  });

  await prisma.message.create({
    data: {
      tenantId: tenant.id,
      partyId: party1.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      fromAddress: '9988776655',
      content: 'Maine 45000 NEFT kar diye aaj',
      aiIntent: 'payment_info',
      aiEntities: { amount: '45000', mode: 'NEFT' },
      aiLanguage: 'hinglish',
      aiSentiment: 'positive',
      isRead: false,
    },
  });
  console.log('✅ Sample messages created');

  // Create a sample lead
  await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      partyId: party2.id,
      title: 'Modi Fabrics — Georgette bulk inquiry',
      source: 'WHATSAPP',
      status: 'NEW',
      productInterest: 'Georgette 4-Way',
      estimatedQty: 1000,
      estimatedValue: 88000,
      followUpDate: new Date(today.getTime() + 86400000),
    },
  });
  console.log('✅ Sample lead created');

  console.log('\n🎉 Seed complete!\n');
  console.log('┌─────────────────────────────────────┐');
  console.log('│         LOGIN CREDENTIALS            │');
  console.log('├─────────────────────────────────────┤');
  console.log('│  Phone    :  9876543210              │');
  console.log('│  Password :  admin123                │');
  console.log('└─────────────────────────────────────┘');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
