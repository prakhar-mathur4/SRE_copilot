"""
HMAC verification for the Alertmanager webhook (the machine ingestion path).

Disabled by default (no WEBHOOK_HMAC_SECRET) so alert ingestion is never broken
on deploy — operators configure Alertmanager to send the signature first, then
set the secret to switch enforcement on. Use as a FastAPI route dependency.
"""
import hashlib
import hmac
import logging

from fastapi import HTTPException, Request

from bot.auth.config import config

logger = logging.getLogger("sre_copilot")

_SIGNATURE_HEADER = "X-Signature"
_warned_disabled = False


async def verify_webhook_hmac(request: Request):
    global _warned_disabled
    secret = config.webhook_hmac_secret

    if not secret:
        if not _warned_disabled:
            logger.warning(
                "Webhook HMAC verification is DISABLED (WEBHOOK_HMAC_SECRET unset). "
                "Set it once Alertmanager is configured to sign requests."
            )
            _warned_disabled = True
        return

    body = await request.body()
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    sent = request.headers.get(_SIGNATURE_HEADER, "")
    # Allow an optional "sha256=" prefix (common Alertmanager/webhook convention).
    if sent.startswith("sha256="):
        sent = sent[len("sha256="):]

    if not hmac.compare_digest(expected, sent):
        logger.warning("Rejected webhook with invalid HMAC signature.")
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")
