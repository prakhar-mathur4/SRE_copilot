# US06 — Incident Timeline & Post-Mortem Report

| Field | Value |
|---|---|
| **Epic** | Core Incident Pipeline |
| **Priority** | P1 — High |
| **Status** | ✅ Delivered (timeline); ⚠️ Post-mortem logged only — not stored or surfaced in UI |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE on-call engineer,  
**I want** a complete chronological record of every action taken during an incident and an automatically generated post-mortem for high-severity resolutions,  
**So that** I can reconstruct exactly what happened, when, and why — both during the incident and in retrospective review — without relying on memory or chat history.

---

## Background

Alert pipelines move fast and involve multiple automated stages firing in seconds. Without a structured event log, engineers cannot tell whether diagnostics ran before or after the Teams card was sent, or whether the runbook fired before or after the RCA completed. This story ensures every pipeline stage writes a timestamped event to the incident record, and that critical incidents produce a structured post-mortem automatically at resolution so it is available before the engineer opens the debrief meeting.

---

## Features in Scope

### Feature 1 — Chronological Event Timeline
Every pipeline stage appends a timestamped event to the incident record. The full timeline is available in the Control Room UI from the moment the incident is created.

### Feature 2 — Automated Post-Mortem Generation
When a high-severity incident resolves, the system generates a structured Markdown post-mortem from the incident record and exposes it on the incident detail API.

---

## Acceptance Criteria

### Feature 1: Chronological Event Timeline

**AC1.1** — Each timeline event has three fields: `timestamp` (UTC datetime), `description` (human-readable string), and `source` (the pipeline component that wrote the event). Events are appended in real-time and never modified after creation.

**AC1.2** — The complete set of events written across the full pipeline lifecycle is:

| Stage | Event Description | Source |
|---|---|---|
| Alert fires | `"Alert triggered"` | `Alertmanager` |
| Alert resolves via Alertmanager | `"Alert resolved"` | `Alertmanager` |
| Alert re-fires after resolution | `"Alert re-fired after resolution"` | `Alertmanager` |
| Manual resolve from UI | `"Incident manually resolved via Dashboard"` | `Operator` |
| Diagnostics success | `"Diagnostics collected successfully"` | `Diagnostics` |
| Diagnostics failure | `"CRITICAL: Diagnostics failed — <error>"` | `Diagnostics` |
| AI RCA complete | `"AI Analysis completed"` | `AI Engine` |
| Automated runbook evaluation | `"Evaluating runbook mapping"` | `Runbook Engine` |
| Automated runbook executed | `"Runbook executed: <action>"` | `Runbook Engine` |
| Manual runbook approval | `"Runbook triggered from UI: <action>"` | `UI/Dashboard` |

**AC1.3** — The full event timeline is returned by `GET /api/v1/incidents/{id}` as an `events` array, each item containing `timestamp`, `description`, and `source`.

**AC1.4** — The Control Room "Event Timeline" panel renders all events as a vertical chronological feed. Events whose description contains `"CRITICAL"` are rendered in `alert-red` to visually distinguish failures from normal pipeline stages.

**AC1.5** — The "Diagnostic Stream" panel in the Control Room renders only events with `source === "Diagnostics"` alongside static context lines (probe target, incident context). A pulsing cursor is shown while the pipeline is still running (i.e., `!diagnostics_failed && !rca_completed`).

---

### Feature 2: Automated Post-Mortem Generation

**AC2.1** — When an incident transitions to `status: "resolved"`, `generate_report()` is called automatically. The report is only generated if `incident.severity` is one of: `high`, `critical`, or `page`. Incidents with other severity levels are skipped silently.

**AC2.2** — The generated report is a Markdown document containing:
- Incident ID, severity, context
- Start time and resolve time (UTC, formatted as `YYYY-MM-DD HH:MM:SS UTC`)
- Full event timeline as a Markdown bulleted list, each line formatted as:
  `- **HH:MM:SS** [Source]: Description`

**AC2.3** — `GET /api/v1/incidents/{id}` returns a `report` field populated with the generated Markdown when:
- `incident.status === "resolved"`, AND
- `incident.severity` is `high`, `critical`, or `page`

For all other incidents, `report` is `null`.

**AC2.4** — The post-mortem is generated on demand at query time from live incident state. It is not stored as a separate object and is not persisted across service restarts.

---

## Definition of Done

- [ ] All ten pipeline-stage events are written at the correct moment during processing
- [ ] `GET /api/v1/incidents/{id}` returns the complete `events` array in chronological order
- [ ] Control Room Event Timeline renders all events with CRITICAL events highlighted in red
- [ ] Diagnostic Stream panel filters to Diagnostics-source events only
- [ ] `generate_report()` triggers automatically on alert resolution
- [ ] Post-mortem is skipped for severities other than high/critical/page
- [ ] Post-mortem Markdown includes all required fields (ID, times, event list)
- [ ] `report` field returned by `GET /api/v1/incidents/{id}` for resolved high-severity incidents

---

## Out of Scope

- Persistent post-mortem storage (survives service restart)
- Export to Confluence, Jira, or shared drives
- Editable post-mortem fields (owner notes, corrective actions, follow-up tickets)
- Post-mortem for resolved low/warning-severity incidents
- Real-time timeline streaming to the Control Room (timeline is fetched on page load)
