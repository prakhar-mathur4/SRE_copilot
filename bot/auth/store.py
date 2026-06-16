"""
Data-access functions for users, sessions, and audit rows. Pure CRUD over
db.py — no business logic (that lives in service.py).
"""
import uuid

from bot.auth import db


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #

def create_user(username, password_hash, role, display_name, must_change, now):
    uid = str(uuid.uuid4())
    db.execute(
        """INSERT INTO users
           (id, username, display_name, password_hash, role, must_change_password,
            is_active, failed_login_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)""",
        (uid, username, display_name, password_hash, role,
         1 if must_change else 0, now, now),
    )
    return uid


def get_user_by_username(username):
    return db.row_to_dict(db.query_one("SELECT * FROM users WHERE username = ?", (username,)))


def get_user_by_id(user_id):
    return db.row_to_dict(db.query_one("SELECT * FROM users WHERE id = ?", (user_id,)))


def list_users():
    rows = db.query_all(
        """SELECT id, username, display_name, role, must_change_password,
                  is_active, last_login_at, created_at
           FROM users ORDER BY created_at ASC"""
    )
    return [db.row_to_dict(r) for r in rows]


def count_users():
    return db.query_one("SELECT COUNT(*) AS c FROM users")["c"]


def set_password(user_id, password_hash, must_change, now):
    db.execute(
        """UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ?
           WHERE id = ?""",
        (password_hash, 1 if must_change else 0, now, user_id),
    )


def update_user(user_id, now, role=None, is_active=None, display_name=None):
    sets, params = ["updated_at = ?"], [now]
    if role is not None:
        sets.append("role = ?"); params.append(role)
    if is_active is not None:
        sets.append("is_active = ?"); params.append(1 if is_active else 0)
    if display_name is not None:
        sets.append("display_name = ?"); params.append(display_name)
    params.append(user_id)
    db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", params)


def record_login_success(user_id, now):
    db.execute(
        """UPDATE users SET failed_login_count = 0, locked_until = NULL,
           last_login_at = ?, updated_at = ? WHERE id = ?""",
        (now, now, user_id),
    )


def record_login_failure(user_id, failed_count, locked_until, now):
    db.execute(
        """UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ?
           WHERE id = ?""",
        (failed_count, locked_until, now, user_id),
    )


def delete_user(user_id):
    db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))


# --------------------------------------------------------------------------- #
# Sessions
# --------------------------------------------------------------------------- #

def create_session(session_id, user_id, csrf_token, created_at, expires_at):
    db.execute(
        """INSERT INTO sessions (id, user_id, csrf_token, created_at, expires_at, revoked)
           VALUES (?, ?, ?, ?, ?, 0)""",
        (session_id, user_id, csrf_token, created_at, expires_at),
    )


def get_session(session_id):
    return db.row_to_dict(db.query_one("SELECT * FROM sessions WHERE id = ?", (session_id,)))


def touch_session(session_id, new_expires_at):
    db.execute("UPDATE sessions SET expires_at = ? WHERE id = ?", (new_expires_at, session_id))


def revoke_session(session_id):
    db.execute("UPDATE sessions SET revoked = 1 WHERE id = ?", (session_id,))


def revoke_user_sessions(user_id):
    db.execute("UPDATE sessions SET revoked = 1 WHERE user_id = ?", (user_id,))


def set_step_up(session_id, until):
    db.execute("UPDATE sessions SET stepped_up_until = ? WHERE id = ?", (until, session_id))


# --------------------------------------------------------------------------- #
# Audit
# --------------------------------------------------------------------------- #

def insert_audit(actor_user_id, actor_username, action, target, metadata, now):
    db.execute(
        """INSERT INTO audit_log
           (id, actor_user_id, actor_username, action, target, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (str(uuid.uuid4()), actor_user_id, actor_username, action, target, metadata, now),
    )
