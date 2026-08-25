# Subscription Model & Business Plan

---

## 1. Pricing Tiers

### ₹1,499/month — Starter Plan
**Target:** Small traders, single-person operations, first-time software users

| Feature | Included |
|---|---|
| Users | 1 |
| Manual entry (sales, purchase, inventory) | ✓ |
| Basic reports (day book, stock, P&L) | ✓ |
| Invoice PDF generation | ✓ |
| AI Chatbot | 100 queries/day |
| WhatsApp Integration | ✗ |
| Gmail Integration | ✗ |
| Tally/ERP Sync | ✗ |
| Daily AI Summary | Weekly only |
| Support | Email support |

---

### ₹3,999/month — Growth Plan ⭐ MOST POPULAR
**Target:** Active traders, small wholesalers, 2–5 person teams

| Feature | Included |
|---|---|
| Users | 5 |
| All Starter features | ✓ |
| WhatsApp Business Integration | ✓ |
| Gmail Integration | ✓ |
| Tally Prime Sync | ✓ |
| AI Chatbot | 500 queries/day |
| Voice note transcription | 50/month |
| Daily AI Summary (morning + evening) | ✓ |
| Lead Pipeline (CRM) | ✓ |
| Customer profiles | ✓ |
| Custom invoice template | 1 template |
| Support | Chat + Email |

---

### ₹7,999/month — Pro Plan
**Target:** Established wholesalers, multi-godown operations, serious businesses

| Feature | Included |
|---|---|
| Users | 15 |
| All Growth features | ✓ |
| Marg ERP / Busy ERP sync | ✓ |
| Unlimited AI Chatbot | ✓ |
| Voice transcription | Unlimited |
| Multi-warehouse/godown management | ✓ |
| GST Reports (GSTR-1/2 export) | ✓ |
| Advanced analytics & custom reports | ✓ |
| API access (for custom integrations) | ✓ |
| White-label invoice (your logo + template) | ✓ |
| Priority support | Phone + Chat |

---

### Custom — Enterprise Plan
**Target:** Large mills, trading houses, chain of showrooms

| Feature | Included |
|---|---|
| Users | Unlimited |
| All Pro features | ✓ |
| On-premise deployment option | ✓ |
| Dedicated database instance | ✓ |
| Custom LLM (Ollama/Azure) | ✓ |
| Custom integrations | ✓ |
| SLA guarantee (99.9% uptime) | ✓ |
| Dedicated account manager | ✓ |
| Training & onboarding | ✓ |
| Custom pricing | Contact Sales |

---

## 2. Annual Discount

All plans offer **2 months free** on annual payment:
- Starter: ₹14,990/year (save ₹2,998)
- Growth: ₹39,990/year (save ₹7,998)
- Pro: ₹79,990/year (save ₹15,998)

---

## 3. Revenue Projections

### Conservative Scenario (Year 1)

| Quarter | New Tenants | Avg MRR/Tenant | Monthly Revenue |
|---|---|---|---|
| Q1 (launch) | 25 | ₹2,500 | ₹62,500 |
| Q2 | 60 total | ₹2,800 | ₹1,68,000 |
| Q3 | 120 total | ₹3,000 | ₹3,60,000 |
| Q4 | 200 total | ₹3,200 | ₹6,40,000 |

**Year 1 ARR (conservative):** ₹76,80,000 (~₹77 Lakhs)

### Optimistic Scenario (Year 2)
- 500 paying tenants
- Average ₹3,500/month
- **ARR: ₹2.1 Crore**

---

## 4. Cost Structure

### Infrastructure Costs (per month, 100 tenants)

| Item | Cost/Month |
|---|---|
| AWS EC2 (app server) | ₹8,000 |
| AWS RDS PostgreSQL | ₹6,000 |
| Redis Cloud | ₹2,000 |
| Pinecone (vector DB) | ₹2,500 |
| OpenAI API (AI queries) | ₹15,000 |
| WhatsApp API (message fees) | ₹5,000 |
| Razorpay (2% transaction fee) | ₹6,000 |
| SSL, CDN, monitoring | ₹3,000 |
| **Total Infrastructure** | **₹47,500/month** |

### Team Costs (lean startup phase)
| Role | Cost/Month |
|---|---|
| Full-stack developer (1) | ₹80,000 |
| AI/ML engineer (1) | ₹90,000 |
| Business dev / sales (1) | ₹50,000 |
| Customer support (1) | ₹25,000 |
| **Total Team** | **₹2,45,000/month** |

**Break-even at:** ~100 tenants on Growth plan

---

## 5. Go-to-Market Strategy

### Phase 1 — Beta Launch (Month 1–3)
- **Target:** 25 free beta users in Surat's Ring Road / Maskati Market area
- **Method:** Direct door-to-door visits, demo on phone/tablet
- **Offer:** 3 months free for beta users (they give feedback)
- **Goal:** Product-market fit validation

### Phase 2 — Paid Launch (Month 4–6)
- **Target:** 100 paying customers
- **Channels:**
  - WhatsApp groups (Surat textile traders' groups)
  - YouTube videos in Hindi (how to manage textile business)
  - Google Ads (keywords: "textile software Surat", "kapda dukan software")
  - Referral program: ₹500 cashback per referral

### Phase 3 — Scale (Month 7–12)
- **Target:** 200+ customers
- **Expand to:** Bhiwandi (Mumbai), Erode (Tamil Nadu), Panipat (Haryana)
- **Partnerships:** CA firms, ERP resellers, textile associations

### Phase 4 — Enterprise (Year 2+)
- Target large mills and export houses
- White-label licensing to ERP companies
- API marketplace for third-party integrations

---

## 6. Customer Acquisition

### Free Trial
- 14-day free trial, no credit card required
- All Growth plan features included
- Demo data pre-loaded (fictional textile business data)
- Guided onboarding wizard (WhatsApp setup in 5 minutes)

### Referral Program
- ₹500 account credit for each referral who pays 1st month
- Referred user gets 1st month at 50% off

### Partner Program (CA / Accountants)
- CAs who recommend get 15% recurring commission
- Special partner dashboard to manage multiple client businesses

---

## 7. Churn Prevention

| Risk | Mitigation |
|---|---|
| Owner doesn't use it daily | Morning WhatsApp summary pushes them to open app |
| Tally sync fails | Fallback to CSV import, instant notification |
| Too complex | Voice-first chatbot — no navigation needed |
| Data security concerns | Show audit log, explain encryption, local data option |
| Seasonal business slow | Pause subscription option (1 month/year free pause) |

---

## 8. Technical Billing Implementation

```javascript
// Subscription creation with Razorpay
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create subscription
const subscription = await razorpay.subscriptions.create({
  plan_id: PLAN_IDS[planType],        // starter/growth/pro
  customer_notify: 1,
  quantity: 1,
  total_count: 12,                    // 12 months
  addons: [],
  notes: { tenant_id: tenant.id }
});

// Webhook to handle payment success/failure
app.post('/webhooks/razorpay', async (req, res) => {
  const { event, payload } = req.body;
  
  if (event === 'subscription.activated') {
    await activateTenantSubscription(payload.subscription.entity.notes.tenant_id);
  } else if (event === 'subscription.charged') {
    await recordSubscriptionPayment(payload);
  } else if (event === 'subscription.halted') {
    await suspendTenantAccount(payload.subscription.entity.notes.tenant_id);
  }
});
```
