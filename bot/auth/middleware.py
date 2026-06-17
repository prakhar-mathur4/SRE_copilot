"""
Single-chokepoint authentication + authorization for all HTTP requests.

Runs as Starlette HTTP middleware (so WebSocket upgrades bypass it — WS auth is
Phase 1). Responsibilities, in order:
  1. let truly public paths through (health, docs, login, CORS preflight)
  2. let the machine webhook through (HMAC is enforced in the route itself)
  3. resolve the session cookie -> current user (401 if missing/expired)
  4. CSRF double-submit check on mutating methods
  5. /auth/* self-service: any authenticated user, allowed during forced change
  6. forced-password-change gate
  7. role check against the central policy (/users/* -> ADMIN; fail-closed ADMIN)
  8. audit successful privileged mutations
"""
import logging

from starlette.responses import JSONResponse

from bot.auth import service
from bot.auth.config import config
from bot.auth.roles import Role, has_at_least, required_role, privileged_action, requires_step_up

logger = logging.getLogger("sre_copilot")

_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}

# Exact paths reachable with no session at all.
_PUBLIC_EXACT = {
    "/health",
    "/api/v1/auth/login",
    "/docs",
    "/redoc",
    "/openapi.json",
}


def _json(status, detail, code):
    return JSONResponse(status_code=status, content={"detail": detail, "code": code})


async def auth_dispatch(request, call_next):
    path = request.url.path
    method = request.method

    # 1. public + non-API paths
    if path in _PUBLIC_EXACT or not path.startswith("/api/v1"):
        return await call_next(request)

    # 2. machine webhook path — HMAC verified inside the route, never session
    if path.startswith("/api/v1/alerts/"):
        return await call_next(request)

    # 3. authenticate — Bearer service-account token OR session cookie
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        principal = service.resolve_token(auth_header)
        if not principal:
            return _json(401, "Invalid or expired API token.", "invalid_token")
        user = principal["user"]
        is_token = True
        resolved = None
    else:
        resolved = service.resolve_session(request.cookies.get(config.cookie_name))
        if not resolved:
            return _json(401, "Authentication required.", "unauthenticated")
        user = resolved["user"]
        is_token = False
    request.state.user = user
    request.state.is_token = is_token

    # 4. CSRF double-submit (cookie sessions only; bearer tokens are CSRF-immune)
    if not is_token and method in _MUTATING:
        sent = request.headers.get("X-CSRF-Token")
        if not sent or sent != resolved["csrf_token"]:
            return _json(403, "Missing or invalid CSRF token.", "csrf_failed")

    # 5. /auth/* self-service — session users only (allowed mid forced-change)
    if path.startswith("/api/v1/auth/"):
        if is_token:
            return _json(403, "API tokens cannot use auth endpoints.", "forbidden")
        return await call_next(request)

    # 6. forced password change blocks everything else (session users only)
    if not is_token and user["must_change_password"]:
        return _json(403, "Password change required before continuing.",
                     "password_change_required")

    # 7. authorize
    if path.startswith("/api/v1/users") or path.startswith("/api/v1/tokens"):
        needed = Role.ADMIN
    else:
        needed = required_role(method, path)
        if needed is None:
            logger.warning("No access policy for %s %s — failing closed (ADMIN).", method, path)
            needed = Role.ADMIN

    if not has_at_least(user["role"], needed):
        return _json(403, f"Requires '{needed.value}' role or higher.", "forbidden")

    # 7b. step-up: the most destructive ops need a recent password re-prompt.
    # Tokens have no password to re-prompt, so these ops stay human-only.
    if requires_step_up(method, path):
        if is_token:
            return _json(403, "Service-account tokens cannot perform this operation.", "token_forbidden")
        if not service.is_stepped_up(resolved):
            return _json(403, "Re-authenticate to perform this action.", "step_up_required")

    # 8. run + audit privileged mutations
    action = privileged_action(method, path)
    response = await call_next(request)
    if action and response.status_code < 400:
        service.write_audit(action, actor=user, target=path,
                            metadata={"status": response.status_code, "via": "token" if is_token else "session"})
    return response
