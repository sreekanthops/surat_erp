import json
from openai import AsyncOpenAI
from app.core.config import settings
from langdetect import detect

# Use OpenRouter just like chatbot.py
client = AsyncOpenAI(
    api_key=settings.openrouter_api_key or settings.openai_api_key,
    base_url="https://openrouter.ai/api/v1" if settings.openrouter_api_key else "https://api.openai.com/v1",
    default_headers=(
        {"HTTP-Referer": "https://surat-textile-dashboard.app", "X-Title": "GSpaces AI CRM"}
        if settings.openrouter_api_key else {}
    ),
)

# Use a cheap fast model for extraction
EXTRACT_MODEL = "openai/gpt-4o-mini" if settings.openrouter_api_key else "gpt-4o-mini"

INTENTS = [
    "quote_request",          # asking for price / rate
    "order_confirm",          # confirming an order
    "payment_info",           # sharing payment details
    "complaint",              # complaint / quality issue
    "delivery_query",         # asking about delivery / tracking
    "catalogue_request",      # asking for product catalogue
    "new_customer_inquiry",   # brand-new prospect asking about business
    "bulk_inquiry",           # asking for bulk / wholesale pricing
    "sample_request",         # requesting fabric sample
    "reorder",                # repeat customer reordering
    "general",                # anything else
]

EXTRACTION_PROMPT = """
You are an AI assistant for a textile/fabric wholesale business in Surat, India.
Analyze the WhatsApp message below and extract structured information.

Message: "{content}"

Return a JSON object with these fields:
- intent: one of [{intents}]
- language: "hi" | "en" | "gu" | "hinglish"
- sentiment: "positive" | "neutral" | "negative"
- is_potential_customer: true if this looks like a NEW prospect (first inquiry, asking about
  products/prices, new number, no purchase history context in message)
- customer_score: integer 0-100 representing how strong a buying signal this is
  (0=noise, 40=moderate interest, 70+=hot lead)
- customer_signals: list of strings describing WHY this person could become a customer,
  e.g. ["asking bulk price", "mentions urgent need", "new phone number", "asking for catalogue"]
- entities: {{
    product: string or null,          // fabric type e.g. "georgette", "chiffon", "banarasi silk"
    quantity: string or null,         // e.g. "500 meter", "1000 kg"
    unit: string or null,
    rate: string or null,
    amount: string or null,
    party_name: string or null,       // if sender mentions their own name or shop
    city: string or null,             // if they mention their city/location
    urgency: "urgent" | "normal" | null
  }}

Be generous with is_potential_customer — if there is ANY buying signal, set it to true.
Respond ONLY with valid JSON, no explanation.
"""


class MessageExtractor:

    async def extract(self, content: str, msg_type: str = "text") -> dict:
        if not content or not content.strip():
            return {
                "intent": "general",
                "entities": {},
                "language": "hi",
                "sentiment": "neutral",
                "is_potential_customer": False,
                "customer_score": 0,
                "customer_signals": [],
            }

        try:
            lang = detect(content)
        except Exception:
            lang = "hi"

        try:
            response = await client.chat.completions.create(
                model=EXTRACT_MODEL,
                messages=[{
                    "role": "user",
                    "content": EXTRACTION_PROMPT.format(
                        content=content,
                        intents=", ".join(INTENTS),
                    ),
                }],
                temperature=0,
                max_tokens=500,
                response_format={"type": "json_object"},
            )

            result = json.loads(response.choices[0].message.content or "{}")

            # Derive is_potential_customer from score if AI didn't set it
            score = int(result.get("customer_score", 0))
            is_potential = result.get("is_potential_customer", score >= 40)

            return {
                "intent": result.get("intent", "general"),
                "entities": result.get("entities", {}),
                "language": result.get("language", lang),
                "sentiment": result.get("sentiment", "neutral"),
                "is_potential_customer": bool(is_potential),
                "customer_score": score,
                "customer_signals": result.get("customer_signals", []),
            }

        except Exception:
            # Fallback: keyword-based scoring
            score = 0
            signals = []
            if any(kw in content.lower() for kw in ["rate", "price", "kitna", "quote", "kya hai", "cost"]):
                score += 50; signals.append("asking price/rate")
            if any(kw in content.lower() for kw in ["meter", "kg", "piece", "bulk", "wholesale"]):
                score += 20; signals.append("bulk quantity mention")
            if any(kw in content.lower() for kw in ["urgent", "asap", "jaldi", "today", "aaj"]):
                score += 15; signals.append("urgent need")
            if any(kw in content.lower() for kw in ["catalogue", "catalog", "list", "variety"]):
                score += 25; signals.append("catalogue request")
            if any(kw in content.lower() for kw in ["confirm", "order", "bhejo", "send"]):
                score += 30; signals.append("order intent")

            return {
                "intent": "quote_request" if score >= 50 else "catalogue_request" if "catalogue" in content.lower() else "general",
                "entities": {},
                "language": lang,
                "sentiment": "neutral",
                "is_potential_customer": score >= 40,
                "customer_score": min(100, score),
                "customer_signals": signals,
            }

    async def classify_intent(self, content: str) -> dict:
        result = await self.extract(content)
        return {
            "intent": result["intent"],
            "language": result["language"],
            "is_potential_customer": result["is_potential_customer"],
            "customer_score": result["customer_score"],
            "customer_signals": result["customer_signals"],
        }
