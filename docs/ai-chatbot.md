# AI Chatbot Design — LLM Integration

---

## 1. Overview

The AI chatbot is the **flagship feature** of the platform.
Textile business owners in Surat are busy — they don't want to navigate dashboards.
They want to **ask questions in natural language** (Hindi, English, or Gujarati) and get instant answers.

---

## 2. Capabilities

### 2.1 Data Query (Read)
```
User: "Aaj ki sale kitni hai?"
Bot:  "Aaj 12 invoices bane hain, total ₹1,24,500. Sabse bada order Sharma Traders ka hai — ₹38,000."

User: "Is mahine ka profit kya hai?"
Bot:  "February mein abhi tak ₹38,200 ka net profit hai (margin: 22%). Pichle mahine se 8% zyada."

User: "Georgette 4-way ka stock kitna hai?"
Bot:  "Godown A mein 2,340 meter aur Godown B mein 890 meter — total 3,230 meter."

User: "Ramesh Textiles ka kitna baaki hai?"
Bot:  "Ramesh Textiles ka ₹45,000 outstanding hai. Sabse purana bill 15 January ka — 45 din ho gaye."

User: "Top customers this month?"
Bot:  "1. Sharma Traders — ₹2.1L  2. Modi Fabrics — ₹1.8L  3. Joshi Bros — ₹1.4L"
```

### 2.2 Action Commands (Write)
```
User: "Mehta ka invoice banao — 500 meter georgette at ₹85"
Bot:  "Invoice draft ready: INV-2024-0234 | Mehta Fabrics | 500m × ₹85 = ₹42,500 + GST ₹2,125 = ₹44,625. Confirm karein?"

User: "Ramesh ko payment reminder bhejo"
Bot:  "WhatsApp reminder Ramesh Textiles ko send kar diya: '₹45,000 outstanding hai, please settle karein.'"

User: "Aaj ka end-of-day summary bhejo email pe"
Bot:  "Summary email aapke registered email pe send kar diya."
```

### 2.3 Business Insights (AI Analysis)
```
User: "Is mahine slow-moving products kaun se hain?"
Bot:  "Nylon Fabric aur Cotton Plain — dono mein pichhle 30 din mein 0 sales. Reorder mat karna abhi."

User: "Cash kab tight hogi?"
Bot:  "Agle 10 din mein projected cash low point 15 Feb hai — ₹12,000 only. Sharma ka ₹80,000 due hai us din, so should be fine."
```

### 2.4 Lead & Inquiry Handling
```
User: "Aaj koi new inquiry aayi?"
Bot:  "3 new WhatsApp inquiries: 1) Patel Fabrics — georgette quote  2) Unknown number — saree fabric  3) Ram Bhai — bulk order discuss karna hai"

User: "Patel Fabrics wali inquiry pe quote bhejo — georgette 4-way ₹88/m"
Bot:  "Quote WhatsApp pe Patel Fabrics ko send kar diya. Lead status 'Quoted' kar diya."
```

---

## 3. Technical Architecture

### 3.1 LLM Pipeline (LangChain)

```
User Input (Hindi/English/Gujarati)
        │
        ▼
┌─────────────────────────────────────┐
│  Language Detection (LangDetect)     │
└─────────────────┬───────────────────┘
                  │
        ┌─────────▼──────────┐
        │  Intent Router      │
        │  (classify intent)  │
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────────────────────────────┐
        │            Routing Decision                   │
        ├─────────────────────┬───────────────────────┤
        │    DATA QUERY        │    ACTION COMMAND      │
        │    (read-only SQL)   │    (write operations)  │
        └─────────┬───────────┴──────────┬────────────┘
                  │                      │
        ┌─────────▼────────┐   ┌─────────▼────────────┐
        │  Text-to-SQL     │   │  Action Executor       │
        │  (GPT-4o + schema│   │  (invoice/message/etc) │
        │   context)       │   │  + confirmation step   │
        └─────────┬────────┘   └─────────┬────────────┘
                  │                      │
        ┌─────────▼────────┐             │
        │  SQL Query       │             │
        │  Executor        │             │
        └─────────┬────────┘             │
                  │                      │
        ┌─────────▼──────────────────────▼────────────┐
        │              Response Synthesizer             │
        │  (GPT-4o — formats result in user language)   │
        └─────────────────────┬───────────────────────┘
                              │
                              ▼
                       Final Response
```

### 3.2 Text-to-SQL Implementation

```python
# src/ai/chatbot/sql_agent.py
from langchain.agents import create_sql_agent
from langchain.sql_database import SQLDatabase
from langchain_openai import ChatOpenAI

class TextileQueryAgent:
    def __init__(self, tenant_id: str, db_url: str):
        self.tenant_id = tenant_id
        self.db = SQLDatabase.from_uri(db_url)
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0)
    
    async def query(self, user_message: str, language: str) -> str:
        # System prompt with tenant context
        system_prompt = f"""
        You are a business assistant for a textile business in Surat, India.
        Always filter data by tenant_id = '{self.tenant_id}'.
        
        Business context:
        - They deal in fabrics, sarees, dress materials, yarn
        - Quantities in meters, kilograms, or pieces
        - Currency in Indian Rupees (₹)
        - Parties = customers and suppliers
        - Stock movements = inventory in/out
        
        User is communicating in: {language}
        Always respond in the SAME language as the user.
        
        Today's date: {today}
        Current financial year: April 2024 - March 2025
        """
        
        result = await self.agent.arun(
            input=user_message,
            callbacks=[self.audit_callback]
        )
        return result
```

### 3.3 System Prompt Engineering

Key prompt sections:
1. **Tenant isolation** — always filter by tenant_id
2. **Textile vocabulary** — HSN codes, fabric types, Surat-specific terms
3. **Hindi/Gujarati support** — respond in user's language
4. **Safety rails** — never expose other tenants' data, no destructive SQL
5. **Date context** — current financial year, today's date
6. **Confirmation for writes** — always ask before creating/modifying records

### 3.4 Vector Search (Semantic)

For searching messages and past conversations:
```python
# When user asks "Patel ne kya order kiya tha?"
# We do: vector search on messages + ledger context

from pinecone import Pinecone

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index("textile-messages")

# Embed the query
query_embedding = openai.embeddings.create(
    input="Patel order history",
    model="text-embedding-3-small"
)

# Search
results = index.query(
    vector=query_embedding.data[0].embedding,
    filter={"tenant_id": tenant_id},
    top_k=5,
    include_metadata=True
)
```

---

## 4. Multi-Language Support

| Language | Support Level | Notes |
|---|---|---|
| **Hindi** | Full | Primary language for most Surat traders |
| **English** | Full | Business owners familiar with English |
| **Gujarati** | Partial | Script recognition, responds in English/Hindi |
| **Hinglish** | Full | Mixed Hindi+English (most common in practice) |

---

## 5. Voice Input (WhatsApp Voice Notes)

Many textile owners send voice notes instead of typing.

```python
# src/ai/extractors/voice_processor.py
import openai

async def transcribe_voice_note(audio_file_path: str, language_hint: str = "hi") -> str:
    with open(audio_file_path, "rb") as audio_file:
        transcript = openai.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language_hint  # "hi" for Hindi
        )
    return transcript.text

# After transcription → run through same AI pipeline as text messages
```

---

## 6. Daily AI-Generated Summaries

### Morning Briefing (sent at 9:00 AM)
```
Good morning! Today's priorities:
- 3 leads to follow up (Patel, Shah, Mehta)  
- 2 overdue payments: Sharma ₹45K (45 days), Joshi ₹12K (15 days)
- Georgette 4-way stock low — only 340m left (reorder level: 500m)
- 5 unanswered WhatsApp messages from yesterday
```

### Evening Summary (sent at 7:00 PM)
```
Today's Business Summary:
Sales: ₹1,24,500 | Purchases: ₹65,000 | Net: ₹59,500
New orders: 5 | Leads created: 3 | Messages received: 23
Payments received: ₹85,000 | Payments due: ₹45,000
```

---

## 7. AI Limits by Plan

| Plan | Daily AI Queries | Voice Transcription | Auto-Summaries |
|---|---|---|---|
| Starter | 100/day | ✗ | Weekly only |
| Growth | 500/day | ✓ (50/month) | Daily |
| Pro | Unlimited | ✓ (Unlimited) | Daily + Custom |
| Enterprise | Unlimited | ✓ Unlimited | Custom frequency |

---

## 8. LLM Provider Options

| Provider | Model | Cost | Privacy | Recommended For |
|---|---|---|---|---|
| OpenAI | GPT-4o | ₹0.15/1K tokens | Cloud | Default (best quality) |
| Groq | LLaMA 3.1 70B | ₹0.05/1K tokens | Cloud | Cost-sensitive |
| Ollama | LLaMA 3.2 | Free | On-premise | Enterprise plan |
| Azure OpenAI | GPT-4o | Enterprise pricing | Azure region | Enterprise compliance |
