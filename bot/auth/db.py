"""
Thin SQLite layer for the auth store. Single shared connection guarded by a
reentrant lock — sufficient for the low volume of auth/session/audit writes.

This sits behind the store module so a future Postgres migration (AUTH_RBAC_PLAN
Phase 1) only has to replace this file's helpers, not the callers.
"""
import sqlite3
import threading

from bot.auth.config import config

_conn = None
_lock = threading.RLock()


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    username             TEXT UNIQUE NOT NULL,
    display_name         TEXT,
    password_hash        TEXT NOT NULL,
    role                 TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    is_active            INTEGER NOT NULL DEFAULT 1,
    failed_login_count   INTEGER NOT NULL DEFAULT 0,
    locked_until         TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    last_login_at        TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,   -- sha256(raw session token)
    user_id     TEXT NOT NULL,
    csrf_token  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    revoked     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
    id             TEXT PRIMARY KEY,
    actor_user_id  TEXT,
    actor_username TEXT,
    action         TEXT NOT NULL,
    target         TEXT,
    metadata       TEXT,
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
"""


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(config.db_path, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
    return _conn


def init_db() -> None:
    with _lock:
        conn = get_conn()
        conn.executescript(SCHEMA)
        conn.commit()


def query_one(sql: str, params=()):
    with _lock:
        return get_conn().execute(sql, params).fetchone()


def query_all(sql: str, params=()):
    with _lock:
        return get_conn().execute(sql, params).fetchall()


def execute(sql: str, params=()):
    with _lock:
        conn = get_conn()
        cur = conn.execute(sql, params)
        conn.commit()
        return cur


def row_to_dict(row):
    return dict(row) if row is not None else None
