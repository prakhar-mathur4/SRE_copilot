"""
SSL certificate monitor — checks expiry and issuer for a saved list of domains.
Uses only stdlib (ssl, socket, asyncio) — no extra pip dependencies.
"""
import ssl
import socket
import json
import asyncio
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("sre_copilot")

DOMAINS_FILE = os.path.join(os.getcwd(), "ssl_domains.json")

# In-memory cache: "domain:port" → last check result
_cache: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def load_domains() -> list[dict]:
    """Read saved domains from ssl_domains.json."""
    if not os.path.exists(DOMAINS_FILE):
        return []
    try:
        with open(DOMAINS_FILE) as f:
            return json.load(f)
    except Exception:
        return []


def _save_domains(domains: list[dict]) -> None:
    with open(DOMAINS_FILE, "w") as f:
        json.dump(domains, f, indent=2)


def add_domain(domain: str, port: int = 443) -> list[dict]:
    """Append a domain (no duplicates). Returns updated list."""
    domain = domain.lower().strip()
    domains = load_domains()
    if not any(d["domain"] == domain and d.get("port", 443) == port for d in domains):
        domains.append({
            "domain": domain,
            "port": port,
            "added_at": datetime.now(timezone.utc).isoformat(),
        })
        _save_domains(domains)
    return domains


def remove_domain(domain: str, port: int = 443) -> list[dict]:
    """Remove a domain from the saved list. Returns updated list."""
    domain = domain.lower().strip()
    domains = load_domains()
    domains = [d for d in domains if not (d["domain"] == domain and d.get("port", 443) == port)]
    _save_domains(domains)
    _cache.pop(f"{domain}:{port}", None)
    return domains


# ---------------------------------------------------------------------------
# SSL check (sync — runs in thread pool)
# ---------------------------------------------------------------------------

def _check_ssl_sync(domain: str, port: int = 443) -> dict:
    """Connect to domain:port and inspect the TLS certificate."""
    cache_key = f"{domain}:{port}"
    now = datetime.now(timezone.utc)

    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, port), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()

        expiry_str = cert["notAfter"]
        expiry_dt = datetime.strptime(expiry_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days_remaining = (expiry_dt - now).days

        issuer_parts  = dict(x[0] for x in cert.get("issuer",  []))
        subject_parts = dict(x[0] for x in cert.get("subject", []))

        if days_remaining < 0:
            status = "expired"
        elif days_remaining <= 7:
            status = "critical"
        elif days_remaining <= 30:
            status = "warning"
        else:
            status = "valid"

        result = {
            "domain":        domain,
            "port":          port,
            "status":        status,
            "days_remaining": days_remaining,
            "expiry":        expiry_dt.isoformat(),
            "issuer":        issuer_parts.get("organizationName") or issuer_parts.get("commonName", "Unknown"),
            "subject_cn":    subject_parts.get("commonName", domain),
            "checked_at":    now.isoformat(),
            "error":         None,
        }

    except ssl.SSLCertVerificationError as e:
        result = _error_result(domain, port, now, f"Verification failed: {str(e)[:80]}")
    except socket.timeout:
        result = _error_result(domain, port, now, "Connection timed out")
    except socket.gaierror:
        result = _error_result(domain, port, now, "DNS lookup failed")
    except ConnectionRefusedError:
        result = _error_result(domain, port, now, f"Connection refused on port {port}")
    except Exception as e:
        result = _error_result(domain, port, now, str(e)[:120])

    _cache[cache_key] = result
    return result


def _error_result(domain: str, port: int, now: datetime, error: str) -> dict:
    return {
        "domain":         domain,
        "port":           port,
        "status":         "error",
        "days_remaining": None,
        "expiry":         None,
        "issuer":         None,
        "subject_cn":     None,
        "checked_at":     now.isoformat(),
        "error":          error,
    }


# ---------------------------------------------------------------------------
# Async API
# ---------------------------------------------------------------------------

async def check_domain(domain: str, port: int = 443) -> dict:
    """Async wrapper — runs sync SSL check in a thread so it doesn't block."""
    return await asyncio.to_thread(_check_ssl_sync, domain, port)


async def check_all_domains() -> list[dict]:
    """Check all saved domains in parallel using asyncio.gather."""
    domains = load_domains()
    if not domains:
        return []
    tasks = [check_domain(d["domain"], d.get("port", 443)) for d in domains]
    return list(await asyncio.gather(*tasks))


def get_cached_results() -> list[dict]:
    """
    Return last known results for all saved domains.
    Domains not yet checked are returned with status='unknown'.
    """
    domains = load_domains()
    results = []
    for d in domains:
        cache_key = f"{d['domain']}:{d.get('port', 443)}"
        cached = _cache.get(cache_key)
        if cached:
            results.append(cached)
        else:
            results.append({
                "domain":         d["domain"],
                "port":           d.get("port", 443),
                "status":         "unknown",
                "days_remaining": None,
                "expiry":         None,
                "issuer":         None,
                "subject_cn":     None,
                "checked_at":     None,
                "error":          None,
            })
    return results
