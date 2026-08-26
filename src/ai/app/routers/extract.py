from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.services.extractor import MessageExtractor

router = APIRouter()
extractor = MessageExtractor()


class ExtractRequest(BaseModel):
    content: Optional[str] = None
    type: str = "text"


class ExtractResponse(BaseModel):
    intent: str
    entities: dict
    language: str
    sentiment: str
    is_potential_customer: bool = False
    customer_score: int = 0
    customer_signals: List[str] = []


@router.post("/extract-message-entities", response_model=ExtractResponse)
async def extract_entities(req: ExtractRequest):
    result = await extractor.extract(req.content or "", req.type)
    return ExtractResponse(**result)


@router.post("/classify-intent")
async def classify_intent(body: dict):
    content = body.get("content", "")
    result = await extractor.classify_intent(content)
    return result
