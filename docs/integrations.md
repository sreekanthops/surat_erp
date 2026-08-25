# Integration Guide — WhatsApp, Gmail, Tally & ERP

---

## 1. WhatsApp Business API (Meta Cloud API)

### Overview
WhatsApp is the **primary communication channel** for Surat textile businesses.
We use the Meta Cloud API (free for first 1000 conversations/month).

### Setup Steps

#### Step 1 — Meta Developer Account
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a Meta App → Select "Business" type
3. Add "WhatsApp" product to the app
4. Register a phone number (dedicated WhatsApp Business number per tenant)

#### Step 2 — Webhook Configuration
```
Webhook URL:   https://api.yourdomain.com/webhooks/whatsapp
Verify Token:  {WHATSAPP_VERIFY_TOKEN from .env}
Subscriptions: messages, message_status
```

#### Step 3 — Environment Variables
```env
WHATSAPP_API_VERSION=v19.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
WHATSAPP_VERIFY_TOKEN=your_random_verify_token
WHATSAPP_APP_SECRET=your_app_secret_for_hmac
```

#### Step 4 — Incoming Message Handler
```javascript
// src/backend/integrations/whatsapp/webhook.js
app.post('/webhooks/whatsapp', async (req, res) => {
  const { entry } = req.body;
  for (const e of entry) {
    for (const change of e.changes) {
      const msg = change.value.messages?.[0];
      if (!msg) continue;
      // Push to BullMQ queue for async AI processing
      await messageQueue.add('process-whatsapp', {
        from: msg.from,
        type: msg.type,         // text | image | audio | document
        content: msg.text?.body || msg.caption,
        mediaId: msg.image?.id || msg.audio?.id,
        timestamp: msg.timestamp
      });
    }
  }
  res.sendStatus(200);
});
```

#### Step 5 — AI Processing Worker
```javascript
// src/backend/workers/whatsapp-processor.js
messageQueue.process('process-whatsapp', async (job) => {
  const { from, content, type } = job.data;
  
  // 1. Identify tenant by phone number
  const tenant = await findTenantByWhatsAppNumber(from);
  
  // 2. Extract entities with AI
  const aiResult = await aiService.extractEntities(content);
  // Returns: { intent: 'quote_request', product: 'georgette', quantity: '500m', price: null }
  
  // 3. Store in messages table
  await db.messages.create({ tenant_id: tenant.id, content, ai_intent: aiResult.intent, ai_entities: aiResult });
  
  // 4. Auto-create lead if it's a new inquiry
  if (aiResult.intent === 'quote_request') {
    await leadsService.createFromMessage(tenant.id, from, aiResult);
  }
  
  // 5. Push real-time event to frontend
  io.to(`tenant:${tenant.id}`).emit('new_message', { channel: 'whatsapp', ... });
});
```

#### What We Extract from WhatsApp Messages

| Intent | Example Message | Extracted Data |
|---|---|---|
| `quote_request` | "Bhai georgette 500 meter ka rate kya hai?" | product=georgette, qty=500m |
| `order_confirm` | "Confirm karo 1000 meter saree fabric" | product=saree fabric, qty=1000m |
| `payment_info` | "Maine 50000 transfer kar diye" | amount=50000, type=payment |
| `complaint` | "Maal acha nahi tha pichli baar" | type=complaint |
| `delivery_query` | "Kab milega maal?" | type=delivery_inquiry |

---

## 2. Gmail API (Google OAuth2)

### Overview
Gmail integration captures email threads with customers, extracts quotes, purchase orders,
and payment confirmations automatically.

### Setup Steps

#### Step 1 — Google Cloud Console
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable Gmail API
4. Create OAuth2 credentials (Web Application)
5. Add authorized redirect URI: `https://api.yourdomain.com/auth/gmail/callback`

#### Step 2 — Scopes Required
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.modify
```

#### Step 3 — Environment Variables
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/auth/gmail/callback
```

#### Step 4 — OAuth Flow
```javascript
// src/backend/integrations/gmail/auth.js
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate auth URL (shown to user once)
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly', ...],
  prompt: 'consent'  // Force refresh token
});
```

#### Step 5 — Email Watch (Push Notifications)
```javascript
// Set up Gmail push notifications (no polling needed)
await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: 'projects/your-project/topics/gmail-push',
    labelIds: ['INBOX']
  }
});
// Google publishes to Cloud Pub/Sub → your webhook
```

#### What We Extract from Emails

- **Subject line analysis** → Order/invoice/payment/complaint classification
- **PDF attachment OCR** → Invoice/PO data extraction
- **Party matching** → Link email sender to existing party in database
- **Quote extraction** → Parse product, quantity, rate from email body

---

## 3. Tally Prime Integration

### Overview
Tally Prime is the most widely used accounting software in Surat textile businesses.
We offer two integration modes: **Tally HTTP Bridge** (real-time) and **CSV Import** (manual).

### Mode A — Tally HTTP XML Bridge (Recommended)

Tally Prime has a built-in HTTP server on port 9000 that accepts XML requests.

#### Step 1 — Enable Tally HTTP Server
In Tally Prime:
```
Gateway of Tally → F12 Configuration → Advanced Configuration
→ Enable TallyPrime Server: YES
→ Port: 9000
```

#### Step 2 — Tally XML Request Format
```xml
<!-- Fetch all vouchers for today -->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Day Book</REPORTNAME>
        <STATICVARIABLES>
          <SVFROMDATE>20240101</SVFROMDATE>
          <SVTODATE>20240131</SVTODATE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
```

#### Step 3 — Sync Worker
```javascript
// src/backend/workers/tally-sync.js
const tallySync = async (tenantId) => {
  const { tallyHost, tallyPort } = await getTallyConfig(tenantId);
  
  // Fetch sales vouchers
  const sales = await fetchTallyData(tallyHost, tallyPort, 'Sales Register');
  // Fetch stock movements
  const stock = await fetchTallyData(tallyHost, tallyPort, 'Stock Summary');
  // Fetch party ledgers
  const ledgers = await fetchTallyData(tallyHost, tallyPort, 'Ledger');
  
  // Transform and upsert into our DB
  await upsertSalesFromTally(tenantId, sales);
  await upsertStockFromTally(tenantId, stock);
  await upsertPartiesFromTally(tenantId, ledgers);
  
  // Scheduled: every 15 minutes during business hours
};
```

### Mode B — CSV/Excel Import

For users who cannot expose Tally HTTP locally:
1. Export from Tally: **Export → Excel → Day Book / Stock Summary / Ledger**
2. Upload CSV in dashboard → automated ETL pipeline
3. Data mapped and inserted via import templates

---

## 4. ERP Integrations (Marg / Busy / Custom)

### Marg ERP
```
Integration method: Marg provides an ODBC driver + REST API (Marg Web Service)
Endpoint: http://localhost:8080/MargAPI/
Auth: Username/Password (Basic Auth)
Sync data: Parties, Products, Sales, Purchases, Stock
```

### Busy ERP
```
Integration method: BUSY provides XML data export + direct DB access (SQL Server)
Database: BUSY uses Microsoft SQL Server
Connection: ODBC/JDBC connection string
Sync data: Vouchers, Stock, Parties
```

### Generic ERP / Custom
```
Integration method: CSV template upload OR REST webhook
Template provided for:
  - Party Master (customers/suppliers)
  - Product Master (items/fabric types)
  - Sales Register
  - Purchase Register
  - Stock Ledger
```

---

## 5. Payment Gateway (Razorpay)

For subscription billing:
```env
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Subscription plans created as Razorpay Plans → auto-debit monthly.

---

## 6. Integration Status Dashboard

The frontend shows a live integration health panel:

```
WhatsApp   ● Connected  (Last message: 2 min ago)
Gmail      ● Connected  (Last sync: 5 min ago)
Tally      ● Connected  (Last sync: 14 min ago)
Marg ERP   ○ Not configured
Busy ERP   ○ Not configured
```
