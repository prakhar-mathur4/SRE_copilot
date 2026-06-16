"""
FastAPI routes for authentication (/api/v1/auth) and user management
(/api/v1/users). Authorization for both is enforced centrally in middleware.py;
these handlers assume request.state.user is already set for non-login routes.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from bot.auth import service
from bot.auth.config import config

logger = logging.getLogger("sre_copilot")

auth_router = APIRouter()
users_router = APIRouter()


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "display_name": user.get("display_name"),
        "role": user["role"],
        "must_change_password": bool(user["must_change_password"]),
    }


def _set_session_cookie(response: Response, sess: dict):
    response.set_cookie(
        key=config.cookie_name,
        value=sess["token"],
        max_age=sess["max_age"],
        httponly=True,
        secure=config.cookie_secure,
        samesite="lax",
        path="/",
    )


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #

class LoginRequest(BaseModel):
    username: str
    password: str


_LOGIN_ERRORS = {
    "invalid_credentials": (401, "Invalid username or password."),
    "account_locked": (429, "Account temporarily locked due to failed logins."),
    "account_disabled": (403, "This account is disabled."),
}


@auth_router.post("/login")
async def login(payload: LoginRequest):
    user, error = service.authenticate(payload.username, payload.password)
    if error:
        status, detail = _LOGIN_ERRORS.get(error, (401, "Login failed."))
        return JSONResponse(status_code=status, content={"detail": detail, "code": error})

    sess = service.create_session(user)
    body = _public_user(user)
    body["csrf_token"] = sess["csrf_token"]
    response = JSONResponse(content=body)
    _set_session_cookie(response, sess)
    return response


@auth_router.post("/logout")
async def logout(request: Request):
    service.logout(request.cookies.get(config.cookie_name))
    response = JSONResponse(content={"success": True})
    response.delete_cookie(config.cookie_name, path="/")
    return response


@auth_router.get("/me")
async def me(request: Request):
    user = request.state.user
    body = _public_user(user)
    # csrf_token is needed by the SPA to make mutating calls
    resolved = service.resolve_session(request.cookies.get(config.cookie_name))
    body["csrf_token"] = resolved["csrf_token"] if resolved else None
    return body


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str


@auth_router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, request: Request):
    user = request.state.user
    error = service.change_password(user, payload.current_password, payload.new_password)
    if error:
        return JSONResponse(status_code=400, content={"detail": error, "code": "password_rejected"})

    # change_password revoked all sessions; issue a fresh one so the user stays
    # logged in with a clean session.
    fresh = service.store.get_user_by_id(user["id"])
    sess = service.create_session(fresh)
    body = _public_user(fresh)
    body["csrf_token"] = sess["csrf_token"]
    response = JSONResponse(content=body)
    _set_session_cookie(response, sess)
    return response


# --------------------------------------------------------------------------- #
# User management (ADMIN+; enforced in middleware)
# --------------------------------------------------------------------------- #

class CreateUserRequest(BaseModel):
    username: str
    role: str
    display_name: Optional[str] = None


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@users_router.get("")
async def list_users():
    return {"users": service.store.list_users()}


@users_router.post("")
async def create_user(payload: CreateUserRequest, request: Request):
    result, error = service.admin_create_user(
        request.state.user, payload.username, payload.role, payload.display_name
    )
    if error:
        return JSONResponse(status_code=400, content={"detail": error, "code": "create_failed"})
    return result  # includes one-time temp_password


@users_router.patch("/{user_id}")
async def update_user(user_id: str, payload: UpdateUserRequest, request: Request):
    result, error = service.admin_update_user(
        request.state.user, user_id, role=payload.role, is_active=payload.is_active
    )
    if error:
        return JSONResponse(status_code=400, content={"detail": error, "code": "update_failed"})
    return _public_user(result)


@users_router.post("/{user_id}/reset-password")
async def reset_password(user_id: str, request: Request):
    result, error = service.admin_reset_password(request.state.user, user_id)
    if error:
        return JSONResponse(status_code=404, content={"detail": error, "code": "reset_failed"})
    return result  # includes one-time temp_password


@users_router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request):
    result, error = service.admin_delete_user(request.state.user, user_id)
    if error:
        return JSONResponse(status_code=400, content={"detail": error, "code": "delete_failed"})
    return result
