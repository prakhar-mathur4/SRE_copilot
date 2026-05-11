# Active Incidents

**Route:** `#/active`
**File:** `frontend/src/views/ActiveIncidents.js`
**Nav label:** Active Incidents (triangle warning icon)

---

## Purpose

The Active Incidents page is a live table of every alert currently firing — meaning every incident that has not been resolved. It is the primary triage surface: engineers can scan severity, identify the source context, see how long an alert has been burning, check if it is a repeated firing, and drill into details without leaving the page via the Quick View modal. Clicking any row goes directly to the full Incident Control Room.

---

## Page Layout

The full viewport is occupied by a single `pane` component containing:

1. A **pane header** with the active count and a live status indicator
2. A scrollable **table** with 7 columns

**Pane header:**
- Left: `Firing Alerts N` where N is the current active count (bold)
- Right: Status indicator — `● LIVE` in red (pulsing dot) when incidents exist; `● HEALTHY` in green when the table is empty

---

## Table

**Data source:** `state.incidents` filtered to `status !== 'resolved'`
**Auto-refresh:** The table re-renders every 60 seconds from `main.js` to keep relative timestamps accurate. It also re-renders immediately on any state change when the view is active (driven by WebSocket events).

### Columns

| # | Header | Data | Notes |
|---|---|---|---|
| 1 | **ID** | First 8 characters of `incident_id` | Monospace, muted color. Full ID is available in Quick View. |
| 2 | **Severity** | `inc.severity` as a colored badge | Critical/page = red; Warning = yellow; Info/other = blue |
| 3 | **Alert Name** | `inc.alert_name` | Bold. Full name is displayed. |
| 4 | **Context** | `inc.namespace` | Shows the infrastructure context — the Kubernetes namespace, instance label, or origin scope the alert came from. Rendered as `key:value` pairs when the value contains a colon (e.g., `namespace:production`). Displays `unknown` in italic muted text when not set. |
| 5 | **Time** | Relative age since the alert fired | Format: `Xs ago`, `Xm ago`, `Xh Xm ago`, `Xd Xh ago`. Hovering shows the full local datetime in a tooltip. Uses `alert_starts_at` (original Alertmanager fire time) if available, falls back to `start_time` (pipeline arrival time) otherwise. |
| 6 | **Suppressed** | `inc.dedup_count` | Number of duplicate re-firings of this same alert that were silently dropped by the noise reduction system ("storm protection"). Shown as `Nx` in a yellow badge when > 0. Shows `—` when 0. Column tooltip: `Duplicate firings dropped by storm protection`. |
| 7 | **View** (actions) | "View" button | Opens the Quick View modal for this incident. The column header contains the Context filter dropdown (see below). |

### Row Interaction

- **Clicking anywhere on a row** navigates directly to the Incident Control Room for that incident (`view: 'control'`, `selectedIncidentId` set)
- **Clicking the "View" button** opens the Quick View modal without navigating away (event propagation is stopped so the row click does not also fire)

### Context Filter

Located in the **header of the last column** (not a separate filter bar above the table). It is a `<select>` dropdown.

- Default: `All Contexts`
- Options: dynamically populated from all unique `namespace` values across the current active incidents, sorted alphabetically
- Selecting a context filters the table to show only incidents from that namespace
- Selection persists in `state.activeIncidentsFilter` so it survives re-renders while the view is active

### Column Sorting

Three columns have clickable sort headers (arrow icon indicates direction):

| Column | Sort logic | Default |
|---|---|---|
| **Severity** | Weighted: `critical`/`page` = 4, `warning` = 3, `info` = 2. Other = 1 | — |
| **Alert Name** | Alphabetical (`localeCompare`) | — |
| **Time** | Chronological by fire timestamp | Descending (newest first) ← **default on page load** |

Clicking a sorted column header toggles ascending/descending. Clicking a different column sets it as the new sort column. Sort state is module-level and survives re-renders within the same session (it resets when you navigate away and come back).

### Empty State

When no active incidents exist, the table body shows a single full-width cell: `All Clear — No Active Incidents` with the pane header status changing to `● HEALTHY`.

---

## Quick View Modal

Triggered by the **"View"** button on any table row. Opens as a centered overlay with a backdrop blur.

**Close behaviors:**
- `×` button in the modal header
- Clicking outside the modal (on the backdrop)
- Pressing `Escape`

### Modal Header

| Element | Detail |
|---|---|
| Severity badge | Colored pill matching table badge colors (critical/page = red, warning = yellow, info = blue) |
| Incident ID | First 16 characters + ellipsis (`…`) |
| Alert name | Bold, large, truncated with ellipsis if too long |
| **Started** | Relative time since the alert first fired (same logic as Time column) |
| **Updated** | Relative time since `inc.last_updated` (last state change in the pipeline) |
| **Events** | Raw count of timeline events recorded for this incident (`inc.event_count`) |
| **Storm Protection** | `N suppressed` yellow badge — only visible when `inc.dedup_count > 0` |

### Pipeline Status Strip

A horizontal three-section bar directly below the modal header. Each section is equal-width with a vertical divider between them. Each step shows a colored dot + label:

| Step | Data field | Active color | Inactive color |
|---|---|---|---|
| **Diagnostics** | `inc.diagnostics_collected` | Green | Gray/muted |
| **RCA** | `inc.rca_completed` | Green | Gray/muted |
| **Runbook** | `inc.runbook_executed` | Green | Gray/muted |

This strip gives an immediate read on how far through the automated pipeline this incident has progressed.

### Modal Body (scrollable)

Two sections rendered as key-value tables:

**Labels (`N`):**
- All entries from `inc.labels` (raw Alertmanager/Prometheus labels)
- Keys in primary-blue monospace, 144px wide, truncated with title tooltip
- Values in normal text, break-all wrapping for long strings
- Common keys include: `alertname`, `severity`, `namespace`, `pod`, `instance`, `job`, `cluster`

**Annotations (`N`):**
- All entries from `inc.annotations`
- Same key-value rendering as labels
- Common keys include: `description`, `runbook`, `summary`

Both sections show `none` (italic muted) when the object is empty.

### Modal Footer

| Element | Detail |
|---|---|
| Hint text (left) | `Click the row to open the full Control Room view` |
| **Open Control Room →** (right) | Primary action button — closes the modal and navigates to `view: 'control'` with this incident selected |

---

## Corrections to Original Description

1. **"context" column name** — The code already uses "Context" as the column header. The underlying data is `inc.namespace`, which represents the infrastructure scope (Kubernetes namespace, local instance, etc.). "Context" is the correct name.

2. **"Suppressed" column** — This counts how many duplicate re-firings of the same alert were dropped by the noise reduction system, not how many times the alert has come up in total. The distinction: the original firing creates the incident; every subsequent identical firing increments `dedup_count` instead of creating a new incident.

3. **Quick View shows Labels and Annotations, not a raw payload** — The modal presents structured key-value sections (Labels + Annotations) from the alert data, not a raw JSON dump.

4. **Quick View "events" is a count, not a list** — The modal shows `inc.event_count` as a number. The full event timeline (individual log entries) is only available in the Incident Control Room.

5. **Table filter is on Context (namespace), not severity/name/time** — The dropdown filters by context. Severity, name, and time are **sort** controls (column header clicks), not filters.

---

## Data Flow

```
Page load / re-render
  └── state.incidents (already in memory, fetched by main.js)
      └── .filter(status !== 'resolved')      → active incidents list
      └── unique namespaces                   → context filter options
      └── sort by sortCol/sortDir             → table row order

Row render
  └── inc.incident_id.slice(0,8)             → ID column
  └── inc.severity                           → Severity badge
  └── inc.alert_name                         → Alert Name
  └── renderContext(inc.namespace)           → Context column
  └── relativeTime(resolveFireTime(inc))     → Time column
  └── inc.dedup_count                        → Suppressed column

Live updates
  └── WebSocket INCIDENT_UPDATE              → patchIncident() → state.incidents changes
  └── subscribe(state) in main.js            → debounced re-render (150ms) of this view
  └── setInterval(60s) in main.js            → full re-render to refresh relative timestamps

Quick View
  └── state.incidents.find(id)              → reads latest in-memory snapshot
  └── No API calls — all data is already in state
  └── "Open Control Room →"                 → updateState({ view: 'control', selectedIncidentId })
```
