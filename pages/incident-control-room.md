# Incident Control Room

**Route:** `#/control`
**File:** `frontend/src/views/ControlRoom.js`
**Nav label:** No dedicated nav item — accessed from Active Incidents table (row click or Quick View → "Open Control Room")

---

## Purpose

The Incident Control Room is the deep-dive view for a single active incident. It loads the full incident object from the backend and lays out everything in one screen: incident metadata, AI-generated root cause analysis, raw diagnostic output, the alert payload, a real-time diagnostic log stream, a complete event timeline, and a human-approved runbook execution panel.

---

## Entry Behaviour

The view reads `state.selectedIncidentId`. If that is not set, it immediately redirects back to `#/active`. On load it shows a loading state (`INITIATING CONTROL LINK...`) while making an API call.

**API call:** `GET /api/v1/incidents/{selectedIncidentId}`

This is the only view that calls the single-incident endpoint, which returns extra fields not present in the list endpoint: `raw_diagnostics`, `diagnostics_failed`, `diagnostics_error`, the full `events` array, `recommended_runbook`, and `report`.

If the API call fails entirely, the view shows `LINK FAILURE: {error message}` in red.

---

## Layout

A bento-style CSS grid (`md:grid-cols-12 grid-rows-6 gap-4`). Five cards auto-placed in order:

```
┌─────────────────┬──────────────────────────────────────┬─────────────────┐
│  Incident Info  │                                      │   Diagnostic    │
│  (3 cols × 2r)  │     Analysis & Telemetry             │     Stream      │
├─────────────────┤       (6 cols × 4 rows)              │ (3 cols × 4r)   │
│                 │                                      │                 │
│  Event Timeline │                                      │                 │
│  (3 cols × 4r)  ├──────────────────────────────────────┴─────────────────┤
│                 │          Recommended Remediation (9 cols × 2 rows)     │
└─────────────────┴─────────────────────────────────────────────────────────┘
```

On screens narrower than `md` (768px), all cards stack vertically in source order.

---

## Card 1 — Incident Info

**Position:** Top-left (3 cols, rows 1–2)
**Left accent:** 4px primary-blue left border

| Element | Data | Notes |
|---|---|---|
| **Incident ID** | `inc.incident_id.slice(0, 16) + "…"` | Monospace, primary-blue. Full ID in `title` tooltip. |
| **Copy button** | Copies full `incident_id` to clipboard | Icon switches to green checkmark for 2 seconds on success. |
| **Severity badge** | `inc.severity` | Red = critical/page, Yellow = warning, Blue = info/other |
| **Alert Name** | `inc.alert_name` | Bold, xl text |
| **Started** | `new Date(inc.start_time).toLocaleString()` | Formatted as local date/time string |
| **Notification Status** | Always shows "Microsoft Teams Sent" with green checkmark | **Hardcoded — not driven by actual notification state.** The link "View Teams Thread →" points to `href="#"` and does nothing. |

> **Known issue:** The "Microsoft Teams Sent" status is always displayed as confirmed regardless of whether a Teams notification was actually sent. There is no backend field returned for notification status.

> **Known issue:** `inc.start_time` is the pipeline arrival time (when the SRE Copilot backend processed the alert), not the original Alertmanager fire time. The original fire time is in `inc.alert_starts_at`.

---

## Card 2 — Analysis & Telemetry

**Position:** Center (6 cols, rows 1–4) — the largest card
**Badge:** `GPT-4o Vision` (top-right corner of the card, always shown)

This card has three tabs. Default active tab is **AI RCA**.

---

### Tab 1 — AI RCA (default)

Shows the AI-generated root cause analysis report.

**States:**

| Condition | What is shown |
|---|---|
| `inc.diagnostics_failed === true` | **Pipeline Failure** — red dashed border box with title "Pipeline Failure", message "The diagnostic engine could not reach the target infrastructure", and the error code from `inc.diagnostics_error` (falls back to `CONNECTION_TIMEOUT` if null) |
| `inc.rca_report` is set | `inc.rca_report` rendered as full Markdown via the `marked` library (headings, code blocks, lists, prose all formatted) |
| Neither (pipeline still running) | `Synthesizing cluster telemetry...` in italic muted text |

---

### Tab 2 — Raw Telemetry

Shows the raw diagnostic output collected from the infrastructure provider.

- Rendered in a dark terminal `<pre>` block, monospace `text-cyan-200/80`
- Source: `inc.raw_diagnostics`
- If `inc.diagnostics_failed`: shows `ERROR: INFRASTRUCTURE UNREACHABLE`
- If `raw_diagnostics` is null/empty (and no failure): shows `No raw diagnostics available for this incident.`

---

### Tab 3 — Alert Payload

Shows the structured alert data in two key-value sections:

**Labels (`N`):** All entries from `inc.labels`
**Annotations (`N`):** All entries from `inc.annotations`
**Fire Time (Alertmanager):** `inc.alert_starts_at` ISO string — only shown if this field is present

Keys are primary-blue monospace, 160px wide, truncated with title tooltip. Values are break-all wrapped.

---

## Card 3 — Diagnostic Stream

**Position:** Top-right (3 cols, rows 1–4)
**Style:** Always dark terminal (`!bg-background-dark !border-surface-hover-dark`) regardless of app theme

A scrolling terminal log of diagnostic pipeline activity.

**Status indicator (top-right of card header):**
- Green pulsing dot when `inc.diagnostics_failed === false`
- Red static dot when `inc.diagnostics_failed === true`

**Content:**

```
[00:00:01] PROBE: minikube-cluster-01       ← hardcoded, always this text
[00:00:02] CONTEXT: {inc.context}           ← see known issue below
{events where source === 'Diagnostics'}     ← from the full events array
_                                           ← blinking cursor while pipeline running
```

Each diagnostics event is rendered as:
`[HH:MM:SS] {event.description}`

The blinking cursor `_` appears only when `!inc.diagnostics_failed && !inc.rca_completed`.

> **Known issue:** The first two lines are hardcoded. `minikube-cluster-01` does not come from actual connector data.

> **Known issue:** `inc.context` is `undefined` in the frontend because the API returns the field as `namespace`, not `context`. The line renders as `[00:00:02] CONTEXT: undefined`.

---

## Card 4 — Event Timeline

**Position:** Bottom-left (3 cols, rows 3–6)

A vertical chronological log of every event recorded for this incident by the backend pipeline.

**Source:** `inc.events` — the full list (all sources, unlike Card 3 which filters by `source === 'Diagnostics'`)

Each event entry:
- **Timestamp:** `event.timestamp` formatted as locale time string
- **Description:** `event.description`
- **Dot color:** Red + glow if description contains the string `"CRITICAL"`, otherwise primary-color hollow dot
- **Text color:** Red bold if description contains `"CRITICAL"`, otherwise default

A vertical line runs through the left edge connecting all dots.

**Common events written by the backend pipeline:**

| Description | Source |
|---|---|
| `Alert triggered` | Alertmanager |
| `Alert resolved` | Alertmanager |
| `Alert re-fired after resolution` | Alertmanager |
| `Incident manually resolved via Dashboard` | Operator |
| Diagnostics collection messages | Diagnostics |
| RCA completion messages | AI |
| Runbook execution messages | RunbookEngine / UI/Dashboard |

---

## Card 5 — Recommended Remediation

**Position:** Bottom (9 cols, rows 5–6)
**Label:** `RECOMMENDED REMEDIATION` in orange uppercase

This card has three distinct states depending on the incident's pipeline status.

---

### State A — Awaiting Approval (normal state)

Shown when `!inc.runbook_executed && !inc.diagnostics_failed`.

| Element | Detail |
|---|---|
| **Title** | `inc.recommended_runbook` if set, otherwise `'Standard Pod Restart'` |
| **Sub-text** | `Verified safe for {inc.context} context via historical runbooks.` |
| **Proposed Command** | Dark terminal box with a shell prompt `$` and a command string |
| **Approve Execution button** | Orange primary button — triggers the confirmation flow |
| **Human-in-the-loop label** | `"Requires manual confirmation"` (hidden on screens smaller than `lg`) |

**Proposed Command logic (hardcoded alert-name matching):**

| Alert name | Command |
|---|---|
| `LocalDiskFull` | `rm -rf /tmp/test-logs && df -h /` |
| `PodCrashLooping` | `kubectl delete pod -n {namespace} web-api-pod-xyz` |
| `HighCPUUsage` | `ps aux --sort=-%cpu | head -n 5` |
| Any other | `sre-copilot-remediate --incident-id {id[:8]}` |

> **Known issue:** The command is selected by matching `inc.alert_name` against hardcoded strings. It is not dynamically generated from the RCA or runbook engine.

> **Known issue:** `inc.context` is `undefined` in the sub-text for the same reason noted in Card 3 — the API returns `namespace`, not `context`.

**Approve Execution flow:**
1. User clicks "Approve Execution"
2. Browser `prompt()` dialog appears: `Type "EXECUTE" to run the remediation:`
3. If the user types exactly `EXECUTE`:
   - Button is disabled and text changes to `EXECUTING...`
   - `POST /api/v1/runbook/trigger` is called with `{ incident_id, alert_name }`
   - On success (`data.success === true`): the entire Control Room re-renders, which re-fetches the incident and shows State B
   - On failure: `alert("Failed: " + data.detail)` — button remains stuck as "EXECUTING..." (not reset)
4. If user types anything other than `EXECUTE` or cancels: nothing happens

> **Known issue:** The `POST /api/v1/runbook/trigger` endpoint expects `rca_summary` as a required field (`rca_summary: str` in the Pydantic model), but the frontend does not send it. This will cause a **422 Unprocessable Entity** response from FastAPI. The runbook approval button is currently broken as a result.

---

### State B — Runbook Executed

Shown when `inc.runbook_executed === true`.

- `EXECUTED` green badge next to the title
- Dark terminal block showing:
  ```
  $ runbook_exec --id {incident_id}
  > {inc.runbook_action}
  ```
  The result text (`inc.runbook_action`) is rendered in `text-accent-success` green.

---

### State C — Diagnostics Failed

Shown when `inc.diagnostics_failed === true`.

- Card is grayscale (`grayscale` CSS filter) with muted border instead of orange
- Title: `Infrastructure Unreachable`
- Sub-text: `Remediation engine suspended due to connectivity loss.`
- Approval button and command panel are replaced with a dashed placeholder: `Manual Control Required`

---

## Data Flow

```
Page entry
  └── state.selectedIncidentId must be set (set by ActiveIncidents row click
      or Quick View "Open Control Room" button)
  └── GET /api/v1/incidents/{selectedIncidentId}
        ├── inc.events               → Cards 3 and 4
        ├── inc.rca_report           → Card 2 AI RCA tab
        ├── inc.raw_diagnostics      → Card 2 Raw Telemetry tab
        ├── inc.labels + annotations → Card 2 Alert Payload tab
        ├── inc.recommended_runbook  → Card 5 title
        └── inc.runbook_action       → Card 5 State B terminal

User actions
  ├── Copy ID button         → navigator.clipboard.writeText(inc.incident_id)
  ├── Tab switch             → shows/hides AI/Raw/Payload divs, no API call
  └── Approve Execution      → prompt("EXECUTE") → POST /api/v1/runbook/trigger
                               → on success: re-calls renderControlRoomView()
                                 which re-fetches the incident

No live updates — this view does NOT subscribe to the WebSocket or state changes.
Refreshing requires navigating away and back, or approving a runbook (which triggers a re-render).
```

---

## Known Issues Summary

| # | Location | Issue |
|---|---|---|
| 1 | Card 1 — Notification Status | "Microsoft Teams Sent" is always shown as green, hardcoded. Not connected to real notification data. "View Teams Thread →" link is `href="#"` and does nothing. |
| 2 | Card 1 — Started time | Shows `start_time` (pipeline arrival time), not `alert_starts_at` (original Alertmanager fire time). |
| 3 | Card 3 — Diagnostic Stream | First line is hardcoded as `minikube-cluster-01`, not dynamic. |
| 4 | Card 3 — Context label | `inc.context` is `undefined` because the API returns the field as `namespace`. Renders as `CONTEXT: undefined`. |
| 5 | Card 5 — Context in sub-text | Same bug: `Verified safe for undefined context`. |
| 6 | Card 5 — Approve Execution | Missing `rca_summary` field in the POST body causes a 422 error from the backend. The button is currently non-functional. |
| 7 | Card 5 — Proposed command | Commands are hardcoded by alert name string match, not dynamically derived from the RCA or runbook engine. `web-api-pod-xyz` is a placeholder pod name. |
| 8 | General | The view does not subscribe to WebSocket events. If the RCA completes after this page opens, the user must navigate away and back to see it. |
