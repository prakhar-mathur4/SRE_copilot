"""
Auth business logic: bootstrap, authentication + lockout, session lifecycle,
password changes, and admin user management. Ties store + passwords + config
together. Returns plain dicts / (result, error_code) tuples — no FastAPI here.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from bot.auth import passwords, store
from bot.auth.config import config
from bot.auth.db import init_db
from bot.auth.roles import Role

logger = logging.getLogger("sre_copilot")


# --------------------------------------------------------------------------- #
# Time helpers (timezone-aware UTC; avoids the deprecated naive utcnow())
# --------------------------------------------------------------------------- #

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _parse(s: str) -> datetime:
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------------- #
# Audit
# --------------------------------------------------------------------------- #

def write_audit(action, actor=None, target=None, metadata=None):
    try:
        store.insert_audit(
            actor_user_id=(actor or {}).get("id") if actor else None,
            actor_username=(actor or {}).get("username") if actor else None,
            action=action,
            target=target,
            metadata=json.dumps(metadata) if metadata else None,
            now=_iso(_now()),
        )
    except Exception as e:  # auditing must never break the request path
        logger.error("Failed to write audit event %s: %s", action, e)


# --------------------------------------------------------------------------- #
# Bootstrap
# --------------------------------------------------------------------------- #

def bootstrap():
    """Create tables and, on a fresh install, the initial Owner admin with a
    generated one-time password printed once to the console."""
    init_db()
    if store.count_users() > 0:
        return

    username = config.bootstrap_username
    temp_password = passwords.generate_temp_password()
    now = _iso(_now())
    store.create_user(
        username=username,
        password_hash=passwords.hash_password(temp_password),
        role=Role.OWNER.value,
        display_name="Administrator",
        must_change=True,
        now=now,
    )
    write_audit("bootstrap_admin_created", target=username)

    banner = (
        "\n" + "=" * 64 + "\n"
        "  SRE Copilot — initial admin credentials (shown ONCE)\n"
        f"  username: {username}\n"
        f"  password: {temp_password}\n"
        "  You will be required to change this on first login.\n"
        + "=" * 64 + "\n"
    )
    logger.warning(banner)
    print(banner, flush=True)


# --------------------------------------------------------------------------- #
# Authentication + lockout
# --------------------------------------------------------------------------- #

def authenticate(username: str, password: str):
    """Return (user_dict, None) on success or (None, error_code) on failure.
    error_code ∈ {invalid_credentials, account_locked, account_disabled}."""
    user = store.get_user_by_username(username)
    # Run a hash verify even when the user is missing to blunt timing/enumeration.
    if not user:
        passwords.verify_password(password, passwords.hash_password("dummy"))
        write_audit("login_failed", target=username, metadata={"reason": "no_such_user"})
        return None, "invalid_credentials"

    if not user["is_active"]:
        write_audit("login_failed", actor=user, metadata={"reason": "disabled"})
        return None, "account_disabled"

    if user["locked_until"]:
        if _parse(user["locked_until"]) > _now():
            write_audit("login_failed", actor=user, metadata={"reason": "locked"})
            return None, "account_locked"

    if not passwords.verify_password(password, user["password_hash"]):
        failed = user["failed_login_count"] + 1
        locked_until = None
        if failed >= config.max_failed_logins:
            locked_until = _iso(_now() + timedelta(minutes=config.lockout_minutes))
        store.record_login_failure(user["id"], failed, locked_until, _iso(_now()))
        write_audit("login_failed", actor=user,
                    metadata={"reason": "bad_password", "failed_count": failed})
        return None, "account_locked" if locked_until else "invalid_credentials"

    store.record_login_success(user["id"], _iso(_now()))
    write_audit("login", actor=user)
    return store.get_user_by_id(user["id"]), None


# --------------------------------------------------------------------------- #
# Sessions
# --------------------------------------------------------------------------- #

def create_session(user):
    token = passwords.new_session_token()
    csrf = passwords.new_csrf_token()
    now = _now()
    expires = now + timedelta(hours=config.session_ttl_hours)
    store.create_session(passwords.hash_token(token), user["id"], csrf, _iso(now), _iso(expires))
    return {"token": token, "csrf_token": csrf, "max_age": config.session_ttl_hours * 3600}


def resolve_session(token: str):
    """Validate a raw session token; returns {user, csrf_token} or None.
    Slides the expiry forward on each successful resolution."""
    if not token:
        return None
    sid = passwords.hash_token(token)
    session = store.get_session(sid)
    if not session or session["revoked"]:
        return None
    if _parse(session["expires_at"]) <= _now():
        return None
    user = store.get_user_by_id(session["user_id"])
    if not user or not user["is_active"]:
        return None
    store.touch_session(sid, _iso(_now() + timedelta(hours=config.session_ttl_hours)))
    return {"user": user, "csrf_token": session["csrf_token"], "session_id": sid}


def logout(token: str):
    if token:
        store.revoke_session(passwords.hash_token(token))


# --------------------------------------------------------------------------- #
# Password change
# --------------------------------------------------------------------------- #

def _validate_password_strength(pw: str):
    if len(pw) < config.min_password_length:
        return f"Password must be at least {config.min_password_length} characters."
    if pw.isalpha() or pw.isdigit():
        return "Password must mix letters and numbers."
    return None


def change_password(user, current_password, new_password):
    """Returns None on success or an error message string."""
    # On a forced first-login change the user already authenticated with the
    # temp password this session, so current_password is optional then.
    if not user["must_change_password"]:
        if not current_password or not passwords.verify_password(current_password, user["password_hash"]):
            return "Current password is incorrect."

    err = _validate_password_strength(new_password)
    if err:
        return err

    store.set_password(user["id"], passwords.hash_password(new_password), False, _iso(_now()))
    store.revoke_user_sessions(user["id"])  # force re-login everywhere else
    write_audit("password_changed", actor=user)
    return None


# --------------------------------------------------------------------------- #
# Admin user management
# --------------------------------------------------------------------------- #

def admin_create_user(actor, username, role, display_name):
    """Returns (result_dict, None) or (None, error_message)."""
    if role not in [r.value for r in Role]:
        return None, f"Invalid role '{role}'."
    if store.get_user_by_username(username):
        return None, f"User '{username}' already exists."

    temp_password = passwords.generate_temp_password()
    uid = store.create_user(
        username=username,
        password_hash=passwords.hash_password(temp_password),
        role=role,
        display_name=display_name or username,
        must_change=True,
        now=_iso(_now()),
    )
    write_audit("user_created", actor=actor, target=username, metadata={"role": role})
    return {"id": uid, "username": username, "role": role, "temp_password": temp_password}, None


def admin_reset_password(actor, user_id):
    target = store.get_user_by_id(user_id)
    if not target:
        return None, "User not found."
    temp_password = passwords.generate_temp_password()
    store.set_password(user_id, passwords.hash_password(temp_password), True, _iso(_now()))
    store.revoke_user_sessions(user_id)
    write_audit("password_reset", actor=actor, target=target["username"])
    return {"id": user_id, "username": target["username"], "temp_password": temp_password}, None


def admin_update_user(actor, user_id, role=None, is_active=None):
    target = store.get_user_by_id(user_id)
    if not target:
        return None, "User not found."
    if target["role"] == Role.OWNER.value and (role not in (None, Role.OWNER.value) or is_active is False):
        return None, "The Owner account cannot be demoted or disabled."
    if role is not None and role not in [r.value for r in Role]:
        return None, f"Invalid role '{role}'."
    store.update_user(user_id, _iso(_now()), role=role, is_active=is_active)
    if is_active is False:
        store.revoke_user_sessions(user_id)
    write_audit("user_updated", actor=actor, target=target["username"],
                metadata={"role": role, "is_active": is_active})
    return store.get_user_by_id(user_id), None


def admin_delete_user(actor, user_id):
    target = store.get_user_by_id(user_id)
    if not target:
        return None, "User not found."
    if target["role"] == Role.OWNER.value:
        return None, "The Owner account cannot be deleted."
    if actor and actor["id"] == user_id:
        return None, "You cannot delete your own account."
    store.delete_user(user_id)
    write_audit("user_deleted", actor=actor, target=target["username"])
    return {"deleted": True}, None
