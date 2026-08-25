from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services.chatbot import TextileChatbot

router = APIRouter()
chatbot = TextileChatbot()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    tenantId: str
    message: str
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    response: str
    sqlQuery: Optional[str] = None
    tokensUsed: Optional[int] = None


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        result = await chatbot.answer(
            tenant_id=req.tenantId,
            message=req.message,
            history=[(m.role, m.content) for m in (req.history or [])],
        )
        return ChatResponse(
            response=result["response"],
            sqlQuery=result.get("sql_query"),
            tokensUsed=result.get("tokens_used"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daily-suggestions")
async def daily_suggestions(body: dict):
    tenant_id = body.get("tenantId")
    result = await chatbot.daily_suggestions(tenant_id)
    return result
