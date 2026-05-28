"""
Confluence knowledge base client.
Supports both Atlassian Cloud and self-hosted (on-prem) deployments.
"""
import os
import re
import base64
import logging
from typing import Optional
import httpx

logger = logging.getLogger("sre_copilot")


def _get_config() -> tuple[str, dict, str, str, str]:
    """Return (api_base, headers, root_page_url, base_url, conf_type)."""
    conf_type  = os.getenv("CONFLUENCE_TYPE", "cloud").lower()
    url        = os.getenv("CONFLUENCE_URL", "").rstrip("/")
    email      = os.getenv("CONFLUENCE_EMAIL", "")
    token      = os.getenv("CONFLUENCE_API_TOKEN", "")
    root_url   = os.getenv("CONFLUENCE_ROOT_PAGE_URL", "")

    if conf_type == "cloud":
        api_base = f"{url}/wiki/rest/api"
    else:
        api_base = f"{url}/rest/api"

    credentials = base64.b64encode(f"{email}:{token}".encode()).decode()
    headers = {
        "Authorization": f"Basic {credentials}",
        "Accept": "application/json",
    }
    return api_base, headers, root_url, url, conf_type


def is_configured() -> bool:
    return all([
        os.getenv("CONFLUENCE_URL"),
        os.getenv("CONFLUENCE_EMAIL"),
        os.getenv("CONFLUENCE_API_TOKEN"),
        os.getenv("CONFLUENCE_ROOT_PAGE_URL"),
    ])


def parse_page_id(url_or_id: str) -> Optional[str]:
    """Extract a numeric page ID from a Confluence URL or a raw ID string."""
    m = re.search(r'/pages/(\d+)', url_or_id)
    if m:
        return m.group(1)
    m = re.search(r'[?&]pageId=(\d+)', url_or_id)
    if m:
        return m.group(1)
    stripped = url_or_id.strip()
    if stripped.isdigit():
        return stripped
    return None


def _page_web_url(page: dict, base_url: str, conf_type: str) -> str:
    webui = page.get("_links", {}).get("webui", "")
    if not webui:
        return ""
    if conf_type == "cloud":
        return f"{base_url}/wiki{webui}"
    return f"{base_url}{webui}"


def _strip_html(html: str) -> str:
    return re.sub(r'<[^>]+>', ' ', html or '').strip()


def _normalize_alert_name(alert_name: str) -> list[str]:
    """
    Return deduplicated search term variations for an alert name.

    PodCrashLoopBackOff  → ["PodCrashLoopBackOff", "Pod Crash Loop Back Off"]
    high_memory_usage    → ["high_memory_usage", "high memory usage"]
    DiskSpaceCritical    → ["DiskSpaceCritical", "Disk Space Critical", "Disk Space"]
    """
    terms = [alert_name]

    # camelCase → words, snake/kebab → words
    spaced = re.sub(r'([a-z])([A-Z])', r'\1 \2', alert_name)
    spaced = spaced.replace('_', ' ').replace('-', ' ')
    spaced = re.sub(r'\s+', ' ', spaced).strip()
    if spaced.lower() != alert_name.lower():
        terms.append(spaced)

    # Strip common noise suffixes/prefixes so "DiskSpaceCritical" also tries "Disk Space"
    stripped = re.sub(
        r'\b(Alert|Warning|Critical|Error|Firing|High|Low|Threshold)\b',
        '', spaced, flags=re.IGNORECASE
    )
    stripped = re.sub(r'\s+', ' ', stripped).strip()
    if stripped and stripped.lower() not in {t.lower() for t in terms}:
        terms.append(stripped)

    return terms


async def ping_confluence(
    url: str = None,
    email: str = None,
    token: str = None,
    root_url: str = None,
    conf_type: str = None,
) -> dict:
    """
    Test Confluence connectivity. If credentials are provided, use them;
    otherwise fall back to environment variables.
    Returns {ok: bool, message: str}.
    """
    # Allow callers to pass live form values (test-before-save)
    url       = (url       or os.getenv("CONFLUENCE_URL",           "")).rstrip("/")
    email     = email      or os.getenv("CONFLUENCE_EMAIL",         "")
    token     = token      or os.getenv("CONFLUENCE_API_TOKEN",     "")
    root_url  = root_url   or os.getenv("CONFLUENCE_ROOT_PAGE_URL", "")
    conf_type = (conf_type or os.getenv("CONFLUENCE_TYPE", "cloud")).lower()

    if not all([url, email, token, root_url]):
        return {"ok": False, "message": "Missing credentials — fill in all four fields first"}

    api_base = f"{url}/wiki/rest/api" if conf_type == "cloud" else f"{url}/rest/api"
    credentials = base64.b64encode(f"{email}:{token}".encode()).decode()
    headers = {"Authorization": f"Basic {credentials}", "Accept": "application/json"}

    page_id = parse_page_id(root_url)
    if not page_id:
        return {"ok": False, "message": f"Cannot parse page ID from: {root_url}"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{api_base}/content/{page_id}",
                headers=headers,
                params={"expand": "version"},
            )
            resp.raise_for_status()
            page = resp.json()
        return {"ok": True, "message": f"Connected · root page: \"{page['title']}\""}
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 401:
            return {"ok": False, "message": "Authentication failed — check your email and API token"}
        if code == 403:
            return {"ok": False, "message": "Permission denied — account cannot access this page"}
        if code == 404:
            return {"ok": False, "message": "Root page not found — check the Root Page URL"}
        return {"ok": False, "message": f"Confluence returned HTTP {code}"}
    except httpx.ConnectError:
        return {"ok": False, "message": "Cannot reach Confluence — check the URL"}
    except Exception as e:
        return {"ok": False, "message": str(e)[:120]}


async def list_runbooks() -> list[dict]:
    """
    Return ALL runbook pages under the configured root page (any depth).
    Uses CQL `ancestor` search so nested subfolders are included.
    CQL search results include an `excerpt` field for free — no body fetch needed.
    Follows pagination so teams with >50 runbooks get complete results.
    """
    if not is_configured():
        return []

    api_base, headers, root_url, base_url, conf_type = _get_config()
    page_id = parse_page_id(root_url)
    if not page_id:
        logger.warning("Confluence: could not parse page ID from root URL: %s", root_url)
        return []

    # _links.next paths are relative to the Confluence base (before /rest/api)
    base_for_links = f"{base_url}/wiki" if conf_type == "cloud" else base_url

    try:
        all_pages = []
        next_url  = f"{api_base}/content/search"
        params    = {
            "cql":    f"ancestor = {page_id} AND type = page ORDER BY title ASC",
            "expand": "version",
            "limit":  50,
        }

        async with httpx.AsyncClient(timeout=20) as client:
            while next_url:
                resp = await client.get(next_url, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
                all_pages.extend(data.get("results", []))
                next_link = data.get("_links", {}).get("next")
                next_url  = f"{base_for_links}{next_link}" if next_link else None
                params    = {}  # subsequent URLs already carry their params

        return [
            {
                "id":            page["id"],
                "title":         page["title"],
                "last_modified": page.get("version", {}).get("when", ""),
                "author":        page.get("version", {}).get("by", {}).get("displayName", "Unknown"),
                "excerpt":       (page.get("excerpt") or "").strip(),
                "url":           _page_web_url(page, base_url, conf_type),
            }
            for page in all_pages
        ]

    except httpx.HTTPStatusError as e:
        logger.error("Confluence list_runbooks HTTP %s: %s", e.response.status_code, e.response.text[:200])
        return []
    except Exception as e:
        logger.error("Confluence list_runbooks failed: %s", e)
        return []


async def get_runbook_page(page_id: str) -> Optional[dict]:
    """Fetch full HTML content and metadata for a single runbook page."""
    if not is_configured():
        return None

    api_base, headers, _, base_url, conf_type = _get_config()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{api_base}/content/{page_id}",
                headers=headers,
                params={"expand": "body.view,version"},
            )
            resp.raise_for_status()
            page = resp.json()

        return {
            "id":            page["id"],
            "title":         page["title"],
            "html_content":  page.get("body", {}).get("view", {}).get("value", ""),
            "last_modified": page.get("version", {}).get("when", ""),
            "author":        page.get("version", {}).get("by", {}).get("displayName", "Unknown"),
            "url":           _page_web_url(page, base_url, conf_type),
        }
    except httpx.HTTPStatusError as e:
        logger.error("Confluence get_runbook_page HTTP %s: %s", e.response.status_code, e.response.text[:200])
        return None
    except Exception as e:
        logger.error("Confluence get_runbook_page failed: %s", e)
        return None


async def search_runbook(alert_name: str) -> Optional[dict]:
    """
    CQL-search for a runbook matching alert_name, scoped to the root page tree.
    Tries normalized variations of the alert name (camelCase→words, noise-word stripping)
    using CQL OR expressions to minimize round-trips while maximizing match rate.
    """
    if not is_configured():
        return None

    api_base, headers, root_url, base_url, conf_type = _get_config()
    page_id = parse_page_id(root_url)
    if not page_id:
        return None

    terms = _normalize_alert_name(alert_name)

    # Combine all term variations into a single CQL OR expression per search type
    def _cql_or(field: str) -> str:
        return ' OR '.join(f'{field} ~ "{t}"' for t in terms)

    # Title search first (more precise), then full-text search as fallback
    for cql in [
        f'ancestor = {page_id} AND ({_cql_or("title")}) AND type = page',
        f'ancestor = {page_id} AND ({_cql_or("text")}) AND type = page',
    ]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(
                    f"{api_base}/content/search",
                    headers=headers,
                    params={"cql": cql, "expand": "body.view", "limit": 1},
                )
                resp.raise_for_status()
                results = resp.json().get("results", [])

            if results:
                page      = results[0]
                body_html = page.get("body", {}).get("view", {}).get("value", "")
                return {
                    "id":      page["id"],
                    "title":   page["title"],
                    "content": _strip_html(body_html)[:4000],
                    "url":     _page_web_url(page, base_url, conf_type),
                }
        except Exception as e:
            logger.error("Confluence search_runbook failed (cql=%s): %s", cql[:80], e)

    return None
