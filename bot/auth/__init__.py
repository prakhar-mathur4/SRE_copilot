"""
Self-contained authentication + RBAC for SRE Copilot.

Public surface used by bot/main.py:
  - bootstrap():        create tables + initial Owner admin (idempotent)
  - auth_dispatch:      HTTP middleware enforcing authn/authz/CSRF
  - auth_router:        /api/v1/auth/* (login, logout, me, change-password)
  - users_router:       /api/v1/users/* (admin user management)
  - verify_webhook_hmac: FastAPI dependency for the Alertmanager webhook
  - config:             env-driven AuthConfig (CORS origins, cookie flags, ...)

See AUTH_RBAC_PLAN.md for the full design.
"""
from bot.auth.config import config
from bot.auth.middleware import auth_dispatch
from bot.auth.router import auth_router, users_router
from bot.auth.service import bootstrap
from bot.auth.webhook import verify_webhook_hmac

__all__ = [
    "config",
    "auth_dispatch",
    "auth_router",
    "users_router",
    "bootstrap",
    "verify_webhook_hmac",
]
