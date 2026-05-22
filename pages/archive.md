# Post-Mortem Ledger (Archive)

**Route:** `#/archive`
**File:** `frontend/src/views/Archive.js`
**Nav label:** Post-Mortem Ledger (download / archive icon)

---

## Purpose

The Archive is the permanent record of every incident that has been resolved. It is the main surface for post-incident analysis: engineers can search and filter past incidents, review AI-generated post-mortem reports, compare durations across different severity levels, and delete stale records from memory. Unlike the Active Incidents table (which auto-refreshes from WebSocket events), the Archive renders from the locally-cached `state.incidents` array filtered to `status === 'resolved'`.

---

## Page Layout

The full viewport is a single flex column containing one `pane` component:

```
┌──────────────────────────────────────────────────────────────────┐
│  Pane Header: "Resolved Incidents N" [Clear Filters ✕]           │
├──────────────────────────────────────────────────────────────────┤
│  Filter Bar: [Search input] [Severity ▾] [Sort ▾]               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  CRITICAL  Disk Space Critical                 Report VIEW→🗑 │
│  │            INC-ED7DCEF8 • instance:server-01 • 2026-05-21  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  WARNING   PodCrashLooping                   Report VIEW→🗑 │
│  │            INC-9DD13B61 • namespace:prod • 2026-05-20      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  (empty state when no results)                                   │
└──────────────────────────────────────────────────────────────────┘
```

On screens narrower than `sm` (640px), the "Report" / "No Report" badge is hidden (`hidden sm:inline`) to save space.

---

## Pane Header

**Left:** `Resolved Incidents N` where N is the count badge.

The count display adapts based on whether filters are active:
- **No filters active:** Just the count number in primary-blue bold.
- **Filters active:** `X of Y` — the filtered count in primary-blue + muted `of {total}` so the engineer always sees how many records are hidden by their filters.

**Right:** A `Clear Filters ✕` button — only rendered when `filters.search` is non-empty or `filters.severity !== 'all'`. Clicking it resets search and severity to defaults while preserving the current sort order.

---

## Filter Bar

Three controls, laid out as a flex row that wraps on narrow screens.

### Search Input

- **Placeholder:** `Search by name, ID, or context...`
- **Matches against:** `alert_name`, `incident_id`, and `context` (all lowercase)
- **Behaviour:** Updates on every keystroke (`oninput`). Immediately re-renders the list. The search term is persisted in `state.archiveFilters.search` so it survives navigating away and back.
- **Focus restore:** If a search was active when the view last rendered, focus is restored to the input and the cursor placed at the end of the existing value.

### Severity Filter

A `<select>` dropdown. Options:

| Value | Label |
|---|---|
| `all` | All Severities (default) |
| `critical` | Critical |
| `page` | Page |
| `warning` | Warning |
| `info` | Info |
| `none` | None |

Comparison is case-insensitive. Selection is persisted in `state.archiveFilters.severity`.

### Sort Order

A `<select>` dropdown. Options (in display order):

| Value | Label | Sort logic |
|---|---|---|
| `date_desc` | Newest First (default) | `last_updated` descending |
| `date_asc` | Oldest First | `last_updated` ascending |
| `sev_desc` | Severity ↓ | Severity rank ascending (Critical = 0, Page = 1, Warning = 2, Info = 3, None = 4), ties broken by `last_updated` descending |
| `dur_desc` | Duration ↓ | `last_updated − start_time` descending (longest incident first) |

Sort is applied after all other filters. Selection is persisted in `state.archiveFilters.sortBy`.

---

## Incident Cards

Each resolved incident renders as a card. Cards are listed in a `flex flex-col gap-3` column. Each card is a full-width `div.archive-card`.

### Card Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [SEV]  Alert Name                       [Badge]  VIEW →  [🗑]  │
│         INC-XXXXXXXX  •  context  •  date  •  ⏱ duration        │
└─────────────────────────────────────────────────────────────────┘
```

### Card Elements

| Element | Source | Notes |
|---|---|---|
| **Severity badge** | `inc.severity` | Red (`badge-sev1`) for critical/page; Yellow (`badge-sev2`) for warning; Blue (`badge-sev3`) for everything else |
| **Alert name** | `inc.alert_name` | Bold, truncated with `truncate` CSS if too long |
| **Incident ID** | `inc.incident_id.slice(0, 12)` | Monospace, muted, uppercase |
| **Context** | `inc.context` | Rendered by `renderContext()` — see below |
| **Date** | `inc.last_updated` | Formatted as `YYYY-MM-DD` via `toLocaleDateString('en-CA')` |
| **Duration** | `last_updated − start_time` | Formatted as `Xm Xs`, `Xs`, or `< 1s`. Duration is the full lifetime of the incident from pipeline arrival to resolution. |
| **Report badge** | `REPORT_SEVERITIES.has(severity)` | Green "Report" badge for critical, page, warning, high — matching the severities the backend generates post-mortem reports for. All others show a dim "No Report" badge. |
| **VIEW → button** | Click | Opens the post-mortem report modal for this incident |
| **Trash icon button** | Click | Initiates the delete flow for this incident |

### Context Rendering (`renderContext`)

The `context` field from the backend encodes the most relevant label for the alert as a `key:value` string (e.g., `namespace:prod`, `instance:server-01`, `host:my-host`).

`renderContext()` splits on the first `:` and renders the key as a dim uppercase label and the value as the main text:

```
namespace:prod  →  NAMESPACE: prod
instance:server-01  →  INSTANCE: server-01
unknown  →  unknown  (italic, 40% opacity)
```

If there is no `:` in the string, the value is rendered as-is with no key prefix.

### Card Visual States

| State | Appearance |
|---|---|
| Default | Dark surface card (`bg-surface-hover-dark`), dim border |
| Hovered | Border brightens to primary-blue, card shifts 1px right (`hover:translate-x-1`), soft shadow appears |
| Hovered (delete button) | Delete button border turns red, background becomes `alert-red/10`, icon turns red, opacity rises to 100% |

Whole-card click opens the report modal **unless** the click target is the trash icon button or any of its children.

---

## Post-Mortem Report Modal

Opened by clicking any incident card, the "VIEW →" button, or programmatically by `showReportModal(incidentId)`.

### Modal Structure

A full-screen glass overlay (`fixed inset-0 z-50`), containing a `pane` centered at `max-w-5xl`.

```
┌─────────────────────────────────────────────────────────────────┐
│  [SEV]  Alert Name           date · ⏱ duration  [Control Room→] [✕] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [Report content renders here — Markdown prose]                 │
│                                                                  │
│   [No-report placeholder if no report exists]                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Control Room →]  (mobile only, footer)              [Close]   │
└─────────────────────────────────────────────────────────────────┘
```

### Modal Header

| Element | Source | Notes |
|---|---|---|
| **Severity badge** | `inc.severity` from local state | Uses same `badge-sev1/2/3` system as the card. Shown only when the incident is found in local state. |
| **Alert name** | `inc.alert_name` | Truncated if too long |
| **Date + duration** | `last_updated` + duration | Formatted same as the card. Hidden on narrow screens (`hidden md:inline`). |
| **Control Room →** | Button | Closes the modal, sets `view: 'control'` and `selectedIncidentId`, navigating to the Incident Control Room for this incident. Hidden on narrow screens (footer button shown instead). |
| **✕ close** | Button | Closes the modal |

### Closing the Modal

Three ways to close:
1. Click the ✕ button in the header
2. Click the "Close" button in the footer
3. Press `Escape`
4. Click the backdrop (the glass overlay area outside the modal panel)

The `Escape` listener is attached to `document` when the modal opens and removed when it closes.

### Report Content Area

The content area makes a fresh API call on every modal open:

**API call:** `GET /api/v1/incidents/{incidentId}`

While loading, an animated skeleton placeholder is shown (3 short bars + 1 large bar).

**States after load:**

| Condition | What is shown |
|---|---|
| `data.report` is set | Report rendered as full Markdown via `marked` library — headings, prose, code blocks, lists |
| `data.report` is null/empty | "No Post-Mortem Report" placeholder: dashed border, document icon, explanation that reports are only generated for resolved Critical, Page, and Warning incidents |
| Network/HTTP error | "Unable to Load Report" placeholder: red alert icon, error message |

Reports are generated by the backend's `timeline_manager.generate_report(incident_id)` for incidents with severity in `['high', 'critical', 'page', 'warning']` that are resolved. The report is cached on the `IncidentState` object after first generation.

---

## Delete Incident Flow

The trash icon button on each card triggers a permanent-delete flow.

### Steps

1. **User clicks** the trash icon on a card. Click is stopped from propagating to the card (no accidental modal open).

2. **Confirm dialog** (browser-native `confirm()`):
   ```
   Delete "Alert Name"?
   
   This removes the incident from memory and cannot be undone.
   ```
   The dialog uses the `alert_name` from `state.incidents`. If the incident is somehow not found in local state, it falls back to the `incident_id`.

3. **If user cancels:** Nothing happens. The button remains interactive.

4. **If user confirms:**
   - The button is immediately disabled and its icon replaced with a spinning progress indicator.
   - `DELETE /api/v1/incidents/{incident_id}` is called.

5. **On success (`res.ok`):**
   - Local state is updated: the incident is removed from `state.incidents`, and `incidentVersion` is incremented (triggering the state subscriber).
   - `renderArchiveView(container)` is called directly to re-render the list without waiting for the subscriber cycle.

6. **On failure (`!res.ok` or network error):**
   - The button is re-enabled and the trash icon is restored.
   - A browser `alert()` shows: `Failed to delete: {error message}`.

### Backend Constraints

The `DELETE /api/v1/incidents/{incident_id}` endpoint enforces:
- **404** if the incident does not exist in memory.
- **400** if the incident status is not `resolved` — only resolved incidents can be deleted.

On successful deletion, the backend:
1. Removes the incident from `timeline_manager.incidents`.
2. Broadcasts `{ type: "INCIDENT_DELETED", incident_id }` to all connected WebSocket clients.

### WebSocket Sync

`main.js` handles the `INCIDENT_DELETED` WebSocket event:
```javascript
case 'INCIDENT_DELETED': {
    const filtered = state.incidents.filter(i => i.incident_id !== data.incident_id);
    updateState({ incidents: filtered, incidentVersion: state.incidentVersion + 1 });
    break;
}
```
This means if one browser tab deletes an incident, all other open tabs will automatically remove it from their local state and re-render the archive if that view is active.

---

## State Management

### `state.archiveFilters`

```javascript
archiveFilters: {
    search:   '',        // freetext filter string
    severity: 'all',     // selected severity filter value
    sortBy:   'date_desc' // selected sort option value
}
```

All three values are persisted in `state` so the filter/sort configuration survives navigation away and back to the archive. State updates use the silent flag (`updateState({…}, true)`) to suppress the global subscriber loop — the view re-renders itself directly after every filter change.

### Rendering Trigger

The archive view is rendered by `renderView('archive')` in `main.js`, called:
- On navigation to `#/archive`
- Manually by the view itself after filter changes or a successful delete

The archive does **not** subscribe to `state.incidentVersion` changes. If a firing incident resolves while the archive is open, the new card will not appear until the user navigates away and back.

---

## Data Flow

```
Navigation to #/archive
  └── renderArchiveView(container) called from main.js renderView()
        └── reads state.incidents (filtered to status === 'resolved')
        └── applies search / severity / sort from state.archiveFilters
        └── renders pane header, filter bar, and card list

Filter / sort change
  └── updateState({ archiveFilters: {...} }, true)  [silent — no subscriber loop]
  └── renderArchiveView(container)  [direct re-render]

Card click / VIEW → button
  └── showReportModal(incidentId)
        └── GET /api/v1/incidents/{incidentId}
        └── renders Markdown report or no-report placeholder

Delete button
  └── confirm() dialog
  └── DELETE /api/v1/incidents/{incidentId}
  └── updateState({ incidents: filtered, incidentVersion: +1 }, true)
  └── renderArchiveView(container)
  └── (other tabs receive INCIDENT_DELETED via WebSocket → same state update)

Control Room → (inside modal)
  └── modal closed
  └── updateState({ view: 'control', selectedIncidentId: incidentId })
  └── subscriber fires → renderView('control') → ControlRoom.js
```

---

## API Endpoints Used

| Method | Endpoint | When called | Response used |
|---|---|---|---|
| `GET` | `/api/v1/incidents/{id}` | On every modal open | `report` (Markdown string or null) |
| `DELETE` | `/api/v1/incidents/{id}` | On confirmed delete | `success` (boolean) |

The archive list itself is **not** fetched from the API — it reads from `state.incidents` which is populated by `GET /api/v1/incidents` in `main.js` at startup and refreshed every 30 seconds when the WebSocket is disconnected.

---

## XSS Protection

All user-originated strings rendered into innerHTML go through `escapeHtml()`:

```javascript
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
```

Applied to: `alert_name`, `severity`, `filters.search` (in the input `value` attribute), label keys and values in `renderContext()`, and modal header text.

**Exception:** `marked.parse(data.report)` renders the backend-generated post-mortem report as raw HTML. This is intentional — the report is AI-generated and server-controlled, not user input.

---

## Known Issues / Limitations

| # | Area | Issue |
|---|---|---|
| 1 | Live updates | The archive card list does not refresh automatically when a new incident resolves while the view is open. The user must navigate away and return to see newly-resolved incidents. |
| 2 | Pagination | All resolved incidents are rendered at once. There is no pagination or virtual scrolling. With a large number of resolved incidents this will cause slow renders. |
| 3 | No persistence | All incidents (and therefore the archive) are stored in-memory only. Restarting the backend clears all history. |
| 4 | Duration accuracy | Duration is calculated as `last_updated − start_time`. `start_time` is the pipeline arrival time (when the backend first processed the alert), not the original Alertmanager `startsAt` fire time. For delayed alerts this can undercount the true incident duration. |
| 5 | Sort stability | The `dur_desc` sort computes duration from `last_updated − start_time`. Since `start_time` is the pipeline arrival time (see above), duration rankings may not reflect true wall-clock incident lengths. |
| 6 | Delete — only resolved | The backend enforces `status === 'resolved'` on delete. Since the archive view only shows resolved incidents, this should never surface to the user — but any 400 response is caught and shown as a generic `alert()`. |
| 7 | Report modal — no cache | The report modal always makes a fresh `GET /api/v1/incidents/{id}` call on open, even if the same incident was viewed moments before. |
