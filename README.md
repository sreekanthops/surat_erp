# 🧵 Surat Textile Intelligence Dashboard

> AI-powered business intelligence platform for Surat's textile industry.  
> Integrates WhatsApp Business, Gmail, Tally/ERP with an LLM chatbot for real-time business insights.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & Install](#2-clone--install)
3. [Environment Setup](#3-environment-setup)
4. [Database Setup](#4-database-setup)
5. [Run the App](#5-run-the-app)
6. [First Login](#6-first-login)
7. [WhatsApp Setup](#7-whatsapp-setup)
8. [Gmail Setup](#8-gmail-setup)
9. [Project Structure](#9-project-structure)
10. [Tech Stack](#10-tech-stack)

---

## 1. Prerequisites

Install these before starting:

| Tool | Version | Install |
|---|---|---|
| **Node.js** | 20+ | https://nodejs.org |
| **npm** | 9+ | comes with Node |
| **Docker Desktop** | latest | https://docker.com/products/docker-desktop |
| **Git** | any | https://git-scm.com |

Verify everything is installed:

```bash
node -v      # v20.x.x
npm -v       # 9.x.x
docker -v    # Docker version 24.x.x
```

---

## 2. Clone & Install

```bash
# Clone the repo
git clone https://github.com/your-org/surat-textile-dashboard.git
cd surat-textile-dashboard

# Install backend dependencies
cd src/backend && npm install && cd ../..

# Install frontend dependencies
cd src/frontend && npm install && cd ../..
```

---

## 3. Environment Setup

```bash
# Copy the example env file
cp .env.example src/backend/.env
```

Open `src/backend/.env` and fill in the required values:

```env
# ── Required ──────────────────────────────────────────────────────────────────

NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
PORT=3001

# Database (Docker will create this automatically)
DATABASE_URL=postgresql://textile_user:your_db_password@localhost:5432/textile_db
REDIS_URL=redis://localhost:6379
DB_PASSWORD=your_db_password          # ← pick any password, must match above

# Auth secrets — generate with: openssl rand -base64 32
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
REFRESH_TOKEN_SECRET=another_super_secret_refresh_token_key

# AI (get key from https://openrouter.ai)
OPENROUTER_API_KEY=sk-or-v1-xxxx
OPENROUTER_MODEL=openai/gpt-4o

# Gmail OAuth callback — do not change this
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/integrations/gmail/callback

# ── Optional (WhatsApp & Gmail creds go in Settings page, not here) ───────────
WHATSAPP_API_VERSION=v19.0
WHATSAPP_VERIFY_TOKEN=gspaces-wa-token-changeme
```

> **WhatsApp and Gmail credentials are NOT set in `.env`.**  
> They are configured at runtime via the **Settings → Integrations** page after login.  
> This keeps each team's credentials isolated in the database.

---

## 4. Database Setup

Start PostgreSQL and Redis using Docker:

```bash
docker-compose up -d postgres redis
```

Wait for both containers to be healthy (about 10 seconds), then run migrations and seed data:

```bash
cd src/backend

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed demo data (products, parties, sales, messages)
npm run db:seed
```

You should see output ending with:

```
🎉 Seed complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Transactions : 280+
  Total Sales  : ₹1,20,00,000+
  Leads        : 7
  Messages     : 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Login → Phone: 7075077384  Pass: admin123
```

---

## 5. Run the App

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd src/backend
npm run dev
# → 🚀 Backend running on port 3001
```

**Terminal 2 — Frontend:**
```bash
cd src/frontend
npm run dev
# → Local: http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

## 6. First Login

Use the seeded admin account:

| Field | Value |
|---|---|
| Phone | `7075077384` |
| Password | `admin123` |

After login you will see the full dashboard with demo data — inventory, sales, leads, messages.

> **Change the password** after first login via Settings → Profile (coming in next release).  
> The `admin123` password is for local development only.

---

## 7. WhatsApp Setup

WhatsApp Business API uses **Meta's Cloud API** — it requires a Facebook Developer account and a verified business phone number.

### Step 1 — Create a Meta App

1. Go to **https://developers.facebook.com** → click **My Apps → Create App**
2. Select **Business** as the app type
3. Give it a name (e.g. `TextileIQ`) and click **Create App**

### Step 2 — Add WhatsApp Product

1. In your new app dashboard, click **Add Product**
2. Find **WhatsApp** → click **Set Up**
3. You will land on **WhatsApp → API Setup**

### Step 3 — Get Your Credentials

From the **API Setup** page, copy:

| Field | Where to find it |
|---|---|
| **Phone Number ID** | Shown under "From" phone number (15-digit number) |
| **WABA ID** | WhatsApp Business Account ID, shown on same page |
| **Access Token** | Temporary token shown on page (valid 24h for testing) |

For a **permanent token**:
1. Go to **Business Settings → System Users → Add System User**
2. Set role to **Admin**
3. Click **Generate Token** → select your app
4. Enable permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
5. Copy the token — it does not expire

### Step 4 — Configure in the App

1. Open the dashboard → go to **Settings → Integrations**
2. In the **WhatsApp Business** card, fill in:
   - Display Phone Number (e.g. `+91 87900 07228`)
   - Phone Number ID
   - WABA ID
   - Access Token
   - App Secret *(optional — from App → Settings → Basic → App Secret)*
   - Verify Token *(any string you choose, e.g. `my-verify-token`)*
3. Click **Save & Connect**
4. The app verifies your credentials with Meta's API — you will see "Connected" on success

### Step 5 — Register the Webhook (for receiving messages)

1. In your Meta app go to **WhatsApp → Configuration → Webhook**
2. Click **Edit**
3. Set:
   - **Callback URL**: `https://your-domain.com/webhooks/whatsapp`
     *(for local dev use [ngrok](https://ngrok.com): `ngrok http 3001` → use the https URL)*
   - **Verify Token**: same value you entered in Settings above
4. Click **Verify and Save**
5. Subscribe to the **messages** webhook field

### Step 6 — Test It

In Settings → WhatsApp, enter your own phone number and click **Send Test** to confirm messages are delivered.

---

## 8. Gmail Setup

Gmail uses **Google OAuth 2.0** — one Gmail account per team is connected via the Settings page.

### Step 1 — Create a Google Cloud Project

1. Go to **https://console.cloud.google.com**
2. Click the project selector (top bar) → **New Project**
3. Name it (e.g. `TextileIQ`) → click **Create**

### Step 2 — Enable the Gmail API

1. In your project, go to **APIs & Services → Library**
2. Search for **Gmail API**
3. Click **Enable**

### Step 3 — Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth 2.0 Client IDs**
3. If prompted, configure the **OAuth consent screen** first:
   - User type: **External**
   - App name: `TextileIQ`
   - Add your email as test user
   - Scopes: add `gmail.readonly`, `gmail.send`, `userinfo.email`
4. Back on Create Credentials → select **Web application**
5. Under **Authorised redirect URIs** → click **Add URI** → paste exactly:
   ```
   http://localhost:3001/api/v1/integrations/gmail/callback
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** shown

### Step 4 — Configure in the App

1. Open the dashboard → go to **Settings → Integrations**
2. In the **Gmail** card you will see a yellow box showing the exact redirect URI (same as above)
3. Under **Step 1**, fill in:
   - **Client ID** — paste from Google Cloud Console
   - **Client Secret** — paste from Google Cloud Console
4. Click **Save Credentials**
5. Under **Step 2**, click **Connect Gmail**
6. Google will open — select the Gmail account to connect
7. Allow the requested permissions
8. You will be redirected back to Settings with "Gmail connected successfully"

### Syncing Emails

After connecting, go to **Gmail** in the sidebar to view and sync your inbox. The app fetches the latest emails and links them to parties by email address automatically.

---

## 9. Project Structure

```
surat-textile-dashboard/
├── src/
│   ├── backend/                  # Node.js + Express API
│   │   ├── src/
│   │   │   ├── api/              # Route handlers (auth, sales, inventory…)
│   │   │   ├── integrations/     # WhatsApp, Gmail, Razorpay webhooks
│   │   │   ├── middleware/       # Auth, tenant, error handlers
│   │   │   ├── services/         # DB, Redis, JWT, logger
│   │   │   ├── workers/          # BullMQ background jobs
│   │   │   ├── seed.ts           # Demo data seeder
│   │   │   └── index.ts          # App entry point
│   │   └── prisma/
│   │       └── schema.prisma     # Database schema
│   ├── frontend/                 # React 18 + Vite
│   │   └── src/
│   │       ├── pages/            # Dashboard, Inbox, Gmail, Settings…
│   │       ├── components/       # Layout, shared components
│   │       ├── store/            # Zustand auth store
│   │       └── hooks/            # useApi (axios + auth)
│   └── ai/                       # Python FastAPI AI service
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 10. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Zustand, Recharts |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16, Redis 7 |
| Auth | JWT (access + refresh tokens), bcrypt |
| AI | OpenRouter → GPT-4o / Claude |
| Messaging | Meta WhatsApp Business Cloud API |
| Email | Google Gmail API (OAuth 2.0) |
| Jobs | BullMQ (background sync workers) |
| Real-time | Socket.io |
| Dev | Docker Compose, tsx watch |

---

## Default Ports

| Service | Port | URL |
|---|---|---|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| AI Service | 8000 | http://localhost:8000 |

---

## Common Issues

**`DATABASE_URL` connection refused**  
→ Docker is not running or containers are not started. Run `docker-compose up -d postgres redis`.

**`relation "tenants" does not exist`**  
→ Migrations haven't run. Run `cd src/backend && npm run db:migrate`.

**Gmail: `redirect_uri_mismatch`**  
→ The URI in Google Cloud Console doesn't match. It must be exactly:  
`http://localhost:3001/api/v1/integrations/gmail/callback` — no trailing slash, no https.

**Gmail: `invalid_client`**  
→ Wrong Client ID or Client Secret saved in Settings. Re-paste them from Google Cloud Console.

**WhatsApp: `Meta API verification failed`**  
→ Access token is expired or wrong Phone Number ID. Generate a new permanent token via Business Settings → System Users.

**Port 3001 already in use**  
→ Run `lsof -ti:3001 | xargs kill` to free the port, then restart.
