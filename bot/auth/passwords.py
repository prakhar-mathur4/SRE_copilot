"""
Password hashing via stdlib PBKDF2-HMAC-SHA256 (OWASP-recommended, available on
every Python build — unlike scrypt, which needs OpenSSL 1.1+ and is absent on
LibreSSL-linked interpreters).

Stored format:  pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
Verification is constant-time. See AUTH_RBAC_PLAN §5.
"""
import hashlib
import hmac
import os
import secrets

_ALGO = "pbkdf2_sha256"
_HASH = "sha256"
_ITERATIONS = 600_000   # OWASP 2023 guidance for PBKDF2-HMAC-SHA256
_DKLEN = 32


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac(_HASH, password.encode("utf-8"), salt, _ITERATIONS, dklen=_DKLEN)
    return f"{_ALGO}${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, hash_hex = stored.split("$")
        if algo != _ALGO:
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        dk = hashlib.pbkdf2_hmac(_HASH, password.encode("utf-8"), salt, int(iterations), dklen=len(expected))
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def generate_temp_password() -> str:
    """A strong, URL-safe one-time password for bootstrap/invites/resets."""
    return secrets.token_urlsafe(12)  # ~16 chars, ~96 bits entropy


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Session tokens are stored hashed; the raw token only lives in the cookie."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
