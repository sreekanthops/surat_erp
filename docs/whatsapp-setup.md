# 📱 WhatsApp Business API — Complete Setup Guide

> **For beginners.** This guide walks you through connecting your WhatsApp Business number
> to GSpaces TextileIQ so you can receive and reply to customer messages directly from the app.

---

## What You Will Achieve

After following this guide:
- Every WhatsApp message sent to your business number **appears in your CRM Inbox** automatically
- AI classifies each message (Quote Request, Order, Complaint, etc.) and **scores potential customers**
- You can **reply from the CRM** and the reply goes to the customer's WhatsApp
- Hot leads are **auto-created** from buying-signal messages

---

## Prerequisites

| Requirement | Details |
|---|---|
| Facebook / Meta account | Any personal Facebook account works |
| A phone number for WhatsApp Business | Must NOT be active on regular WhatsApp app (see note below) |
| Your backend running | `npm run dev` in `src/backend` |
| ngrok (for local dev) | `brew install ngrok` or download from ngrok.com |

> ⚠️ **Important about your phone number:**
> Meta does not allow a number that is active on the regular WhatsApp or WhatsApp Business **app** to
> also be a WhatsApp Business API number. You must either:
> - Use a **fresh SIM** (any ₹50 prepaid SIM works)
> - Or **delete** the existing WhatsApp account on that number first:
>   WhatsApp → Settings → Account → Delete my account

---

## Part 1 — Create a Meta Developer App

### Step 1.1 — Go to Meta Developers

Open [developers.facebook.com](https://developers.facebook.com) and log in with your Facebook account.

### Step 1.2 — Create a new App

1. Click **"My Apps"** → **"Create App"**
2. Choose **"Business"** as the app type
3. Fill in:
   - **App name:** `GSpaces TextileIQ` (or any name)
   - **Contact email:** your email
   - **Business Account:** select your business (or create one)
4. Click **"Create app"**

### Step 1.3 — Add WhatsApp to your App

1. On the app dashboard, find **"WhatsApp"** in the product list
2. Click **"Set up"**
3. Select your **WhatsApp Business Account (WABA)** or create a new one
4. Click **"Continue"**

---

## Part 2 — Get Your Credentials

Go to your app → **WhatsApp → API Setup**. You will see:

```
Phone Number ID:  1155364537667687        ← copy this
WABA ID:          1724324769011254        ← copy this
Access Token:     EAAxxxxx...             ← copy this (valid 24h for testing)
```

> 📝 The temporary access token expires in **24 hours**. For production, generate a permanent
> token using a System User (see Part 5 below).

---

## Part 3 — Expose Your Local Backend (ngrok)

Meta needs a **public HTTPS URL** to send you messages. In development, use ngrok.

### Step 3.1 — Install ngrok

```bash
# Mac
brew install ngrok

# Windows
choco install ngrok

# Or download from https://ngrok.com/download
```

### Step 3.2 — Start your backend

```bash
cd src/backend
npm run dev
# Backend runs on http://localhost:3001
```

### Step 3.3 — Start ngrok in a new terminal

```bash
ngrok http 3001
```

You will see output like:
```
Forwarding   https://abc123.ngrok-free.app → http://localhost:3001
```

Copy the **`https://abc123.ngrok-free.app`** URL — you need it in the next step.

---

## Part 4 — Register the Webhook with Meta

### Step 4.1 — Set your Verify Token in .env

Open `src/backend/.env` and set:

```env
WHATSAPP_VERIFY_TOKEN=gspaces-wa-token-changeme
WHATSAPP_API_VERSION=v25.0
```

Restart the backend after changing `.env`.

### Step 4.2 — Register the webhook in Meta

1. Go to your app → **WhatsApp → Configuration**
2. Click **"Edit"** next to Webhook
3. Fill in:

| Field | Value |
|---|---|
| **Callback URL** | `https://abc123.ngrok-free.app/webhooks/whatsapp` |
| **Verify Token** | `gspaces-wa-token-changeme` |

4. Click **"Verify and save"** — you should see a green checkmark ✅

> If it fails, test your URL manually in a browser:
> ```
> https://abc123.ngrok-free.app/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=gspaces-wa-token-changeme&hub.challenge=TEST
> ```
> You should see `TEST` in the browser. If not, check that your backend is running.

### Step 4.3 — Subscribe to messages

Scroll down on the same page → **Webhook Fields** → find **`messages`** → click **Subscribe**.

---

## Part 5 — Add Your Business Phone Number

### Step 5.1 — Prepare your number

Your business number must NOT be active on any WhatsApp app. If it is:

1. Open WhatsApp on that phone
2. Go to **Settings → Account → Delete my account**
3. Delete the account
4. Wait 2–3 minutes

### Step 5.2 — Add the number in Meta

1. Go to your app → **WhatsApp → Step 2. Production setup**
2. Click **"Add phone number"**
3. Fill in:
   - **Display name:** Your business name (e.g. `GSpaces Textiles`)
   - **Category:** `Retail` or `Professional Services`
   - **Phone number:** Your business number with country code (e.g. `+91 8790007228`)
4. Choose **Text message** for verification
5. Enter the OTP that arrives on your phone
6. Click **"Verify"**

You now have a **real Phone Number ID** for your number. Go to **WhatsApp → API Setup** to see it.

---

## Part 6 — Connect in the CRM App

### Step 6.1 — Open the Connect WA wizard

1. Open your app at `http://localhost:3000`
2. Log in
3. Click **"Inbox"** in the left sidebar
4. Click the green **"Connect WA"** button (top right)

### Step 6.2 — Fill in credentials (Step 1 of wizard)

| Field | Where to find it |
|---|---|
| **Phone Number ID** | Meta → WhatsApp → API Setup → "From" section |
| **WABA ID** | Meta → WhatsApp → API Setup → below Phone Number ID |
| **Access Token** | Meta → WhatsApp → API Setup → Temporary access token |

Click **"Verify & Save →"**

The app calls Meta API to verify your credentials, then saves them to the database.

### Step 6.3 — Copy webhook URL (Step 2 of wizard)

The wizard shows you the **Callback URL** and **Verify Token** — these should already be registered
from Part 4. Click **"Done, Test it →"**.

### Step 6.4 — Send a test message (Step 3 of wizard)

Enter your phone number and click **"📱 Send Test Message"**.

You should receive a WhatsApp message on your phone saying:
> ✅ GSpaces TextileIQ — WhatsApp connection test successful!

---

## Part 7 — Generate a Permanent Access Token

The temporary token expires every 24 hours. For production, create a System User token.

### Step 7.1 — Go to Business Settings

Open [business.facebook.com/settings](https://business.facebook.com/settings)

### Step 7.2 — Create a System User

1. Left sidebar → **Users → System users**
2. Click **"+ Add"**
3. Name: `gspaces-whatsapp`, Role: **Admin**
4. Click **"Create system user"**

### Step 7.3 — Assign App Access

1. Click **"Add assets"** on the new system user
2. Left panel → **Apps** → select your app (`GSpaces TextileIQ`)
3. Toggle **Full control**
4. Click **Save**

### Step 7.4 — Assign WhatsApp Account Access

1. Left sidebar → **Accounts → WhatsApp accounts**
2. Click **"Add people"** on your WABA
3. Switch to **System users** tab
4. Select `gspaces-whatsapp` → Full control → **Save**

### Step 7.5 — Generate the token

1. Back to **System users** → click **"Generate new token"** on `gspaces-whatsapp`
2. Select your app
3. Check these two permissions:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
4. Set **Token expiration → Never**
5. Click **"Generate token"**
6. **Copy it immediately** — Meta shows it only once

### Step 7.6 — Update .env with permanent token

```env
WHATSAPP_ACCESS_TOKEN=EAAxxxxx...your-permanent-token...
```

Restart the backend. Then go back to **Inbox → Connect WA** and update the Access Token field.

---

## Part 8 — Test Two-Way Messaging

### Send a message to your business number (incoming)

1. From your **personal phone** (e.g. +91 7075077384), open WhatsApp
2. Message your **business number** (e.g. +91 8790007228) — try:
   ```
   Georgette ka rate kya hai? 500 meter chahiye
   ```
3. Go to your app → **Inbox** — you should see the message appear within seconds
4. AI will classify it as `Quote Request` with a high customer score
5. Check **🎯 Potential Leads** tab — a lead will be auto-created

### Reply from the CRM (outgoing)

1. Click the message in the Inbox to open it
2. Type your reply in the green box at the bottom
3. Click the **green Send button**
4. The reply arrives on your personal phone's WhatsApp

---

## Part 9 — Add Test Recipients (Sandbox Only)

While your Meta app is **unpublished** (in development), you can only message numbers that are
explicitly added as test recipients.

1. Go to **WhatsApp → Step 1. Try it out**
2. Click **"Manage phone number list"**
3. Add your personal number (e.g. `+91 7075077384`)
4. Enter the OTP that arrives
5. Now messages to/from that number work in sandbox mode

> Once you publish your app for production, this restriction is removed.

---

## Troubleshooting

### "The callback URL couldn't be validated"
- Make sure the URL includes `/webhooks/whatsapp` at the end
- Make sure ngrok is running and backend is running on port 3001
- Test the URL manually in browser (see Part 4.2)
- Make sure `WHATSAPP_VERIFY_TOKEN` in `.env` exactly matches what you entered in Meta

### Messages not appearing in Inbox
- Check backend logs for `[WA Webhook]` entries
- If you see `status update only (delivery receipt)` — that's normal, it means you need an **incoming** message (someone messaging you, not you messaging them)
- Make sure you subscribed to the `messages` webhook field in Meta

### "No active WhatsApp integration found"
- Go to Inbox → Connect WA → complete the wizard to save credentials to DB
- Make sure `phoneNumberId` in the wizard matches what Meta shows in API Setup

### Access token expired
- Generate a new temporary token in Meta → WhatsApp → API Setup
- Or follow Part 7 to generate a permanent token
- Update via Inbox → Connect WA → Step 1 → re-enter token → Verify & Save

### ngrok URL changes every restart (free plan)
- Free ngrok gives a new URL each time you restart it
- You must update the webhook URL in Meta each time
- To avoid this: upgrade to ngrok paid plan (fixed subdomain) or deploy to a real server

---

## Environment Variables Reference

Add these to `src/backend/.env`:

```env
# WhatsApp Business API
WHATSAPP_API_VERSION=v25.0
WHATSAPP_VERIFY_TOKEN=gspaces-wa-token-changeme   # must match Meta webhook config
WHATSAPP_APP_SECRET=                               # optional — from Meta App → Settings → Basic
WHATSAPP_ACCESS_TOKEN=EAAxxxxx...                  # from Meta API Setup or System User
WHATSAPP_PHONE_NUMBER_ID=1155364537667687          # from Meta API Setup
WHATSAPP_WABA_ID=1724324769011254                  # WhatsApp Business Account ID
```

---

## Production Deployment Checklist

- [ ] Replace ngrok with a real domain (e.g. `https://api.yourdomain.com`)
- [ ] Update webhook URL in Meta to your real domain
- [ ] Generate a permanent System User token (Part 7)
- [ ] Set `WHATSAPP_APP_SECRET` for HMAC signature verification
- [ ] Submit your Meta app for Business Verification (required for >250 messages/day)
- [ ] Accept WhatsApp Business Platform Terms of Service in Meta Business Manager

---

*Last updated: August 2026 | GSpaces TextileIQ*
