# SSL Monitor

**Route:** `#/ssl`
**File:** `frontend/src/views/SSL.js`
**Backend checker:** `bot/ssl_checker.py`
**Domain list:** `ssl_domains.json` (gitignored)
**Example:** `ssl_domains.example.json`

---

## Purpose

The SSL Monitor gives the SRE team a single pane to track TLS certificate expiry across all production, staging, and internal domains. It runs parallel async checks against live servers, caches results in-memory, and persists the domain list to disk so it survives backend restarts.

---

## Page Layout

A single-column layout with a max width of `5xl`, centered in the main content area.

- **Header row:** Title, domain count, last-checked timestamp, summary badges, action buttons
- **Table:** Compact, sortable, one row per domain
- **Empty state:** Prompt to add the first domain

---

## Section 1 — Header Row

**Left side:**
- Page title: **SSL Monitor**
- Subtext: `N domains · Checked X ago`
- **Summary badges** — appear only for statuses that have at least one domain: Valid, Expiring, Critical, Expired, Error, Pending

**Right side (buttons, left to right):**
- **Copy Alert** — visible only when one or more domains are `critical` or `expired`. Copies a formatted alert message to the clipboard (see below).
- **Add** — opens the bulk-add modal
- **Refresh** — triggers a fresh SSL check against all domains and re-renders the table

---

## Section 2 — Domain Table

Columns:

| Column | Description |
|--------|-------------|
| `#` | Row index |
| Domain | Hostname and port (port shown only when not 443). Error detail shown in red below the domain name. |
| Status | Color-coded badge: Valid / Expiring / Critical / Expired / Error / Pending |
| Days Left | Days until expiry; negative values shown as `Nd overdue` |
| Expires | Human-readable expiry date |
| Issuer | Certificate issuer CN |
| Delete | Trash icon — always visible at low opacity, turns red on hover |

**Sortable columns:** Status, Days Left, Expires. Click a header to sort ascending; click again to reverse. Sort state persists across Refresh calls within the session.

**Status sort order** (most urgent first): Expired → Critical → Warning → Error → Unknown → Valid

---

## Status Levels

| Status | Condition | Color |
|--------|-----------|-------|
| `valid` | More than 30 days remaining | Green |
| `warning` | 7 – 30 days remaining | Orange |
| `critical` | Less than 7 days remaining | Red |
| `expired` | Certificate has expired | Red |
| `error` | Connection failed or cert unreadable | Grey |
| `unknown` | Not checked yet | Grey |

---

## Copy Alert Button

Appears in the header when at least one domain is `critical` or `expired`.

Clicking it copies a plain-text message to the clipboard in this format:

```
🔴 SSL Alert — 2 domains need attention
Checked: May 29, 2026, 10:45 PM

• newsletter.iqm.com  [EXPIRED] — 3d overdue  (expires May 26, 2026)
• api.iqm.com  [CRITICAL] — 4d left  (expires Jun 2, 2026)
```

The button briefly shows **✓ Copied!** for 2 seconds to confirm the action. The message is ready to paste into Slack, Teams, email, or any incident communication channel.

---

## Add Domains Modal

Opened via the **Add** button. Supports bulk entry — one domain per line.

- Accepts `domain` or `domain:port` format
- Lines can be comma-separated or newline-separated
- Domains are normalized to lowercase before saving
- After adding, all new domains are immediately checked and the table refreshes

---

## Auto-Check on First Visit

If the domain list is loaded but every domain shows `Pending` (no check has run yet), the view automatically triggers a full refresh in the background so results appear without requiring a manual click.

---

## Backend — How SSL Checks Work

The checker (`bot/ssl_checker.py`) uses only Python stdlib — no additional pip dependencies.

1. `load_domains()` reads `ssl_domains.json` from the working directory
2. For each domain, `asyncio.to_thread()` wraps the blocking `ssl.wrap_socket()` call so it runs off the event loop
3. All domains are checked in parallel via `asyncio.gather()`
4. Results are written into an in-memory cache (`_cache`) keyed by `"domain:port"`
5. `get_cached_results()` merges the cache with the persisted domain list — domains not yet checked are returned with `status: unknown`

Typical check time for 50+ domains: ~8–12 seconds (network-bound).

---

## Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/ssl/domains` | Return all domains with cached SSL status |
| `POST` | `/api/v1/ssl/domains` | Add a domain to the monitored list |
| `DELETE` | `/api/v1/ssl/domains/{domain:path}` | Remove a domain (`:path` handles slashes in domain strings) |
| `POST` | `/api/v1/ssl/check` | Run a fresh parallel check across all domains |
| `GET` | `/api/v1/ssl/check/{domain}` | Check a single domain on demand |

---

## Domain Persistence

The domain list is stored in `ssl_domains.json` at the project root. This file is gitignored to avoid leaking internal hostnames. A sanitized example (`ssl_domains.example.json`) is checked into the repo for new contributors.

```json
[
  { "domain": "example.com", "port": 443, "added_at": "2026-05-29T10:00:00+00:00" },
  { "domain": "internal.svc.company.com", "port": 8443, "added_at": "2026-05-29T10:00:00+00:00" }
]
```

To get started, copy the example and fill in your domains:

```bash
cp ssl_domains.example.json ssl_domains.json
```

---

## Known Error Cases

| Error | Cause | Fix |
|-------|-------|-----|
| `[SSL: CERTIFICATE_VERIFY_FAILED]` | Expired or self-signed cert | Renew the certificate |
| `certificate verify failed: unable to get local issuer certificate` | Incomplete chain (missing intermediates) | Reconfigure the server to send the full chain |
| `[Errno 8] nodename nor servname provided` | DNS lookup failed — domain does not resolve | Verify DNS records or remove the domain |
| Domain with URL path (e.g. `domain.com/path`) | Path segment treated as part of hostname | Add only the hostname (`domain.com`), not a full URL |

---

## Key Files

| File | Role |
|------|------|
| `frontend/src/views/SSL.js` | Full UI — table, sorting, add modal, copy alert, delete |
| `bot/ssl_checker.py` | Async SSL checker, in-memory cache, domain persistence |
| `bot/dashboard_router.py` | FastAPI endpoints that expose SSL data to the frontend |
| `ssl_domains.json` | Live domain list (gitignored) |
| `ssl_domains.example.json` | Sanitized example for repo cloners |
