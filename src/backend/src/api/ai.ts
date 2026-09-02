import { Router } from 'express';
import { prisma } from '../services/db.js';
import axios from 'axios';
import { z } from 'zod';

export const aiRouter = Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL   || 'minimax/minimax-m3:free';

const chatSchema = z.object({
  sessionId: z.string().uuid().nullish(),
  message:   z.string().min(1),
  history:   z.array(z.object({ role: z.string(), content: z.string() })).optional(),
});

// ── Fetch live business data from DB ─────────────────────────────────────────
async function fetchLiveContext(tenantId: string): Promise<string> {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const todayEnd  = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  const [
    todaySales,
    monthSales,
    monthPurchases,
    pendingPayments,
    products,
    leads,
    recentMessages,
    whatsappSignals,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { tenantId, type: 'SALE', date: { gte: today, lte: todayEnd } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { tenantId, type: 'SALE', date: { gte: monthStart } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { tenantId, type: 'PURCHASE', date: { gte: monthStart } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { tenantId, type: 'SALE', status: { in: ['PENDING', 'PARTIAL'] } },
      include: { party: true },
      orderBy: { totalAmount: 'desc' },
      take: 10,
    }),
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { currentStock: 'asc' },
    }),
    prisma.lead.findMany({
      where: { tenantId, status: { notIn: ['WON', 'LOST'] } },
      include: { party: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.message.findMany({
      where: { tenantId, isRead: false },
      include: { party: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    // WhatsApp messages with buying signals — full data for lead detection
    prisma.message.findMany({
      where: {
        tenantId,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        aiIntent: { in: ['quote_request', 'new_customer_inquiry', 'bulk_inquiry', 'catalogue_request', 'order_confirm', 'sample_request'] },
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      include: { party: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  const fmt = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const todayDateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const monthlySalesAmt    = Number(monthSales._sum.totalAmount || 0);
  const monthlyPurchaseAmt = Number(monthPurchases._sum.totalAmount || 0);
  const monthlyProfit      = monthlySalesAmt - monthlyPurchaseAmt;
  const profitMargin       = monthlySalesAmt > 0 ? ((monthlyProfit / monthlySalesAmt) * 100).toFixed(1) : '0';

  const productLines = products.map((p) =>
    `  • ${p.name} (${p.code}): stock=${Number(p.currentStock)} ${p.unit}, sell=₹${Number(p.saleRate)}, buy=₹${Number(p.purchaseRate)}${Number(p.currentStock) <= Number(p.reorderLevel) ? ' ⚠️ LOW STOCK' : ''}`
  ).join('\n');

  const pendingLines = pendingPayments.map((t) =>
    `  • ${t.party?.name || 'Unknown'}: total=${fmt(t.totalAmount)}, paid=${fmt(t.paidAmount)}, due=${fmt(Number(t.totalAmount) - Number(t.paidAmount))}, date=${new Date(t.date).toLocaleDateString('en-IN')}, ref=${t.referenceNo}`
  ).join('\n');

  const leadLines = leads.map((l) =>
    `  • ${l.party?.name || 'Unknown'} — ${l.title} [${l.status}], value=${fmt(l.estimatedValue)}, product=${l.productInterest}`
  ).join('\n');

  const msgLines = recentMessages.map((m) =>
    `  • ${m.party?.name || m.fromAddress} (${m.channel}): "${m.content?.slice(0, 80)}" [intent: ${m.aiIntent}]`
  ).join('\n');

  // ── Build detailed WhatsApp potential customer list ─────────────────────────
  // Group by sender, carry score + signals from stored aiEntities JSON
  const waSenderMap = new Map<string, {
    name: string; phone: string; intents: string[]; messages: string[];
    score: number; signals: string[]; product?: string; quantity?: string; city?: string;
  }>();

  for (const m of whatsappSignals) {
    const key = m.fromAddress || 'unknown';
    if (!waSenderMap.has(key)) {
      waSenderMap.set(key, {
        name: m.party?.name || key,
        phone: key,
        intents: [], messages: [], score: 0, signals: [],
      });
    }
    const s = waSenderMap.get(key)!;
    if (m.aiIntent && !s.intents.includes(m.aiIntent)) s.intents.push(m.aiIntent);
    if (m.content) s.messages.push(m.content.slice(0, 80));

    const ent = m.aiEntities as any;
    if (ent) {
      if (ent.customerScore > s.score) s.score = ent.customerScore;
      if (ent.customerSignals) {
        for (const sig of ent.customerSignals) {
          if (!s.signals.includes(sig)) s.signals.push(sig);
        }
      }
      if (ent.product && !s.product) s.product = ent.product;
      if (ent.quantity && !s.quantity) s.quantity = ent.quantity;
      if (ent.city && !s.city) s.city = ent.city;
    }
  }

  // Sort by score descending
  const waSenders = Array.from(waSenderMap.values()).sort((a, b) => b.score - a.score);

  // Format for AI context — include JSON-like structure the chatbot can parse and present
  const waLeadLines = waSenders.map((s, i) => {
    const urgency = s.intents.includes('order_confirm') ? '🔥 HOT' : s.score >= 70 ? '⭐ HIGH' : '· MOD';
    return `  ${i + 1}. [${urgency}] ${s.name} (${s.phone})
     Intent: ${s.intents.join(' + ')} | Score: ${s.score}/100
     Signals: ${s.signals.length ? s.signals.join(', ') : 'buying interest'}
     Product: ${s.product || 'general inquiry'} | Qty: ${s.quantity || 'not specified'} | City: ${s.city || 'unknown'}
     Message: "${s.messages[0] || ''}"`;
  }).join('\n');

  return `=== LIVE BUSINESS DATA for GSpaces AI CRM (as of ${todayDateStr}) ===

TODAY'S SALES:
  Total: ${fmt(todaySales._sum.totalAmount)} across ${todaySales._count} invoices
  Collected: ${fmt(todaySales._sum.paidAmount)}

THIS MONTH'S PERFORMANCE:
  Sales: ${fmt(monthSales._sum.totalAmount)} across ${monthSales._count} invoices
  Purchases (cost): ${fmt(monthPurchases._sum.totalAmount)} across ${monthPurchases._count} orders
  Gross Profit: ${fmt(monthlyProfit)} (${profitMargin}% margin)

CURRENT STOCK:
${productLines}

PENDING PAYMENTS (customers who owe money):
${pendingLines || '  None'}

ACTIVE LEADS (${leads.length} total):
${leadLines || '  None'}

UNREAD MESSAGES (${recentMessages.length}):
${msgLines || '  None'}

WHATSAPP POTENTIAL CUSTOMERS — ${waSenders.length} people messaged with buying signals (last 30 days):
${waLeadLines || '  None detected'}

=== END LIVE DATA ===`;
}

// ── Build full system prompt with live data ───────────────────────────────────
async function buildSystemPrompt(tenantId: string): Promise<string> {
  const liveData = await fetchLiveContext(tenantId);
  const today    = new Date().toISOString().split('T')[0];

  return `You are an expert AI business assistant for GSpaces AI CRM, a textile business in Surat, India.
You have access to REAL-TIME business data fetched directly from the database. Use this data to answer questions precisely.

${liveData}

Instructions:
- Answer with EXACT numbers from the live data above — never say "I don't have access" or "check the system"
- Respond in the SAME language as the user (Hindi, English, or Hinglish)
- Format all currency in Indian Rupees (₹) with Indian number formatting
- Be concise and direct — the owner is busy
- For pending payments, list party names and amounts
- For stock questions, give exact quantities and flag LOW STOCK items

WHATSAPP LEAD DETECTION RULES:
- When asked about WhatsApp leads or potential customers, look at the "WHATSAPP POTENTIAL CUSTOMERS" section
- For each person, explain: their name/phone, what they asked, their buying signals, recommended action
- Highlight 🔥 HOT leads (score 70+) first, then ⭐ HIGH (50-70), then moderate
- Always end WhatsApp lead answers with: "LEAD_DATA_JSON:" followed by a JSON array of top leads like:
  [{"name":"Ravi Gupta","phone":"9800000001","intent":"quote_request","product":"georgette","score":85,"signals":["asking price","bulk qty"],"recommendation":"Create lead immediately"}]
- This JSON format helps the UI display lead cards
- If no WhatsApp leads exist, suggest using the Simulate WhatsApp feature in the Inbox page

- Today's date: ${today}`;
}

// ── POST /api/v1/ai/chat ──────────────────────────────────────────────────────
aiRouter.post('/chat', async (req, res, next) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const body     = chatSchema.parse(req.body);
    const sessionId = body.sessionId ?? crypto.randomUUID();

    const systemContent = await buildSystemPrompt(tenantId);
    const history       = (body.history || []).slice(-8);

    const messages = [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user',   content: body.message },
    ];

    const orRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model: OPENROUTER_MODEL, messages, temperature: 0.2, max_tokens: 1200 },
      {
        headers: {
          Authorization:  `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':  'https://surat-textile-dashboard.app',
          'X-Title':       'Surat Textile Dashboard',
        },
        timeout: 30000,
      }
    );

    const rawResponse = orRes.data.choices[0].message.content || '';
    const tokensUsed  = orRes.data.usage?.total_tokens ?? null;

    // Extract lead JSON if present (for UI card rendering)
    let leadCards: any[] | null = null;
    const jsonMatch = rawResponse.match(/LEAD_DATA_JSON:\s*(\[[\s\S]*?\])/);
    if (jsonMatch) {
      try { leadCards = JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
    }

    // Strip the JSON tag from the displayed response
    const response = rawResponse.replace(/LEAD_DATA_JSON:[\s\S]*$/, '').trim();

    return res.json({ sessionId, response, tokensUsed, sqlQuery: null, leadCards });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/ai/suggestions ────────────────────────────────────────────────
aiRouter.get('/suggestions', async (req, res, next) => {
  try {
    const tenantId   = (req as any).user.tenantId;
    const liveData   = await fetchLiveContext(tenantId);

    const prompt = `Based on this real business data:\n${liveData}\n\nGenerate 3-5 specific, actionable morning suggestions in Hinglish for the owner. Include any hot WhatsApp leads that need follow-up. Use actual party names and amounts from the data. Return as JSON array of strings only.`;

    const orRes = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model: OPENROUTER_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 400 },
      {
        headers: {
          Authorization:  `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':  'https://surat-textile-dashboard.app',
          'X-Title':       'Surat Textile Dashboard',
        },
        timeout: 30000,
      }
    );
    return res.json({ suggestions: orRes.data.choices[0].message.content });
  } catch (err) {
    next(err);
  }
});
