"""
Main entry point for SRE Copilot Incident Bot
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from bot.alert_handler import router as alert_router
from bot.dashboard_router import router as dashboard_router
from bot.timeline import timeline_manager

# Basic logging configuration for the bot
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sre_copilot")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up SRE Copilot Bot...")
    yield
    logger.info("Shutting down SRE Copilot Bot...")
    timeline_manager.cleanup()

app = FastAPI(
    title="SRE Copilot bot",
    description="AI-Assisted Incident Management platform webhook receiver",
    lifespan=lifespan
)

# Add CORS middleware — allow Next.js frontend running on any port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Alert webhook router (Alertmanager integration)
app.include_router(alert_router, prefix="/api/v1/alerts", tags=["alerts"])

# Dashboard router (frontend cockpit data endpoints)
app.include_router(dashboard_router, prefix="/api/v1", tags=["dashboard"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "sre-copilot-bot"}
