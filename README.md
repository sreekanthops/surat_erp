# 🧵 Surat Textile Intelligence Dashboard

> **AI-powered business intelligence platform for Surat's textile industry**
> Integrates WhatsApp, Gmail, Tally, ERP systems with LLM chatbot for real-time business insights.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Feature Modules](#feature-modules)
4. [Tech Stack](#tech-stack)
5. [Integration Ecosystem](#integration-ecosystem)
6. [Subscription Model](#subscription-model)
7. [Getting Started](#getting-started)
8. [Documentation Index](#documentation-index)

---

## Project Overview

The Surat Textile Intelligence Dashboard is a SaaS platform built specifically for textile manufacturers,
traders, and wholesalers in Surat, India. It consolidates all business data — inventory, sales, customer
communication (WhatsApp/Gmail), accounting (Tally/ERP), and cash flow — into a single AI-powered interface.

**Target Users:**
- Textile manufacturers (mill owners)
- Cloth wholesalers / traders
- Yarn & fabric dealers
- Retailers with B2B operations

**Core Value Proposition:**
> "Ask your business anything — in Hindi or English" via the built-in AI chatbot powered by LLM.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SURAT TEXTILE DASHBOARD                          │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  WhatsApp    │  │    Gmail     │  │ Tally / ERP  │  │  Manual    │ │
│  │  Business    │  │   OAuth      │  │   API/CSV    │  │  Entry     │ │
│  │  API (Meta)  │  │  Integration │  │  Integration │  │  Forms     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         └─────────────────┴─────────────────┴────────────────┘        │
│                                    │                                    │
│                         ┌──────────▼──────────┐                        │
│                         │   DATA INGESTION     │                        │
│                         │   PIPELINE (ETL)     │                        │
│                         │   - Normalisation    │                        │
│                         │   - Entity Tagging   │                        │
│                         │   - AI Extraction    │                        │
│                         └──────────┬──────────┘                        │
│                                    │                                    │
│            ┌───────────────────────▼───────────────────────┐           │
│            │            CORE DATABASE LAYER                 │           │
│            │  PostgreSQL (structured) + Redis (cache)       │           │
│            │  + Pinecone/Weaviate (vector embeddings)        │           │
│            └───────────────────────┬───────────────────────┘           │
│                                    │                                    │
│         ┌──────────────────────────▼──────────────────────────┐        │
│         │               AI / LLM ENGINE                        │        │
│         │  GPT-4o / Llama3 (on-premise option)                 │        │
│         │  - Chatbot (sales/profit/lead queries)               │        │
│         │  - Auto-classification of messages                   │        │
│         │  - Quote generation assistant                        │        │
│         │  - Anomaly detection in cash flow                    │        │
│         └──────────────────────────┬──────────────────────────┘        │
│                                    │                                    │
│                         ┌──────────▼──────────┐                        │
│                         │   REST API + WS      │                        │
│                         │   (Node.js/FastAPI)  │                        │
│                         └──────────┬──────────┘                        │
│                                    │                                    │
│          ┌─────────────────────────▼─────────────────────────┐         │
│          │            REACT DASHBOARD (Frontend)              │         │
│          │  - Inventory Board  - Sales Analytics              │         │
│          │  - Chat Inbox       - Cash Flow                    │         │
│          │  - AI Chatbot       - Ledger/Accounts              │         │
│          │  - Leads CRM        - Reports                      │         │
│          └───────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Modules

| Module | Description |
|---|---|
| 📦 Inventory | Stock incoming/outgoing, lot tracking, warehouse management |
| 💰 Sales & Billing | Invoice generation, party-wise sales, payment tracking |
| 💸 Cash Flow | Daily cash in/out, bank reconciliation, loss/profit P&L |
| 📲 WhatsApp Inbox | All customer messages, AI-tagged by intent (order/quote/complaint) |
| 📧 Gmail Integration | Email threads linked to parties, quote extraction |
| 🤖 AI Chatbot | LLM-powered "ask anything" about your business |
| 📊 Analytics | Sales trends, top products, seasonal analysis |
| 🧾 Tally/ERP Sync | Two-way sync with Tally Prime / Marg / Busy |
| 👥 CRM & Leads | Customer profiles, lead pipeline, follow-up reminders |
| 🔔 Alerts | Low stock, overdue payments, unusual transactions |

---

## Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** (build tool)
- **Tailwind CSS** + shadcn/ui
- **Recharts** (data visualisation)
- **Zustand** (state management)
- **React Query** (server state)
- **Socket.io-client** (real-time updates)

### Backend
- **Node.js** + Express (primary API)
- **FastAPI** (Python — AI/ML services)
- **PostgreSQL** (primary database)
- **Redis** (caching + message queues)
- **BullMQ** (job queues for data ingestion)
- **Prisma ORM**

### AI / ML
- **OpenAI GPT-4o** / **Groq LLaMA 3** (chatbot)
- **LangChain** (orchestration)
- **Pinecone** (vector DB for semantic search)
- **Whisper** (voice-to-text for WhatsApp voice notes)

### Infrastructure
- **Docker** + **Docker Compose**
- **AWS / GCP** (cloud deployment)
- **Nginx** (reverse proxy)
- **Let's Encrypt** (SSL)

### Integrations
- **Meta WhatsApp Business API**
- **Google Gmail API** (OAuth2)
- **Tally Prime** (HTTP XML API / TCP bridge)
- **Marg ERP** / **Busy ERP** (CSV/API)
- **Razorpay** (subscription billing)
- **Firebase** (push notifications)

---

## Integration Ecosystem

See [`docs/integrations.md`](docs/integrations.md) for detailed step-by-step setup.

---

## Subscription Model

| Plan | Price (INR/month) | Users | Features |
|---|---|---|---|
| **Starter** | ₹1,499 | 1 user | Manual entry + basic reports + AI chatbot (100 queries/day) |
| **Growth** | ₹3,999 | 5 users | + WhatsApp + Gmail integration + Tally sync |
| **Pro** | ₹7,999 | 15 users | + Full ERP + Advanced AI + Custom reports |
| **Enterprise** | Custom | Unlimited | On-premise option + dedicated support + API access |

See [`docs/subscription-model.md`](docs/subscription-model.md) for full business plan.

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/your-org/surat-textile-dashboard.git
cd surat-textile-dashboard

# 2. Copy environment variables
cp .env.example .env

# 3. Install dependencies (installs both backend & frontend deps)
npm install

# 4. Start with Docker Compose
docker-compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Seed demo data
npm run db:seed

# 7. Start development
npm run dev
```

---

## Documentation Index

| File | Description |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System architecture deep-dive |
| [`docs/features.md`](docs/features.md) | Feature specifications per module |
| [`docs/integrations.md`](docs/integrations.md) | WhatsApp, Gmail, Tally, ERP integration guide |
| [`docs/ai-chatbot.md`](docs/ai-chatbot.md) | LLM chatbot design and prompt engineering |
| [`docs/data-models.md`](docs/data-models.md) | Database schema and entity relationships |
| [`docs/subscription-model.md`](docs/subscription-model.md) | SaaS pricing and business model |
| [`docs/deployment.md`](docs/deployment.md) | Production deployment guide |
| [`docs/api-reference.md`](docs/api-reference.md) | REST API endpoints reference |
# surat_erp
