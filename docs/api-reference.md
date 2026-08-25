# API Reference — Surat Textile Intelligence Dashboard

Base URL: `https://api.textiledashboard.in/api/v1`

Authentication: `Authorization: Bearer {jwt_token}`

---

## Authentication

### POST /auth/login
```json
Request:
{
  "phone": "9876543210",
  "password": "your_password"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "uuid",
    "name": "Ramesh Shah",
    "role": "owner",
    "tenant": {
      "id": "uuid",
      "name": "Shah Fabrics",
      "plan": "growth"
    }
  }
}
```

---

## Dashboard

### GET /dashboard/summary
```json
Response 200:
{
  "today": {
    "sales_amount": 124500,
    "sales_count": 12,
    "purchase_amount": 65000,
    "cash_in": 85000,
    "cash_out": 42000,
    "new_messages": 8,
    "new_leads": 3
  },
  "month": {
    "sales_amount": 890000,
    "profit_amount": 195000,
    "profit_margin": 21.9
  },
  "alerts": [
    { "type": "low_stock", "product": "Georgette 4-way", "stock": 340, "reorder": 500 },
    { "type": "overdue_payment", "party": "Ramesh Textiles", "amount": 45000, "days": 45 }
  ]
}
```

---

## Inventory

### GET /inventory/products
**Query params:** `?search=georgette&category=Fabric&page=1&limit=20`
```json
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "name": "Georgette 4-way",
      "category": "Fabric",
      "unit": "meter",
      "current_stock": 2340,
      "reorder_level": 500,
      "sale_rate": 88.50,
      "gst_rate": 5
    }
  ],
  "total": 48,
  "page": 1
}
```

### POST /inventory/movements
```json
Request:
{
  "type": "purchase",
  "party_id": "uuid",
  "date": "2024-02-15",
  "bill_no": "BILL-2024-0123",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 1000,
      "rate": 72.00,
      "godown_id": "uuid"
    }
  ],
  "payment_mode": "credit",
  "due_date": "2024-03-15"
}
```

---

## Sales

### GET /sales/invoices
**Query params:** `?from=2024-02-01&to=2024-02-29&party_id=uuid&status=pending`
```json
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "reference_no": "INV-2024-0234",
      "date": "2024-02-15",
      "party": { "id": "uuid", "name": "Sharma Traders" },
      "total_amount": 44625,
      "paid_amount": 0,
      "balance_amount": 44625,
      "status": "pending"
    }
  ],
  "total": 156
}
```

### POST /sales/invoices
```json
Request:
{
  "party_id": "uuid",
  "date": "2024-02-15",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 500,
      "rate": 85.00,
      "discount_pct": 0,
      "godown_id": "uuid"
    }
  ],
  "payment_mode": "credit",
  "due_date": "2024-03-15",
  "notes": "Urgent delivery needed"
}

Response 201:
{
  "id": "uuid",
  "reference_no": "INV-2024-0235",
  "total_amount": 44625,
  "pdf_url": "https://files.textiledashboard.in/invoices/INV-2024-0235.pdf"
}
```

---

## Messages / Inbox

### GET /messages/inbox
**Query params:** `?channel=whatsapp&is_read=false&intent=quote_request&page=1`
```json
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "channel": "whatsapp",
      "direction": "inbound",
      "from_address": "+919876543210",
      "party": { "id": "uuid", "name": "Patel Fabrics" },
      "content": "Bhai georgette 500 meter ka rate kya hai?",
      "ai_intent": "quote_request",
      "ai_entities": { "product": "georgette", "quantity": "500", "unit": "meter" },
      "ai_language": "hi",
      "is_read": false,
      "created_at": "2024-02-15T10:23:00Z"
    }
  ]
}
```

### POST /messages/reply
```json
Request:
{
  "message_id": "uuid",
  "content": "Georgette 4-way ka rate ₹88/meter hai. 500 meter ke liye ₹44,000.",
  "create_lead": true
}
```

---

## AI Chatbot

### POST /ai/chat
```json
Request:
{
  "session_id": "uuid",  // optional, creates new session if null
  "message": "Aaj ki sale kitni hai?"
}

Response 200:
{
  "session_id": "uuid",
  "response": "Aaj 12 invoices bane hain, total ₹1,24,500. Sabse bada order Sharma Traders ka tha — ₹38,000 ka.",
  "data": {
    "type": "sales_summary",
    "period": "today",
    "total": 124500,
    "count": 12
  },
  "sql_executed": "SELECT COUNT(*), SUM(total_amount) FROM transactions WHERE tenant_id='...' AND date=CURRENT_DATE AND type='sale'"
}
```

---

## Leads

### GET /leads
**Query params:** `?status=new&source=whatsapp`
```json
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "title": "Patel Fabrics — Georgette inquiry",
      "party": { "name": "Patel Fabrics", "phone": "9876543210" },
      "status": "new",
      "source": "whatsapp",
      "product_interest": "Georgette 4-way",
      "estimated_value": 44000,
      "created_at": "2024-02-15T10:23:00Z",
      "follow_up_date": "2024-02-16"
    }
  ]
}
```

### PATCH /leads/:id/status
```json
Request:
{
  "status": "quoted",
  "quoted_value": 44000,
  "notes": "Sent quote on WhatsApp"
}
```

---

## Reports

### GET /reports/profit-loss
**Query params:** `?from=2024-02-01&to=2024-02-29`
```json
Response 200:
{
  "period": { "from": "2024-02-01", "to": "2024-02-29" },
  "sales": 890000,
  "cost_of_goods": 694000,
  "gross_profit": 196000,
  "gross_margin_pct": 22.02,
  "expenses": { "transport": 8000, "labour": 5000, "other": 3000 },
  "total_expenses": 16000,
  "net_profit": 180000,
  "net_margin_pct": 20.22
}
```

### GET /reports/gst-summary
**Query params:** `?month=2024-02`
```json
Response 200:
{
  "taxable_sales": 800000,
  "cgst_collected": 20000,
  "sgst_collected": 20000,
  "igst_collected": 15000,
  "total_gst_collected": 55000,
  "gstr1_data": [ ... ]
}
```

---

## WebSocket Events

Connect: `wss://api.textiledashboard.in?token={jwt}`

```javascript
// Subscribe to tenant-specific events
socket.on('new_message', (data) => { /* new WhatsApp/Gmail message */ });
socket.on('stock_updated', (data) => { /* inventory changed */ });
socket.on('payment_received', (data) => { /* payment marked */ });
socket.on('lead_updated', (data) => { /* lead status changed */ });
socket.on('tally_sync_completed', (data) => { /* Tally sync done */ });
socket.on('alert', (data) => { /* low stock / overdue payment alert */ });
```

---

## Error Codes

| Code | Meaning |
|---|---|
| `AUTH_001` | Invalid credentials |
| `AUTH_002` | Token expired |
| `AUTH_003` | Insufficient permissions |
| `TENANT_001` | Plan limit exceeded |
| `TENANT_002` | Subscription expired |
| `INT_001` | WhatsApp not connected |
| `INT_002` | Tally sync failed |
| `AI_001` | Daily AI query limit reached |
| `VALIDATION_001` | Required field missing |
