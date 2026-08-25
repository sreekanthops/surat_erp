# Feature Specifications — Surat Textile Intelligence Dashboard

---

## MODULE 1: Dashboard Home (KPI Overview)

### Purpose
Single-screen snapshot of the entire business for today.

### KPI Cards
| KPI | Description | Source |
|---|---|---|
| Today's Sales | Total invoice amount today | transactions table |
| Today's Purchases | Total purchase amount today | transactions table |
| Cash in Hand | Opening + receipts − payments | cash_flow table |
| Pending Payments | Outstanding from customers | transactions (unpaid) |
| Stock Value | Total inventory at cost price | products × stock |
| Active Leads | Open inquiries not yet converted | leads table |

### Charts
- **Sales vs Purchase** (last 30 days — bar chart)
- **Cash Flow** (last 7 days — area chart)
- **Top 5 Products** (by revenue — pie chart)
- **Top 5 Customers** (by purchase value — horizontal bar)

### Alerts Panel
- Low stock items (below reorder level)
- Overdue payments (party-wise, amount + days overdue)
- Unanswered WhatsApp messages > 2 hours
- Leads with no follow-up > 3 days

---

## MODULE 2: Inventory Management

### 2.1 Product Catalog
- Add products: Name, Category (Saree/Fabric/Yarn/Dress Material), Unit (meter/kg/piece), HSN Code, GST Rate
- Current stock, reorder level, maximum stock
- Godown/warehouse-wise allocation
- Multiple rate levels (wholesale/retail)

### 2.2 Stock Incoming (Purchase Entry)
```
Fields:
- Supplier name (auto-complete from parties)
- Bill number + date
- Products: name, quantity, rate, amount
- GST (IGST/CGST+SGST auto-calculated by origin state)
- Transport charges
- Godown allocation
- Payment mode + due date
```

### 2.3 Stock Outgoing (Sale / Transfer)
```
Fields:
- Customer name (auto-complete)
- Invoice number (auto-generated: INV-YYYY-XXXX)
- Products: name, quantity (with batch tracking), rate
- Discount (%)
- GST
- Delivery details
- Payment terms
```

### 2.4 Stock Reports
- Current stock position (all products)
- Stock movement register (date-wise in/out)
- Slow-moving / fast-moving items
- Godown-wise stock
- Batch / lot tracking

---

## MODULE 3: Sales & Billing

### 3.1 Invoice Generation
- GST-compliant invoice (CGST+SGST for intra-state, IGST for inter-state)
- Multiple line items
- Auto HSN code lookup
- PDF generation (download + WhatsApp share in 1 click)
- Bulk invoice generation (for regular repeat orders)

### 3.2 Payment Tracking
- Mark payment: amount + mode (cash/NEFT/RTGS/UPI/cheque)
- Part payments supported
- Automatically update party outstanding balance
- Payment receipt PDF generation

### 3.3 Sales Analytics
- Daily / weekly / monthly / yearly sales
- Party-wise sales analysis
- Product-wise sales analysis
- Sales person performance (if multi-user)
- Seasonal trends (textile industry peak seasons: Diwali, Navratri, Wedding season)

---

## MODULE 4: Cash Flow Management

### 4.1 Daily Cash Statement
```
Opening Balance
+ Cash Sales
+ Cash Receipts (customer payments)
− Cash Purchases
− Cash Payments (supplier payments)
− Expenses (transport, labour, misc)
= Closing Balance
```

### 4.2 Bank Reconciliation
- Upload bank statement (CSV)
- Auto-match with recorded transactions
- Flag unmatched entries
- Reconciled balance report

### 4.3 Profit & Loss
- Gross Profit (Sales − Cost of Goods Sold)
- Net Profit (Gross Profit − Operating Expenses)
- Margin % per product category
- Monthly comparison

### 4.4 Cash Flow Forecast (AI-powered)
- Predict next 7 days cash position
- Based on: pending invoices, due dates, historical patterns
- Alert if projected balance goes negative

---

## MODULE 5: Unified Communication Inbox

### 5.1 WhatsApp Inbox
- All incoming messages shown in a unified timeline
- AI badge on each message: **Order | Quote Request | Payment | Complaint | General**
- Reply directly from dashboard (no need to open phone)
- Voice note transcription (Whisper AI)
- Image/PDF attachment viewer
- "Convert to Lead" button on any message
- "Create Invoice" button for order messages
- Message templates for common replies:
  - Rate quotes in Gujarati/Hindi/English
  - Order confirmation
  - Payment reminder
  - Delivery update

### 5.2 Gmail Inbox
- All business emails from customers/suppliers
- Thread view linked to party profile
- PDF invoice attachments auto-parsed
- Reply from dashboard
- "Create PO from email" one-click action

### 5.3 AI Message Classification
Every incoming message is automatically tagged:

```
Intent Labels:
  - quote_request     → Creates draft lead
  - order_confirmation → Creates draft sale order
  - payment_received  → Creates draft receipt entry
  - complaint         → Creates support ticket
  - delivery_inquiry  → Shows last order status
  - catalogue_request → Triggers catalogue PDF send
  - general           → No action
```

---

## MODULE 6: CRM & Leads Management

### 6.1 Lead Pipeline (Kanban Board)
```
[New Inquiry] → [Quoted] → [Negotiating] → [Order Confirmed] → [Won/Lost]
```

Each lead card shows:
- Party name + city
- Product of interest
- Estimated quantity and value
- Source (WhatsApp/Gmail/Referral)
- Last activity date
- AI suggestion: "Follow up today — 5 days since last contact"

### 6.2 Customer Profiles
- Full purchase history
- Outstanding balance
- All messages (WhatsApp + Gmail timeline)
- Quotes sent
- Returns/complaints history
- Credit limit and payment behavior score

### 6.3 Follow-up Reminders
- Set manual reminders
- AI auto-suggests: "Ramesh Textiles asked for georgette quote 3 days ago — no response"
- Daily morning digest: "You have 5 leads to follow up today"

---

## MODULE 7: AI Chatbot (LLM-Powered)

See [`docs/ai-chatbot.md`](ai-chatbot.md) for full specification.

Quick summary of questions the chatbot answers:

```
"Aaj ki sale kitni hai?"          → ₹1,24,500 (12 invoices)
"Is mahine ka profit kya hai?"    → ₹38,200 (margin: 22%)
"Ramesh ka kitna baaki hai?"      → ₹45,000 (since 15 Jan)
"Georgette ka stock kitna hai?"   → 2,340 meters (Godown A)
"Aaj koi new inquiry aayi?"       → 3 new WhatsApp inquiries
"Top 3 customers this month?"     → Sharma Traders, Modi Fabrics, Joshi Bros
"Create invoice for Mehta — 500m georgette at 85/m" → Draft created
```

---

## MODULE 8: Reports & Analytics

### Standard Reports
| Report | Description | Export |
|---|---|---|
| Day Book | All transactions for a date range | PDF, Excel |
| Sales Register | All sales invoices | PDF, Excel |
| Purchase Register | All purchase bills | PDF, Excel |
| Stock Summary | Current stock position | PDF, Excel |
| Party Ledger | Account statement for a party | PDF, Excel |
| Outstanding Report | Pending payments (customer/supplier) | PDF, Excel |
| P&L Statement | Profit and Loss | PDF |
| GST Reports | GSTR-1, GSTR-2 data export | Excel |

### AI-Generated Reports (Natural Language)
- "End of day summary" — auto-generated at 8pm
- "Weekly business report" — every Monday morning
- "Monthly performance review" — 1st of each month

---

## MODULE 9: Settings & Configuration

### Business Settings
- Company profile (name, GSTIN, address, logo)
- Godown/warehouse management
- Tax configuration (GST rates per category)
- Invoice template customization
- Default payment terms

### Integration Settings
- WhatsApp: Connect/disconnect, template management
- Gmail: OAuth connect/disconnect
- Tally: Configure connection, sync frequency
- ERP: Upload template, configure field mapping

### User Management (Multi-user plans)
- Roles: Owner / Manager / Accountant / Sales Staff / View-only
- Feature-level permissions
- Activity log

### Subscription & Billing
- Current plan overview
- Usage metrics (messages processed, AI queries used)
- Upgrade/downgrade plan
- Invoice history
