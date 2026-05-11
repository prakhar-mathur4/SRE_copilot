# US02 — Teams Notification Lifecycle

| Field | Value |
|---|---|
| **Epic** | Core Incident Pipeline |
| **Priority** | P0 — Critical Path |
| **Status** | ✅ Delivered (webhook); ❌ Graph API threading not built |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE on-call engineer,  
**I want** to receive a formatted Teams notification the moment an incident fires, and have that notification updated at each stage of the response pipeline,  
**So that** I have full incident context on my phone or desktop without opening any other tool.

---

## Background

On-call engineers should not need to context-switch to Grafana, kubectl, or a dashboard to understand what is happening. A single Teams thread should contain everything: what fired, how severe, what the AI found, what action was taken, and when it resolved. This story covers the notification layer only — the content it surfaces (RCA, runbook) is produced by US04 and US05.

---

## Features in Scope

### Feature 1 — Initial Adaptive Card Alert
A richly formatted Teams Adaptive Card is sent the moment a new incident enters the pipeline, before diagnostics or RCA run.

### Feature 2 — Status Lifecycle Updates
The Teams card is updated at each subsequent pipeline milestone, giving the on-call engineer a live view of remediation progress without any manual refresh.

---

## Acceptance Criteria

### Feature 1: Initial Adaptive Card Alert

**AC1.1** — When a new firing incident is created, the system sends an Adaptive Card to the configured Teams webhook URL (`TEAMS_WEBHOOK_URL` environment variable) within the same pipeline execution as incident creation.

**AC1.2** — The Adaptive Card must include the following fields:
- Incident ID (truncated to first 8 characters)
- Alert name
- Severity (with color coding: `Attention` for `critical`/`page`, `Warning` for all others)
- Namespace / context
- Alert description (from `annotations.description` or `annotations.summary`)
- Current status label: `"Investigating"`

**AC1.3** — If `TEAMS_WEBHOOK_URL` is not configured, the notification step is silently skipped and the pipeline continues. The absence of a webhook must not halt diagnostics or AI RCA.

**AC1.4** — The Adaptive Card payload is sent as an HTTP POST with `Content-Type: application/json`. No retry logic is currently implemented — a failed POST is logged and the pipeline continues.

---

### Feature 2: Status Lifecycle Updates

**AC2.1** — The Teams card is updated (via a new POST to the same webhook) at each of the following pipeline milestones:

| Trigger | Status Label | Additional Content |
|---|---|---|
| Initial fire | `Investigating` | Alert metadata only |
| Diagnostics failure | `Link Failure` | Error message: "Monitoring pipeline could not reach the target: `<error>`" |
| Connectivity probe success | `Probe Success` | "Infrastructure is connected and telemetry is flowing correctly." |
| AI RCA complete | `RCA Available` | RCA report (truncated to 1000 characters) |
| Runbook suggested | `Mitigation Applied` | Runbook action string |
| No runbook found | `Action Required` | RCA report only |
| Alert resolved | `Resolved` | Resolution acknowledgement |

**AC2.2** — Each status update is a new POST to the Teams webhook (not an edit of the original message). The card includes the incident ID so the on-call engineer can correlate updates to the original alert.

**AC2.3** — If diagnostics fail, the pipeline halts after sending the `Link Failure` update. No RCA or runbook notifications are sent for that incident.

**AC2.4** — Connectivity probe alerts (`alertname` contains `ConnectivityProbe`) send a `Probe Success` update and exit the pipeline — they do not trigger AI RCA or runbook notifications.

---

## Definition of Done

- [ ] Adaptive Card sent on every new firing incident with all required fields
- [ ] Severity colour coding correctly maps critical/page → `Attention`, all others → `Warning`
- [ ] `Link Failure` card sent and pipeline halted when diagnostics fail
- [ ] `RCA Available` card sent after AI analysis completes, with RCA text ≤ 1000 chars
- [ ] `Resolved` card sent when alert status transitions to resolved
- [ ] Missing `TEAMS_WEBHOOK_URL` causes silent skip, not pipeline failure
- [ ] Probe alerts produce `Probe Success` card and stop — no RCA or runbook cards

---

## Out of Scope

- MS Graph API for threaded replies (all updates are new posts, not replies to the original card)
- Retry logic on failed webhook POSTs
- Per-severity channel routing (all alerts go to one configured webhook)
- Email notifications
- Slack integration
- Interactive Teams buttons for runbook approval (approval happens in the web UI)
