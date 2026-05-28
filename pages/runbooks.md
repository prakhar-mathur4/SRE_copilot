# Runbooks

**Route:** `#/runbooks`
**File:** `frontend/src/views/Runbooks.js`
**Modal utility:** `frontend/src/utils/runbookModal.js`
**Backend client:** `bot/confluence_client.py`

---

## Purpose

The Runbooks view connects SRE Copilot to your Confluence knowledge base, giving on-call engineers instant access to documented procedures without leaving the dashboard. It also powers the **Runbook Fix** tab inside the Incident Control Room — when an alert fires, the system automatically finds the matching runbook and generates an AI-grounded fix suggestion based on its content.

---

## Page Layout

A single-column layout with a max width of `5xl`, centered in the main content area.

- **Header row:** Title, synced count label, search bar, Refresh button
- **Card grid:** 2 columns on `md`+ screens, 1 column on mobile
- **Empty state (no results):** Message with guidance to check Settings
- **Unconfigured state:** Friendly prompt with a direct link to Settings

---

## Section 1 — Header Row

**Left side:**
- Page title: **Runbooks**
- Subtext: `N runbooks synced from Confluence` — updates dynamically as you search

**Right side:**
- **Search bar** — live client-side filter; matches against title and excerpt as you type. Updates the count label to show `X of N runbooks`.
- **Refresh button** — re-fetches from Confluence without blanking the screen. Shows `Syncing…` during the request; on success replaces the card grid in-place; on failure silently restores the button.

---

## Section 2 — Runbook Cards

Each card displays:

| Field | Source |
|-------|--------|
| Title | Confluence page title |
| Author | Last editor's display name |
| Last modified date | `version.when` from Confluence API |
| Excerpt | Free from CQL search results — no extra API call |

**Interactions:**
- Clicking anywhere on the card opens the **Full Runbook Viewer** modal
- **Read Runbook** button (bottom-left) — opens the modal
- **Confluence** link (bottom-right) — opens the page directly in Confluence in a new tab

---

## Full Runbook Viewer (Modal)

Opens when clicking a card or the "Read Runbook" button. Also accessible from the **Runbook Fix** tab in the Incident Control Room via the "View Full Runbook" button.

**Features:**
- Renders the full Confluence page HTML inside the modal
- HTML is sanitized via **DOMPurify** before rendering — strips `<script>`, `<iframe>`, `<form>`, `<input>`, `<button>` tags and all inline event handlers (`onclick`, `onerror`, etc.)
- Styles Confluence-flavored content: headings, tables, ordered/unordered lists, code blocks, info/note/warning/tip macro panels
- **Copy buttons** appear on every `<pre>` / code block
- **Open in Confluence** link in the modal header
- Close via the × button or pressing `Escape`

---

## Sidebar Count Badge

Once runbooks are loaded, the Runbooks icon in the sidebar displays a small count badge showing the total number of synced runbooks. The badge updates on every refresh.

---

## Unconfigured State

If Confluence credentials have not been saved in Settings, the page shows an empty state with an icon, explanation text, and a **Configure in Settings →** button that navigates directly to the Settings page.

---

## Confluence Integration

### Supported deployment types
- **Atlassian Cloud** — API base: `{url}/wiki/rest/api`
- **Self-Hosted (On-prem)** — API base: `{url}/rest/api`

### How pages are fetched
Uses CQL `ancestor` search rather than a direct children endpoint. This means all pages at any depth under the configured root page are returned — nested subfolders are included automatically.

```
ancestor = {page_id} AND type = page ORDER BY title ASC
```

Pagination is handled automatically via `_links.next` — teams with more than 50 runbooks get complete results.

### Alert-name normalization (Control Room matching)
When searching for a runbook to match an active incident, the alert name is normalized into multiple CQL search terms to maximize match rate:

| Input | Terms tried |
|-------|-------------|
| `PodCrashLoopBackOff` | `PodCrashLoopBackOff`, `Pod Crash Loop Back Off`, `Pod Crash Loop Back` |
| `high_memory_usage` | `high_memory_usage`, `high memory usage` |
| `DiskSpaceCritical` | `DiskSpaceCritical`, `Disk Space Critical`, `Disk Space` |

All variations are combined into a single CQL `OR` expression per search type (title search first, then full-text fallback) — maximum 2 API calls per incident.

---

## Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/runbooks` | List all runbook pages under the root page |
| `GET` | `/api/v1/runbooks/suggest?incident_id=` | Search Confluence + generate LLM fix suggestion |
| `GET` | `/api/v1/runbooks/{page_id}` | Fetch full HTML content for a single page |
| `POST` | `/api/v1/runbooks/ping` | Test Confluence credentials before saving |

---

## Settings Configuration

Configured under **Connectors & Keys → Confluence Runbooks**.

| Field | Environment Variable | Description |
|-------|---------------------|-------------|
| Type | `CONFLUENCE_TYPE` | `cloud` or `self-hosted` |
| Confluence URL | `CONFLUENCE_URL` | Base URL of your Confluence instance |
| Email / Username | `CONFLUENCE_EMAIL` | Account email (Cloud) or username (On-prem) |
| API Token / Password | `CONFLUENCE_API_TOKEN` | Atlassian API token or password |
| Root Page URL | `CONFLUENCE_ROOT_PAGE_URL` | Full URL of the parent page — all child pages become runbooks |

**Test Connection** — validates credentials against the root page without saving. Returns the page title on success.

**Save Config** — writes values to `.env` and updates `os.environ` immediately (no restart needed).

---

## Key Files

| File | Role |
|------|------|
| `frontend/src/views/Runbooks.js` | Card grid, search, refresh, unconfigured state |
| `frontend/src/utils/runbookModal.js` | Shared modal — used by Runbooks view and Control Room |
| `frontend/src/components/Sidebar.js` | Count badge on the Runbooks nav icon |
| `bot/confluence_client.py` | All Confluence API calls: list, search, fetch page, ping |
| `bot/dashboard_router.py` | FastAPI endpoints that expose Confluence data to the frontend |
