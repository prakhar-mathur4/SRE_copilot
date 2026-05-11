# Session Changelog

## 1. Prometheus Provider — Dynamic PromQL Query System

**File:** `bot/providers/prometheus_provider.py`

**What was there:** Fully stubbed. All methods returned hardcoded zeros and fake strings. No real HTTP calls were made to Prometheus.

**What was built:**

- `QueryTemplate` dataclass — holds a PromQL expression template and a human-readable label
- `ALERT_QUERY_MAP` — maps alert names to a list of `QueryTemplate` entries with `__label__`-style placeholders
- `_query(expr)` — executes a real instant PromQL query via `GET /api/v1/query` using `httpx`, returns the result list
- `_scalar(expr)` — convenience wrapper that returns the first float value from a query
- `_render_queries(alert_name, labels)` — looks up the correct templates for the incoming alert name, substitutes placeholder values from the alert labels, skips templates with unresolved placeholders
- `get_health_metrics()` — queries aggregated CPU, memory, and node count across all instances from Prometheus
- `collect_diagnostics()` — runs the matched queries for the specific alert and formats the output as a diagnostics block
- `list_resources()` — queries `up{}` to enumerate all monitored instances

**Alert types with dedicated query sets:**

| Alert Name | Metrics Queried |
|---|---|
| `HighCpuLoad` | CPU %, Load 1/5/15m, Process count |
| `HighMemoryUsage` | Memory %, Free/Total/Buffers/Cached MB |
| `DiskSpaceRunningOut` | Disk usage %, free GB, total GB, read/write rate |
| `HighDiskIO` | IO utilisation %, read/write MB/s, read/write IOPS |
| `HighNetworkTraffic` | RX/TX MB/s, RX/TX packet drops |
| `NodeDown` | Up status, load avg, memory % |
| `HighErrorRate` | HTTP 5xx rate, total rate, error % |
| `ServiceDown` | Instance up, job up |
| `SlowResponseTime` | p95/p99 latency, request rate |
| `_default` (fallback) | Up status, load avg, CPU %, memory %, disk % |

**Key behaviour:** If an alert name is not in the map, queries fall back to `_default`. If an alert label (e.g. `instance`) is missing, templates that require it are silently skipped rather than sending malformed PromQL.

---

## 2. Backend — Manual Resolve Endpoint

**File:** `bot/dashboard_router.py`

**New endpoint:** `POST /api/v1/incidents/{incident_id}/resolve`

Allows the UI to manually mark a firing incident as resolved without needing a real Alertmanager webhook. Reconstructs a synthetic `AlertData` with `status="resolved"` from the stored incident's labels and feeds it through the normal `process_alert_background` pipeline (Teams notification, timeline update, post-mortem report generation for high/critical).

---

## 3. Backend — Configurable Test Alert Status

**File:** `bot/dashboard_router.py`

Added `status: str = "firing"` field to `TestAlertRequest`. The alert creation now uses `payload.status` instead of the previously hardcoded `"firing"`. This allows the test endpoint to fire both `firing` and `resolved` synthetic alerts.

---

## 4. Frontend — `API_BASE` and `WS_URL` Read from Environment

**File:** `frontend/src/main.js`

**Before:**
```js
const API_BASE = 'http://localhost:8000/api/v1'
const WS_URL = 'ws://localhost:8000/api/v1/ws/alerts'
```

**After:**
```js
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api/v1'
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/alerts'
```

`WS_URL` is now derived from `API_BASE` — automatically uses `wss://` when the base URL is HTTPS. The `VITE_API_BASE_URL` env var was already set in `docker-compose.yml` but was never being read.

---

## 5. Frontend — Test Alert Modal

**File:** `frontend/src/main.js`

**Before:** The "Fire Test Alert" button always fired the same hardcoded `CrashLoopBackOff / production / critical` alert with fingerprint `test-001`.

**After:** Opens a modal form with the following configurable fields:
- Alert Name
- Severity (Critical / Warning / High / Info)
- Namespace / Instance
- Pod (optional)
- Description (optional)

Each submission generates a unique fingerprint (`test-${Date.now()}`), preventing the noise reducer from deduplicating successive test fires. The modal shows a success confirmation and auto-closes after 1.2 seconds.

---

## 6. Frontend — Progress Badges in Active Incidents Table

**File:** `frontend/src/main.js`

Added a **Progress** column to the active incidents table. Each row now shows three status badges:

| Badge | Colour when complete | Meaning |
|---|---|---|
| `D` | Green | Diagnostics collected |
| `RCA` | Cyan | AI root cause analysis complete |
| `RB` | Orange | Runbook executed |

Badges are grey when the step is still pending, letting the on-call engineer see at a glance how far the automated pipeline has progressed for each incident.

---

## 7. Frontend — Resolve Button on Active Incidents

**File:** `frontend/src/main.js`

Added an **Actions** column to the active incidents table. Each firing incident row has a **Resolve** button that calls `POST /api/v1/incidents/{incident_id}/resolve`. Row click-through to the Control Room is preserved — the button click is explicitly guarded so it does not also navigate.

---

## 8. Frontend — Archive Severity Filter is Now Dynamic

**File:** `frontend/src/main.js`

**Before:** The severity dropdown in the archive view had two hardcoded options: `Critical` and `Warning`.

**After:** Options are built at render time from the actual severities present in resolved incidents:
```js
const uniqueSeverities = [...new Set(allResolved.map(i => i.severity.toLowerCase()))].sort();
```

This correctly surfaces `high`, `page`, `info`, or any other value that Alertmanager labels may carry.

---

## 9. Frontend — Event Count Shown in Archive Cards

**File:** `frontend/src/main.js`

The `event_count` field returned by `GET /api/v1/incidents` was previously unused. It now appears in the archive card metadata line:

```
INC-ABC123 • production • 7 events • RESOLVED 03/05/2026
```
