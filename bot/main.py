"""
Main entry point for SRE Copilot Incident Bot
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
from dotenv import load_dotenv

load_dotenv()

from bot.alert_handler import router as alert_router
from bot.dashboard_router import router as dashboard_router
from bot.timeline import timeline_manager
from bot.auth import (
    config as auth_config,
    auth_dispatch,
    auth_router,
    users_router,
    bootstrap as auth_bootstrap,
)

# Basic logging configuration for the bot
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sre_copilot")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up SRE Copilot Bot...")
    from bot.providers import init_providers
    from bot.alertmanager_poller import poll_alertmanagers_loop
    auth_bootstrap()  # init auth DB + create initial admin on first run
    init_providers()
    poller_task = asyncio.create_task(poll_alertmanagers_loop())
    yield
    poller_task.cancel()
    logger.info("Shutting down SRE Copilot Bot...")
    timeline_manager.cleanup()

app = FastAPI(
    title="SRE Copilot bot",
    description="AI-Assisted Incident Management platform webhook receiver",
    lifespan=lifespan
)

# Auth middleware (added first => runs INNER, after CORS). Enforces session
# authn, RBAC, and CSRF on every /api/v1 request. See bot/auth/middleware.py.
app.add_middleware(BaseHTTPMiddleware, dispatch=auth_dispatch)

# CORS middleware (added last => OUTERMOST, so preflight + headers wrap auth
# responses too). Explicit allow-list — never "*" with credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=auth_config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth + user-management routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])

# Alert webhook router (Alertmanager integration)
app.include_router(alert_router, prefix="/api/v1/alerts", tags=["alerts"])

# Dashboard router (frontend cockpit data endpoints)
app.include_router(dashboard_router, prefix="/api/v1", tags=["dashboard"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "sre-copilot-bot"}
