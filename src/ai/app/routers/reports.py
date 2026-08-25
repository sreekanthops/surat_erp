from fastapi import APIRouter

router = APIRouter()


@router.post("/anomaly-detection")
async def anomaly_detection(body: dict):
    # TODO: implement cash flow anomaly detection
    return {"anomalies": [], "status": "ok"}


@router.post("/summarize-day")
async def summarize_day(body: dict):
    # TODO: generate end-of-day summary using LLM
    return {"summary": "Day summary feature coming soon.", "status": "ok"}
