# Global Dashboard

**Route:** `#/dashboard`
**File:** `frontend/src/views/Dashboard.js`
**Entry point:** Default view — loads automatically when the app starts (`main.js` redirects `/` → `#/dashboard`)

---

## Purpose

The Global Dashboard is the home screen of SRE Copilot. It gives an at-a-glance view of the entire infrastructure's health: how many alerts fired in the last 24 hours, how many active incidents exist by severity, the live CPU and memory utilization of every connected data source, and a real-time feed of pipeline events happening right now.

---

## Page Layout

The page uses a responsive 12-column grid (Tailwind `xl:grid-cols-12`):

- **Left column (9/12):** KPI bar on top, Fleet Telemetry Matrix below
- **Right column (3/12):** Live Activity Feed

On screens smaller than `xl` (1280px), both columns stack vertically.

---

## Section 1 — KPI Bar

**Location:** Top of the left column
**Layout:** 4 equal-width cards in a horizontal row (`md:grid-cols-4`)

Each card is a "pane" component with a hover gradient effect. The 4 KPIs are:

### KPI 1 — Alerts (Last 24h)
- **Label:** `ALERTS (LAST 24H)`
- **Icon:** Pulse/waveform SVG (primary blue)
- **Value:** `noiseStats.received_last_24h` — total alerts received by the system in the last 24 hours
- **Sub-text:** `X suppressed · Y processed` (from `noiseStats.dropped_last_24h` and `noiseStats.processed_last_24h`)
- **Data source:** `GET /api/v1/noise/stats`
- **Refresh:** Every 60 seconds via a `setInterval` that only runs while the dashboard view is active
- **No left border accent** (neutral card)

### KPI 2 — Active Critical
- **Label:** `ACTIVE CRITICAL`
- **Icon:** Pulsing red dot
- **Value:** Count of active (non-resolved) incidents with severity `critical` or `page`
- **Text color:** `text-red-400`
- **Sub-text:** `critical & page severity`
- **Left border:** `border-l-red-500/50`
- **Data source:** Computed from `state.incidents` in memory

### KPI 3 — Active Warning
- **Label:** `ACTIVE WARNING`
- **Icon:** Static yellow dot
- **Value:** Count of active incidents with severity `warning`
- **Text color:** `text-yellow-400`
- **Sub-text:** `warning severity`
- **Left border:** `border-l-yellow-500/50`
- **Data source:** Computed from `state.incidents` in memory

### KPI 4 — Active Info
- **Label:** `ACTIVE INFO`
- **Icon:** Static blue dot
- **Value:** Count of active incidents with any severity that is not `critical`, `page`, or `warning` (catches `info`, `none`, unknown values)
- **Text color:** `text-blue-400`
- **Sub-text:** `info & other severity`
- **Left border:** `border-l-blue-500/50`
- **Data source:** Computed from `state.incidents` in memory

**Live updates for KPIs 2–4:** The severity counts patch in-place via a state subscription that fires whenever `state.incidents` changes (driven by WebSocket events). No full page re-render is needed.

---

## Section 2 — Fleet Telemetry Matrix (Golden Signals)

**Location:** Below the KPI bar, left column
**Header label:** `Fleet Telemetry Matrix (Golden Signals)` with a green pulsing "Live" indicator

This section renders one card per registered infrastructure connector. Connectors come from `state.environments`, which is populated by `GET /api/v1/health/cluster` and refreshed every **5 seconds** by `main.js`.

### Per-Connector Card

Each card shows:

| Element | Detail |
|---|---|
| **Icon** | Server/stack SVG icon, green if `status === 'healthy'` or `'online'`, red otherwise |
| **Name** | Connector name (e.g., `local-01`, `k8s-production`) |
| **Status** | Raw status string below the name in monospace uppercase (e.g., `HEALTHY`, `OFFLINE`) |
| **CPU %** | Latest CPU utilization from the timeseries API |
| **Memory %** | Latest memory utilization from the timeseries API |

**CPU color thresholds:**
- `< 60%` → `text-primary-dark` (blue/teal)
- `60–79%` → `text-alert-orange`
- `≥ 80%` → `text-alert-red`

**Memory color thresholds:**
- `< 70%` → `text-purple-400`
- `70–84%` → `text-alert-orange`
- `≥ 85%` → `text-alert-red`

**Data source for CPU/Memory:** `GET /api/v1/health/timeseries/{provider_id}` — fetches up to 2 hours of time-series data, then reads the last value (`data.cpu[last][1]` and `data.memory[last][1]`). Updated via state subscription every time `updateHealth()` resolves (every 5 seconds).

**Offline connectors:** If `env.status === 'offline'`, both CPU and Memory display `N/A` without making a timeseries API call.

**Empty state:** If no connectors are registered, the section shows: `No infrastructure registered. Go to Settings to add connectors.`

---

## Section 3 — Live Activity Feed

**Location:** Right column (3/12 wide)
**Header label:** `Live Activity Feed` with terminal arrow icon

A scrollable monospace log panel showing real-time pipeline events. Each entry has the format:

```
[HH:MM:SS AM/PM]  <event message>
```

Entries are color-coded by event type:

| Event Type | Color | Message Format |
|---|---|---|
| New incident firing | `text-alert-orange` | `New incident firing: <alert_name> (<inc_id[:8]>)` |
| Incident resolved | `text-alert-green` | `Incident resolved: <alert_name> (<inc_id[:8]>)` |
| RCA complete | `text-primary-light` | `RCA complete for incident <inc_id[:8]>` |
| Runbook executed | `text-blue-400` | `Runbook executed for <inc_id[:8]>: <action>` |
| Pipeline event | `text-muted` | Raw message from WebSocket event |

**Data source:** WebSocket `ws://localhost:8000/api/v1/ws/alerts` — events are processed in `main.js:buildActivityEntry()` and prepended to `state.activityLog`. The log is capped at **30 entries** (oldest are dropped). The feed panel patches in-place via a state subscription without triggering a full dashboard re-render.

**Empty state:** When no events have arrived yet: `Waiting for events...` (italic, muted)

---

## Fixed Chrome — Sidebar and Header

These components are rendered on every page and are not part of the dashboard view itself.

### Sidebar (`frontend/src/components/Sidebar.js`)

- **Width:** 80px, icon-only (no labels)
- **Position:** Fixed left edge, full height
- **Logo:** Stack/layers icon at the top in a rounded tile
- **Navigation items (top to bottom):**

| Icon | Label (tooltip) | Route |
|---|---|---|
| 4-square grid | Global Dashboard | `#/dashboard` |
| Triangle warning | Active Incidents | `#/active` |
| Download arrow | Archive | `#/archive` |
| Wrench | Chaos Engine | `#/chaos` |
| Shield | Rules & Suppression | `#/rules` |
| Cube/package | Resource Inventory | `#/pods` |
| Gear | Connectors & Keys | `#/settings` |

- **Active state:** Solid primary-color background with white icon + shadow glow
- **Inactive state:** Muted icon, hover highlights with surface background
- **Note:** Both `active` (Active Incidents table) and `control` (Incident Control Room) views highlight the Active Incidents nav item

### Header (`frontend/src/components/Header.js`)

- **Height:** 72px, sticky top-0, glass-morphism blur (`backdrop-blur-xl`)
- **Left side:**
  - **Page title:** Dynamic — updates on every navigation (e.g., `Global Dashboard`, `Active Incidents`, `Post-Mortem Ledger`, etc.)
  - **WebSocket status dot:** Green with glow = connected; Red with glow = disconnected. Reflects `state.wsConnected`.
  - **Simulation Mode badge:** Pulsing orange `⚠️ Simulation Mode` pill — only visible when `state.isSimulationMode === true`
- **Right side:**
  - **"Fire Alert" button** — opens the Diagnostic Signal Center modal

### Diagnostic Signal Center Modal (from Header)

A centered modal overlay with three trigger options:

| Option | Action |
|---|---|
| **Kubernetes Cluster Probe** | Fires a `ConnectivityProbe_K8s` alert (info severity, namespace: `production`) to verify K8s diagnostic pipeline |
| **VM / Local Node Probe** | Fires a `ConnectivityProbe_VM` alert (info severity, instance: `local`) to verify VM/node telemetry routing |
| **Simulated Critical Incident** | Fires a `SIMULATED_INCIDENT: Database Connection Leak` alert (critical severity) to run a full end-to-end pipeline test (Diagnostics → AI RCA → Remediation) |

All three use `POST /api/v1/alerts/test` with a unique auto-generated fingerprint to prevent ID collisions.

---

## Data Flow Summary

```
App start
  └── fetchIncidents()          → GET /api/v1/incidents         → state.incidents
  └── updateHealth()            → GET /api/v1/health/cluster    → state.environments
  └── connectWebSocket()        → ws://localhost:8000/…/ws/alerts

Dashboard render
  └── fetchNoiseStats()         → GET /api/v1/noise/stats       → KPI 1 value
  └── KPI 2–4                   ← computed from state.incidents (no API call)
  └── Fleet cards               ← state.environments (from updateHealth)
  └── fetchTimeSeries(env.id)   → GET /api/v1/health/timeseries/{id} → CPU/Memory %

Live updates (while dashboard is active)
  └── setInterval(5s)           → updateHealth() → refreshes fleet cards
  └── setInterval(60s)          → fetchNoiseStats() → patches KPI 1
  └── subscribe(state)          → patches KPI 2–4 + activity feed + fleet cards
  └── WebSocket events          → state.activityLog → activity feed
```

---

## Corrections to Original Description

The user's description was **mostly correct** with these clarifications:

1. **KPI order** — The first KPI is total 24h alert volume (from the noise stats API), not severity-specific. KPIs 2–4 are active severity counts (Critical, Warning, Info), not raw 24h counts per severity.
2. **Active vs. 24h** — KPIs 2–4 count currently **active (non-resolved) incidents**, not all alerts received in 24 hours.
3. **Fleet section name** — The connected sources panel is titled "Fleet Telemetry Matrix (Golden Signals)", not just "connected sources". It includes a connector health status icon in addition to CPU/Memory.
4. **Activity feed cap** — The feed holds a maximum of 30 entries; older entries are dropped as new ones arrive.
