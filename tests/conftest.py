"""
Pytest fixtures for the auth/RBAC suite.

Hermetic: forces a throwaway SQLite auth DB via env BEFORE the app is imported,
and resets + reseeds it before every test. Uses FastAPI's TestClient WITHOUT the
lifespan context, so the Alertmanager poller / provider init never run — tests
exercise the real middleware + routes against a known set of seeded users.
"""
import os
import tempfile
from datetime import datetime, timezone

import pytest

# --- env must be set before bot.main (and its config) is imported ----------- #
_TMP = tempfile.mkdtemp(prefix="sre_auth_tests_")
os.environ["AUTH_DB_PATH"] = os.path.join(_TMP, "auth.db")
os.environ["COOKIE_SECURE"] = "false"
os.environ["CORS_ALLOWED_ORIGINS"] = "http://testserver"
os.environ["MAX_FAILED_LOGINS"] = "3"
os.environ["LOCKOUT_MINUTES"] = "5"
os.environ["MIN_PASSWORD_LENGTH"] = "10"
os.environ["WEBHOOK_HMAC_SECRET"] = ""  # webhook HMAC disabled in tests

from fastapi.testclient import TestClient  # noqa: E402

import bot.auth.db as authdb  # noqa: E402
from bot.auth import passwords, store  # noqa: E402
from bot.main import app  # noqa: E402

# username -> (password, role). All seeded with must_change_password = False.
SEED = {
    "owner1":  ("Password123", "owner"),
    "admin1":  ("Password123", "admin"),
    "maint1":  ("Password123", "maintainer"),
    "resp1":   ("Password123", "responder"),
    "view1":   ("Password123", "viewer"),
}
# A user that must change its password on first login.
FORCED = ("fresh1", "Temp123456", "responder")


def _iso_now():
    return datetime.now(timezone.utc).isoformat()


def _reset_and_seed():
    if authdb._conn is not None:
        authdb._conn.close()
        authdb._conn = None
    path = os.environ["AUTH_DB_PATH"]
    for ext in ("", "-wal", "-shm"):
        try:
            os.remove(path + ext)
        except FileNotFoundError:
            pass
    authdb.init_db()
    for username, (pw, role) in SEED.items():
        store.create_user(username, passwords.hash_password(pw), role, username, False, _iso_now())
    fu, fpw, frole = FORCED
    store.create_user(fu, passwords.hash_password(fpw), frole, fu, True, _iso_now())


@pytest.fixture(autouse=True)
def _db():
    _reset_and_seed()
    yield


@pytest.fixture
def client():
    """A fresh, unauthenticated TestClient (own cookie jar)."""
    return TestClient(app)


@pytest.fixture
def login():
    """Returns login(username, password) -> (client, csrf_token_or_None, response)."""
    def _login(username, password):
        c = TestClient(app)
        r = c.post("/api/v1/auth/login", json={"username": username, "password": password})
        csrf = r.json().get("csrf_token") if r.status_code == 200 else None
        return c, csrf, r
    return _login
