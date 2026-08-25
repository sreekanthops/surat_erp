# System Architecture — Surat Textile Intelligence Dashboard

## 1. High-Level Architecture

The platform follows a **microservices-influenced monorepo** approach — a single deployable unit for
small/mid-scale SaaS, but with clearly separated service boundaries so it can be split later.

```
surat-textile-dashboard/
├── src/
│   ├── frontend/          # React + TypeScript SPA
│   ├── backend/           # Node.js REST API + WebSocket server
│   └── ai/                # Python FastAPI — AI/LLM services
├── infra/                 # Docker, Kubernetes, Terraform
├── docs/                  # All documentation
└── scripts/               # Seeding, migration, deployment helpers
```

---

## 2. Data Flow Architecture

### 2.1 Incoming Data Paths

```
WhatsApp Business API
        │
        ▼
   Webhook Handler  ──▶  Message Queue (BullMQ/Redis)
        │                         │
        │                         ▼
        │              AI Extraction Worker
        │              - Intent detection (order/quote/complaint/general)
        │              - Entity extraction (party name, product, quantity, price)
        │              - Sentiment analysis
        │              - Language detection (Hindi/English/Gujarati)
        │                         │
        │                         ▼
        └──────────────▶  PostgreSQL + Vector DB (Pinecone)


Gmail OAuth
        │
        ▼
   Gmail Watch API  ──▶  Message Queue
        │                         │
        │                         ▼
        │              Email Parser Worker
        │              - Thread grouping by party
        │              - Quote/PO extraction
        │              - Attachment processing (PDF invoices)
        │                         │
        └──────────────▶  PostgreSQL


Tally Prime / ERP
        │
        ▼
   Tally HTTP Bridge ──▶  Sync Worker (every 15 min)
   (XML over TCP)               │
        OR                      ▼
   CSV/Excel Import   ──▶  ETL Pipeline
                               │
                               ▼
                          PostgreSQL
```

### 2.2 Query Data Path (Chatbot)

```
User asks: "What are today's sales?"
        │
        ▼
   LLM Engine (GPT-4o / LLaMA 3)
        │
        ├─▶  SQL Query Generator  ──▶  PostgreSQL  ──▶  Results
        │
        ├─▶  Vector Search        ──▶  Pinecone    ──▶  Relevant messages/context
        │
        └─▶  Response Synthesizer ──▶  Natural Language Answer (Hindi/English)
```

---

## 3. Database Design

### 3.1 Core Entities

```sql
-- Tenants (each textile business = 1 tenant)
tenants (id, name, gstin, city, plan, created_at)

-- Users (owners, managers, accountants)
users (id, tenant_id, name, phone, email, role, created_at)

-- Parties (customers / suppliers)
parties (id, tenant_id, name, type[customer|supplier|both], 
         phone, email, city, credit_limit, current_balance)

-- Products (fabrics, yarns, finished cloth)
products (id, tenant_id, name, category, unit[meter|kg|piece|bundle],
          hsn_code, gst_rate, current_stock, reorder_level)

-- Stock Movements (all inventory transactions)
stock_movements (id, tenant_id, product_id, party_id, 
                 type[purchase|sale|return|adjustment|damage],
                 quantity, rate, amount, batch_no, godown_id,
                 reference_no, notes, created_at)

-- Transactions (financial)
transactions (id, tenant_id, party_id, type[sale|purchase|payment|receipt|expense],
              amount, gst_amount, total_amount, status[pending|partial|paid],
              due_date, created_at)

-- Line Items
transaction_items (id, transaction_id, product_id, quantity, rate, 
                   discount_pct, amount, gst_amount)

-- Messages (WhatsApp + Gmail unified inbox)
messages (id, tenant_id, party_id, channel[whatsapp|gmail|sms],
          direction[inbound|outbound], content, ai_intent, 
          ai_entities jsonb, thread_id, created_at)

-- Leads
leads (id, tenant_id, party_id, source[whatsapp|gmail|referral|manual],
       status[new|contacted|quoted|negotiating|won|lost],
       product_interest, estimated_value, assigned_to, notes, created_at)

-- Cash Flow
cash_flow (id, tenant_id, date, opening_balance, total_in, total_out,
           closing_balance, bank_balance, difference, notes)

-- Subscriptions
subscriptions (id, tenant_id, plan, status, starts_at, ends_at, 
               razorpay_subscription_id, amount)
```

---

## 4. API Layer Design

### 4.1 Backend API Structure (Node.js + Express)

```
/api/v1/
├── auth/
│   ├── POST   /login
│   ├── POST   /refresh
│   └── POST   /logout
├── dashboard/
│   ├── GET    /summary          # Today's KPIs
│   └── GET    /cash-flow        # Cash flow chart data
├── inventory/
│   ├── GET    /products         # Stock list
│   ├── POST   /products         # Add product
│   ├── GET    /movements        # Stock in/out history
│   └── POST   /movements        # Record stock movement
├── sales/
│   ├── GET    /invoices         # Sales list
│   ├── POST   /invoices         # Create invoice
│   ├── GET    /invoices/:id     # Invoice detail
│   └── GET    /analytics        # Charts data
├── parties/
│   ├── GET    /                 # Customer/supplier list
│   ├── POST   /                 # Add party
│   └── GET    /:id/ledger       # Party ledger
├── messages/
│   ├── GET    /inbox            # Unified inbox
│   ├── GET    /inbox/:id        # Message thread
│   └── POST   /reply            # Send reply (WhatsApp/Gmail)
├── leads/
│   ├── GET    /                 # Lead pipeline
│   ├── POST   /                 # Create lead
│   └── PATCH  /:id/status       # Update lead status
├── ai/
│   ├── POST   /chat             # LLM chatbot query
│   └── GET    /suggestions      # Daily AI suggestions
├── integrations/
│   ├── POST   /tally/sync       # Trigger Tally sync
│   ├── GET    /whatsapp/status  # Connection status
│   └── GET    /gmail/status     # Gmail auth status
└── reports/
    ├── GET    /profit-loss       # P&L statement
    ├── GET    /stock-summary     # Stock report
    └── GET    /party-outstanding # Party-wise outstanding
```

### 4.2 AI Service API (Python FastAPI)

```
/ai/
├── POST  /extract-message-entities   # NLP extraction from message
├── POST  /classify-intent            # Intent classification
├── POST  /generate-quote             # Auto-generate quote from chat
├── POST  /chat                       # LLM chatbot response
├── POST  /summarize-day              # End-of-day business summary
└── POST  /anomaly-detection          # Detect unusual patterns
```

---

## 5. Real-Time Architecture

WebSocket events pushed to frontend:

```
Events:
  - new_message          # Incoming WhatsApp/Gmail message
  - stock_updated        # Inventory changed
  - payment_received     # Payment marked
  - lead_updated         # Lead status change
  - sync_completed       # Tally sync done
  - alert_triggered      # Low stock / overdue payment
```

---

## 6. Multi-Tenancy

- All database tables have `tenant_id` column
- Row-Level Security (RLS) enforced at PostgreSQL level
- JWT tokens include `tenant_id` claim
- Redis keys namespaced by `tenant:{id}:`
- File storage (invoices/attachments) in `s3://bucket/tenants/{id}/`

---

## 7. Security

- JWT + Refresh Token authentication
- HTTPS only (Let's Encrypt)
- Rate limiting on all API endpoints
- Webhook signature verification (WhatsApp HMAC-SHA256)
- OAuth2 PKCE flow for Gmail
- Encrypted secrets at rest (AWS KMS / environment secrets)
- Audit log for all write operations
- GDPR-compliant data deletion

---

## 8. Scalability Plan

| Phase | Scale | Infrastructure |
|---|---|---|
| **MVP (0–100 tenants)** | Single server | Docker Compose on 8GB VPS |
| **Growth (100–1000 tenants)** | Horizontal scaling | AWS ECS / Kubernetes |
| **Enterprise (1000+)** | Multi-region | AWS RDS Aurora + ElastiCache |
