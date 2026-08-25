# Database Schema & Data Models

---

## 1. Entity Relationship Overview

```
tenants ──< users
tenants ──< parties
tenants ──< products
tenants ──< transactions ──< transaction_items ──> products
tenants ──< stock_movements ──> products
tenants ──< messages ──> parties
tenants ──< leads ──> parties
parties ──< transactions
parties ──< messages
parties ──< leads
```

---

## 2. Complete Schema (PostgreSQL)

```sql
-- ===========================
-- MULTI-TENANCY
-- ===========================
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  gstin         VARCHAR(15),
  address       TEXT,
  city          VARCHAR(100) DEFAULT 'Surat',
  state         VARCHAR(100) DEFAULT 'Gujarat',
  phone         VARCHAR(15),
  email         VARCHAR(255),
  logo_url      TEXT,
  plan          VARCHAR(20) DEFAULT 'starter' CHECK (plan IN ('starter','growth','pro','enterprise')),
  plan_expires_at TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT true,
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- USERS & AUTHENTICATION
-- ===========================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(15) UNIQUE,
  email         VARCHAR(255),
  password_hash VARCHAR(255),
  role          VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('owner','manager','accountant','staff','readonly')),
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- PARTIES (CUSTOMERS / SUPPLIERS)
-- ===========================
CREATE TABLE parties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(20) DEFAULT 'customer' CHECK (type IN ('customer','supplier','both')),
  phone         VARCHAR(15),
  whatsapp      VARCHAR(15),
  email         VARCHAR(255),
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  gstin         VARCHAR(15),
  credit_limit  DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,  -- positive = customer owes us
  tags          TEXT[],
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- PRODUCTS (FABRICS, YARNS, ETC.)
-- ===========================
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(50),
  category      VARCHAR(100),   -- Saree, Fabric, Yarn, Dress Material, Dupatta
  subcategory   VARCHAR(100),   -- Georgette, Chiffon, Cotton, Silk
  unit          VARCHAR(20) DEFAULT 'meter' CHECK (unit IN ('meter','kg','piece','bundle','box','roll')),
  hsn_code      VARCHAR(10),
  gst_rate      DECIMAL(5,2) DEFAULT 5.00,
  purchase_rate DECIMAL(15,2),  -- cost price
  sale_rate     DECIMAL(15,2),  -- default selling price
  current_stock DECIMAL(15,3) DEFAULT 0,
  reorder_level DECIMAL(15,3) DEFAULT 0,
  max_stock     DECIMAL(15,3),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- GODOWNS / WAREHOUSES
-- ===========================
CREATE TABLE godowns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  address       TEXT,
  is_active     BOOLEAN DEFAULT true
);

CREATE TABLE product_stock_by_godown (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  product_id    UUID NOT NULL REFERENCES products(id),
  godown_id     UUID NOT NULL REFERENCES godowns(id),
  quantity      DECIMAL(15,3) DEFAULT 0,
  UNIQUE(product_id, godown_id)
);

-- ===========================
-- TRANSACTIONS (SALES / PURCHASES)
-- ===========================
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('sale','purchase','receipt','payment','credit_note','debit_note','expense')),
  party_id        UUID REFERENCES parties(id),
  reference_no    VARCHAR(100),        -- INV-2024-001 or BILL-2024-001
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  subtotal        DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_amount  DECIMAL(15,2) DEFAULT 0,
  cgst_amount     DECIMAL(15,2) DEFAULT 0,
  sgst_amount     DECIMAL(15,2) DEFAULT 0,
  igst_amount     DECIMAL(15,2) DEFAULT 0,
  total_amount    DECIMAL(15,2) NOT NULL,
  paid_amount     DECIMAL(15,2) DEFAULT 0,
  balance_amount  DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('draft','pending','partial','paid','cancelled')),
  payment_mode    VARCHAR(20),          -- cash, neft, rtgs, upi, cheque
  notes           TEXT,
  tally_id        VARCHAR(100),         -- Tally voucher ID for sync
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transaction_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  product_name    VARCHAR(255),         -- snapshot at time of sale
  quantity        DECIMAL(15,3) NOT NULL,
  unit            VARCHAR(20),
  rate            DECIMAL(15,2) NOT NULL,
  discount_pct    DECIMAL(5,2) DEFAULT 0,
  amount          DECIMAL(15,2) NOT NULL,
  gst_rate        DECIMAL(5,2),
  gst_amount      DECIMAL(15,2),
  total_amount    DECIMAL(15,2) NOT NULL,
  godown_id       UUID REFERENCES godowns(id),
  batch_no        VARCHAR(100),
  sort_order      INTEGER DEFAULT 0
);

-- ===========================
-- STOCK MOVEMENTS
-- ===========================
CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  transaction_id  UUID REFERENCES transactions(id),
  godown_id       UUID REFERENCES godowns(id),
  type            VARCHAR(30) NOT NULL CHECK (type IN ('purchase','sale','opening','return_in','return_out','transfer_in','transfer_out','adjustment','damage','sample')),
  quantity        DECIMAL(15,3) NOT NULL,  -- positive=in, negative=out
  rate            DECIMAL(15,2),
  batch_no        VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- MESSAGES (WHATSAPP + GMAIL UNIFIED INBOX)
-- ===========================
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id        UUID REFERENCES parties(id),
  channel         VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','gmail','sms','manual')),
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_address    VARCHAR(255),   -- phone number or email
  to_address      VARCHAR(255),
  subject         VARCHAR(500),   -- for email
  content         TEXT,
  media_urls      TEXT[],
  thread_id       VARCHAR(255),   -- WhatsApp thread or Gmail thread ID
  ai_intent       VARCHAR(50),    -- quote_request, order_confirm, payment, complaint, etc.
  ai_entities     JSONB,          -- { product, quantity, rate, party_name, amount }
  ai_sentiment    VARCHAR(20),    -- positive, neutral, negative
  ai_language     VARCHAR(10),    -- en, hi, gu
  is_read         BOOLEAN DEFAULT false,
  is_replied      BOOLEAN DEFAULT false,
  external_id     VARCHAR(255),   -- WhatsApp message ID or Gmail message ID
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- LEADS / CRM
-- ===========================
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  party_id        UUID REFERENCES parties(id),
  source_message_id UUID REFERENCES messages(id),
  title           VARCHAR(255),
  source          VARCHAR(30) CHECK (source IN ('whatsapp','gmail','referral','walk_in','cold_call','exhibition','manual')),
  status          VARCHAR(30) DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','negotiating','won','lost','on_hold')),
  product_interest TEXT,
  estimated_qty   DECIMAL(15,3),
  estimated_value DECIMAL(15,2),
  quoted_value    DECIMAL(15,2),
  assigned_to     UUID REFERENCES users(id),
  follow_up_date  DATE,
  lost_reason     TEXT,
  won_transaction_id UUID REFERENCES transactions(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- CASH FLOW
-- ===========================
CREATE TABLE cash_flow_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  opening_balance DECIMAL(15,2),
  cash_in         DECIMAL(15,2) DEFAULT 0,
  cash_out        DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2),
  bank_balance    DECIMAL(15,2),
  notes           TEXT,
  UNIQUE(tenant_id, date)
);

-- ===========================
-- INTEGRATION CONFIGS
-- ===========================
CREATE TABLE integration_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL CHECK (type IN ('whatsapp','gmail','tally','marg','busy','custom_erp')),
  config          JSONB NOT NULL DEFAULT '{}',  -- encrypted credentials
  is_active       BOOLEAN DEFAULT false,
  last_sync_at    TIMESTAMPTZ,
  sync_status     VARCHAR(20),
  UNIQUE(tenant_id, type)
);

-- ===========================
-- AI CHAT HISTORY
-- ===========================
CREATE TABLE ai_chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT NOT NULL,
  sql_query       TEXT,           -- the SQL that was executed
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- AUDIT LOG
-- ===========================
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID,
  action          VARCHAR(100) NOT NULL,
  table_name      VARCHAR(100),
  record_id       UUID,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- INDEXES
-- ===========================
CREATE INDEX idx_transactions_tenant_date ON transactions(tenant_id, date);
CREATE INDEX idx_transactions_party ON transactions(party_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, tenant_id);
CREATE INDEX idx_messages_tenant_channel ON messages(tenant_id, channel, created_at DESC);
CREATE INDEX idx_messages_party ON messages(party_id);
CREATE INDEX idx_leads_tenant_status ON leads(tenant_id, status);
CREATE INDEX idx_parties_tenant ON parties(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);

-- Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
-- (apply to all tables with tenant_id)
```

---

## 3. Key Relationships

- Every `transaction` has a `party_id` (who bought/sold) and creates `stock_movements`
- Every WhatsApp message can auto-generate a `lead` via the AI pipeline
- `leads` track the full journey from first message → won order → `transaction`
- `cash_flow_daily` is a summary view — calculated from `transactions` of the day
