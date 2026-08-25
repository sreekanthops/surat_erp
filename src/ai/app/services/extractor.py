import json
from openai import AsyncOpenAI
from app.core.config import settings
from langdetect import detect

client = AsyncOpenAI(api_key=settings.openai_api_key)

INTENTS = [
    "quote_request",
    "order_confirm",
    "payment_info",
    "complaint",
    "delivery_query",
    "catalogue_request",
    "general",
]

EXTRACTION_PROMPT = """
You are an AI assistant for a textile business. Analyze this message and extract structured information.

Message: "{content}"

Return a JSON object with these fields:
- intent: one of {intents}
- language: "hi" | "en" | "gu" | "hinglish"
- sentiment: "positive" | "neutral" | "negative"
- entities: {{
    product: string or null,      // fabric name (georgette, chiffon, saree, etc.)
    quantity: string or null,     // number + unit
    unit: string or null,         // meter, kg, piece
    rate: string or null,         // price per unit
    amount: string or null,       // total amount
    party_name: string or null    // customer/supplier name if mentioned
  }}

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
            }

        try:
            lang = detect(content)
        except Exception:
            lang = "hi"

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",  # cheaper model for extraction
                messages=[
                    {
                        "role": "user",
                        "content": EXTRACTION_PROMPT.format(
                            content=content,
                            intents=", ".join(INTENTS),
                        ),
                    }
                ],
                temperature=0,
                max_tokens=300,
                response_format={"type": "json_object"},
            )

            result = json.loads(response.choices[0].message.content or "{}")

            return {
                "intent": result.get("intent", "general"),
                "entities": result.get("entities", {}),
                "language": result.get("language", lang),
                "sentiment": result.get("sentiment", "neutral"),
            }

        except Exception:
            return {
                "intent": "general",
                "entities": {},
                "language": lang,
                "sentiment": "neutral",
            }

    async def classify_intent(self, content: str) -> dict:
        result = await self.extract(content)
        return {"intent": result["intent"], "language": result["language"]}
