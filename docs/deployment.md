# Deployment Guide — Production Setup

---

## 1. Infrastructure Overview

```
                    ┌─────────────────────┐
                    │   Cloudflare CDN     │
                    │   (DDoS + SSL)       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Nginx (Reverse     │
                    │   Proxy + SSL term)  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
   ┌──────────▼──────┐ ┌───────▼───────┐ ┌─────▼──────┐
   │  React SPA      │ │  Node.js API  │ │ Python AI  │
   │  (Static build) │ │  (Port 3001)  │ │ (Port 8000)│
   └─────────────────┘ └───────┬───────┘ └─────┬──────┘
                               │               │
              ┌────────────────┼───────────────┘
              │                │
   ┌──────────▼──────┐ ┌───────▼───────┐
   │  PostgreSQL     │ │  Redis Cache  │
   │  (Port 5432)    │ │  (Port 6379)  │
   └─────────────────┘ └───────────────┘
```

---

## 2. Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: textile_db
      POSTGRES_USER: textile_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./src/backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://textile_user:${DB_PASSWORD}@postgres:5432/textile_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      WHATSAPP_ACCESS_TOKEN: ${WHATSAPP_ACCESS_TOKEN}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src/backend:/app
      - /app/node_modules

  ai-service:
    build: ./src/ai
    ports:
      - "8000:8000"
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      PINECONE_API_KEY: ${PINECONE_API_KEY}
      DATABASE_URL: postgresql://textile_user:${DB_PASSWORD}@postgres:5432/textile_db
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./src/frontend
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:3001
      VITE_WS_URL: ws://localhost:3001
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 3. Environment Variables

```env
# .env.example

# Application
NODE_ENV=production
APP_URL=https://app.textiledashboard.in
API_URL=https://api.textiledashboard.in
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/textile_db
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=another_secret_key

# AI / OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
PINECONE_API_KEY=pcsk_...
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=textile-messages

# WhatsApp (Meta Business API)
WHATSAPP_API_VERSION=v19.0
WHATSAPP_VERIFY_TOKEN=random_token_you_choose
WHATSAPP_APP_SECRET=your_meta_app_secret
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx

# Google / Gmail
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REDIRECT_URI=https://api.textiledashboard.in/auth/gmail/callback

# Payment
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# AWS (for file storage)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-south-1
AWS_S3_BUCKET=textile-dashboard-files

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@textiledashboard.in
SMTP_PASS=app_password

# Firebase (push notifications)
FIREBASE_PROJECT_ID=textile-dashboard
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
```

---

## 4. Production Deployment (AWS)

### Step 1 — Server Setup
```bash
# Ubuntu 22.04 LTS — t3.medium (2 vCPU, 4GB RAM) minimum
# t3.large (2 vCPU, 8GB RAM) recommended for 100+ tenants

sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
```

### Step 2 — Clone & Configure
```bash
git clone https://github.com/your-org/surat-textile-dashboard.git
cd surat-textile-dashboard
cp .env.example .env
# Edit .env with production values
nano .env
```

### Step 3 — SSL Certificate
```bash
sudo certbot --nginx -d app.textiledashboard.in -d api.textiledashboard.in
```

### Step 4 — Database Migrations
```bash
docker-compose up -d postgres redis
npm run db:migrate
npm run db:seed:plans  # seed Razorpay subscription plans
```

### Step 5 — Start All Services
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Step 6 — Nginx Configuration
```nginx
# /etc/nginx/sites-available/textile-api
server {
    listen 443 ssl;
    server_name api.textiledashboard.in;
    
    ssl_certificate /etc/letsencrypt/live/textiledashboard.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/textiledashboard.in/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 5. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run tests
        run: npm test
      
      - name: Build Docker images
        run: docker-compose build
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_IP }}
          username: ubuntu
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/textile-dashboard
            git pull origin main
            docker-compose -f docker-compose.prod.yml up -d --build
            docker-compose exec backend npm run db:migrate
```

---

## 6. Monitoring & Alerts

- **Uptime monitoring:** BetterUptime / UptimeRobot (free tier)
- **Error tracking:** Sentry (React + Node.js)
- **Logs:** CloudWatch (AWS) or Papertrail
- **Database monitoring:** pgAdmin / Datadog
- **Alert on:** API downtime, high memory, failed Tally syncs, payment failures

---

## 7. Backup Strategy

```bash
# Daily PostgreSQL backup to S3
0 2 * * * pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://textile-backups/$(date +%Y-%m-%d).sql.gz

# Keep 30 days of backups
# Test restore monthly
```
