# US05 — Runbook Recommendation & Human Approval

| Field | Value |
|---|---|
| **Epic** | Core Incident Pipeline |
| **Priority** | P0 — Critical Path |
| **Status** | ✅ Delivered |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE on-call engineer,  
**I want** the system to automatically recommend a remediation action based on the alert name and AI analysis, and require my explicit confirmation before anything is executed,  
**So that** I get a concrete next step immediately while retaining full control over what actually runs against production.

---

## Background

After the AI RCA completes, an engineer still needs to decide what to do. For well-known alert types this decision is deterministic — the same alert name always maps to the same safe first action. This story automates that lookup and surfaces the result with a deliberate human gate: nothing executes unless the operator types "EXECUTE" in the Control Room. This is the last automated stage of the pipeline before an incident transitions to the remediation phase.

---

## Features in Scope

### Feature 1 — Alert-to-Runbook Mapping
The system evaluates the alert name and AI RCA output against a built-in remediation lookup and produces a contextual action string automatically after AI analysis completes.

### Feature 2 — Human-in-the-Loop Approval Gate
The Control Room exposes the recommended action and a confirmation-gated "Approve Execution" button that triggers the runbook only after the operator explicitly types "EXECUTE".

---

## Acceptance Criteria

### Feature 1: Alert-to-Runbook Mapping

**AC1.1** — After AI RCA completes, the system automatically evaluates the runbook mapping using the alert name. The lookup runs as step 5 of the pipeline. A timeline event `"Evaluating runbook mapping"` (source: `Runbook Engine`) is added before the lookup executes.

**AC1.2** — The built-in lookup maps the following alert names to deterministic actions:

| Alert Name | Recommended Action |
|---|---|
| `HighMemoryUsage` | "Suggested Action: Capture heap dump, then safely restart the pod if usage > 95%." |
| `HighErrorRate` | "Suggested Action: Check upstream dependencies and API gateway logs." |
| `HighCPUUsage` | "Suggested Action: Review current traffic spike, consider scaling up HPA max replicas." |
| `DatabaseConnectionFailure` | "Suggested Action: Verify Database credentials in Secret, check network egress policies." |
| _(unknown)_ | Falls back to AI's "Suggested Mitigation" text if present; else "Standard Protocol: Restart target resource and monitor logs for regression." |

**AC1.3** — On successful mapping:
- `incident.runbook_executed` is set to `true`
- `incident.runbook_action` is set to the action string
- A timeline event `"Runbook executed: <action>"` (source: `Runbook Engine`) is added
- A `RUNBOOK_EXECUTED` WebSocket event is broadcast:
  ```json
  { "type": "RUNBOOK_EXECUTED", "incident_id": "...", "action": "<action_string>" }
  ```

**AC1.4** — The Teams notification is updated after runbook evaluation:
- If an action was found: `Mitigation Applied` status card with the action string
- If no action was found: `Action Required` status card with the RCA report only

**AC1.5** — `GET /api/v1/incidents/{id}` returns a `recommended_runbook` field populated dynamically at query time if `runbook_executed` is `false`. This allows the Control Room to display the suggestion even before the operator approves execution.

---

### Feature 2: Human-in-the-Loop Approval Gate

**AC2.1** — The Control Room "Recommended Remediation" bento card displays the `recommended_runbook` string and an "Approve Execution" button when `runbook_executed` is `false` and `diagnostics_failed` is `false`.

**AC2.2** — Clicking "Approve Execution" opens a browser prompt requiring the operator to type `"EXECUTE"` exactly. Any other value cancels the action without making any API call.

**AC2.3** — On confirmed execution, the frontend calls `POST /api/v1/runbook/trigger` with:
```json
{ "incident_id": "...", "alert_name": "...", "rca_summary": "..." }
```
The endpoint runs the same lookup (`execute_runbook`) and adds a timeline event `"Runbook triggered from UI: <action>"` (source: `UI/Dashboard`).

**AC2.4** — If `diagnostics_failed` is `true`, the Remediation card renders in a greyed-out, disabled state with the label "Remediation engine suspended due to connectivity loss." The "Approve Execution" button is not rendered. This prevents runbook execution when diagnostic data is unavailable.

**AC2.5** — When `runbook_executed` is `true`, the Remediation card replaces the action button with a terminal-style output pane displaying the executed action string.

---

## Definition of Done

- [ ] Runbook mapping executes automatically after AI RCA in the pipeline
- [ ] All four named alert types map to their correct action strings
- [ ] Unknown alert types fall back to AI mitigation or generic protocol
- [ ] `runbook_executed` and `runbook_action` set on incident on success
- [ ] `RUNBOOK_EXECUTED` WebSocket event broadcast on completion
- [ ] Teams card sends `Mitigation Applied` or `Action Required` based on outcome
- [ ] Control Room displays `recommended_runbook` from API before execution
- [ ] "Approve Execution" requires typing "EXECUTE" — no other value triggers execution
- [ ] Remediation card disabled (no button) when `diagnostics_failed` is true
- [ ] `POST /api/v1/runbook/trigger` adds timeline event on manual approval

---

## Out of Scope

- External runbook engines (Ansible Tower, Rundeck, PagerDuty Runbook Automation)
- Script execution on target infrastructure (all actions are recommendation strings only)
- Per-alert runbook versioning or audit log
- Role-based access control on the approval gate
- Runbook approval via Teams (approval is Control Room only)
