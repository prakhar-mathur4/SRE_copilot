"""
Auth configuration — all values are environment-driven with safe local-dev
defaults. See AUTH_RBAC_PLAN.md §12 for the locked decisions behind these.
"""
import os


class AuthConfig:
    @property
    def db_path(self) -> str:
        # Self-contained SQLite store; lives at repo root by default (cwd is
        # the repo root under start.sh). Override with AUTH_DB_PATH.
        return os.getenv("AUTH_DB_PATH") or os.path.join(os.getcwd(), "auth.db")

    @property
    def bootstrap_username(self) -> str:
        return os.getenv("BOOTSTRAP_ADMIN_USERNAME", "admin")

    @property
    def cookie_name(self) -> str:
        return os.getenv("SESSION_COOKIE_NAME", "sre_session")

    @property
    def cookie_secure(self) -> bool:
        # Default false so cookies work over http://localhost in dev.
        # MUST be set true in any TLS/production deployment.
        return os.getenv("COOKIE_SECURE", "false").lower() == "true"

    @property
    def session_ttl_hours(self) -> int:
        return int(os.getenv("SESSION_TTL_HOURS", "8"))

    @property
    def cors_origins(self) -> list:
        raw = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def webhook_hmac_secret(self) -> str:
        # Empty => HMAC verification disabled (log-only). Set to enforce.
        return os.getenv("WEBHOOK_HMAC_SECRET", "")

    @property
    def max_failed_logins(self) -> int:
        return int(os.getenv("MAX_FAILED_LOGINS", "5"))

    @property
    def lockout_minutes(self) -> int:
        return int(os.getenv("LOCKOUT_MINUTES", "5"))

    @property
    def min_password_length(self) -> int:
        return int(os.getenv("MIN_PASSWORD_LENGTH", "10"))

    @property
    def step_up_ttl_minutes(self) -> int:
        # How long a password re-prompt keeps a session "stepped up" for
        # destructive operations.
        return int(os.getenv("STEP_UP_TTL_MINUTES", "5"))


config = AuthConfig()
