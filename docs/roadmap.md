# Project Roadmap — Surat Textile Intelligence Dashboard

---

## Phase 1 — Foundation (Weeks 1–6) ✅

**Goal:** Working MVP with core business logic

### Week 1–2: Backend Setup
- [ ] Project structure setup (monorepo)
- [ ] PostgreSQL schema + migrations (Prisma)
- [ ] Authentication (JWT + refresh tokens)
- [ ] Multi-tenancy foundation (all tables tenant-scoped)
- [ ] Basic REST API scaffold

### Week 3–4: Core Business Features
- [ ] Inventory CRUD (products, stock in/out)
- [ ] Sales invoice creation + PDF generation
- [ ] Party management (customers/suppliers)
- [ ] Basic reports (day book, stock summary)

### Week 5–6: Frontend MVP
- [ ] React app setup (Vite + TypeScript + Tailwind)
- [ ] Dashboard home with KPI cards
- [ ] Inventory management screens
- [ ] Sales/invoice screens
- [ ] Authentication flow

---

## Phase 2 — Integrations (Weeks 7–12)

**Goal:** WhatsApp, Gmail, and Tally connected

### Week 7–8: WhatsApp Integration
- [ ] Meta Cloud API webhook setup
- [ ] BullMQ message processing pipeline
- [ ] AI intent classification (OpenAI)
- [ ] Unified inbox UI

### Week 9–10: Gmail Integration
- [ ] Google OAuth2 flow
- [ ] Gmail Watch + Pub/Sub webhooks
- [ ] Email thread UI
- [ ] PDF attachment parsing

### Week 11–12: Tally Integration
- [ ] Tally HTTP XML bridge
- [ ] Bidirectional sync (parties, products, transactions)
- [ ] CSV import fallback
- [ ] Sync status dashboard

---

## Phase 3 — AI Features (Weeks 13–18)

**Goal:** LLM chatbot + intelligent automation

### Week 13–14: LLM Chatbot
- [ ] LangChain + OpenAI setup
- [ ] Text-to-SQL for data queries
- [ ] Hindi/English/Hinglish support
- [ ] Chat UI with message history

### Week 15–16: AI Pipeline
- [ ] Entity extraction from messages
- [ ] Auto lead creation from WhatsApp
- [ ] Quote generation from chat
- [ ] Voice note transcription (Whisper)

### Week 17–18: Intelligence Features
- [ ] Daily morning/evening summaries
- [ ] Cash flow forecasting
- [ ] Anomaly detection
- [ ] Smart follow-up reminders

---

## Phase 4 — SaaS & Launch (Weeks 19–24)

**Goal:** Production-ready, paying customers

### Week 19–20: Subscription System
- [ ] Razorpay subscription integration
- [ ] Plan-based feature gating
- [ ] Usage metering (AI queries, messages)
- [ ] Billing dashboard

### Week 21–22: Polish & Performance
- [ ] Onboarding wizard (5-minute setup)
- [ ] Mobile-responsive design
- [ ] Performance optimization
- [ ] Load testing

### Week 23–24: Beta Launch
- [ ] 25 beta users in Surat
- [ ] Bug fixes and feedback integration
- [ ] Documentation completion
- [ ] Marketing landing page

---

## Phase 5 — Scale (Month 7+)

- ERP integrations (Marg, Busy)
- Mobile app (React Native)
- GST return filing integration
- B2B marketplace integration
- Multi-language mobile app (Hindi-first)
- Expand to Bhiwandi, Erode, Panipat
