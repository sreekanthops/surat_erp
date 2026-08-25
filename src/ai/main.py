from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routers import chat, extract, reports
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AI Service starting up")
    yield
    logger.info("AI Service shutting down")


app = FastAPI(
    title="Surat Textile AI Service",
    description="LLM-powered business intelligence for textile industry",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/ai", tags=["chat"])
app.include_router(extract.router, prefix="/ai", tags=["extract"])
app.include_router(reports.router, prefix="/ai", tags=["reports"])


@app.get("/health")
async def health():
    return {"status": "ok"}
