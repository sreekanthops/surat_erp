import os
from typing import List, Tuple, Optional
from openai import AsyncOpenAI
from app.core.config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are an expert AI business assistant for a textile business in Surat, India.

You help the business owner query their data and get actionable insights.

Rules:
- Always filter queries by tenant_id = '{tenant_id}'
- Respond in the SAME language as the user (Hindi, English, or Hinglish)
- Format currency in Indian Rupees (₹)
- Quantities are in meters, kg, or pieces
- Be concise and direct — business owners are busy
- For data queries, you can generate SQL to fetch data
- Never expose data from other tenants
- For write operations (create invoice, send message), always confirm before acting

Database tables available:
- transactions (type: SALE/PURCHASE/RECEIPT/PAYMENT, total_amount, date, party_id, status)
- transaction_items (product_id, quantity, rate, amount)
- products (name, category, current_stock, unit, sale_rate, purchase_rate)
- parties (name, type, current_balance, city)
- messages (channel, ai_intent, content, direction, created_at)
- leads (status, product_interest, estimated_value, source, created_at)
- stock_movements (type, quantity, product_id, created_at)
- cash_flow_daily (date, cash_in, cash_out, closing_balance)

Today's date: {today}
Current tenant_id: {tenant_id}
"""


class TextileChatbot:

    async def answer(
        self,
        tenant_id: str,
        message: str,
        history: List[Tuple[str, str]],
    ) -> dict:
        from datetime import date

        system = SYSTEM_PROMPT.format(
            tenant_id=tenant_id,
            today=date.today().isoformat(),
        )

        messages = [{"role": "system", "content": system}]
        for role, content in history[-8:]:  # last 8 messages for context
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=0.3,
            max_tokens=800,
        )

        reply = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else None

        return {
            "response": reply,
            "tokens_used": tokens,
            "sql_query": None,  # TODO: implement text-to-SQL for structured queries
        }

    async def daily_suggestions(self, tenant_id: str) -> dict:
        """Generate proactive daily suggestions for the business owner."""
        prompt = f"""
        For a textile business (tenant_id: {tenant_id}), generate 3-5 actionable morning suggestions.
        Keep them concise, practical, and in Hinglish.
        Format as a JSON list of strings.
        Example: ["Ramesh Textiles ka ₹45,000 payment overdue hai — follow up karo", ...]
        """

        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=300,
        )

        return {"suggestions": response.choices[0].message.content}
