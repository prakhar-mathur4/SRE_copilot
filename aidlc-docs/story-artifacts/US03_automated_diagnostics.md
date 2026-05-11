# US03 — Automated Diagnostics Collection

| Field | Value |
|---|---|
| **Epic** | Core Incident Pipeline |
| **Priority** | P0 — Critical Path |
| **Status** | ✅ Delivered |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE on-call engineer,  
**I want** the system to automatically gather logs, events, and metrics from the affected infrastructure the moment an alert fires,  
**So that** I have immediate diagnostic context without running a single kubectl or ssh command.

---

## Background

The average SRE spends 8–12 minutes manually gathering context after an alert fires (opening terminals, running kubectl, querying Prometheus). This story eliminates that work by automating the collection and passing the raw output directly to the AI RCA engine. The quality of the AI analysis is entirely dependent on the quality of the diagnostics collected here.

---

## Features in Scope

### Feature 1 — Multi-Provider Diagnostic Collection
The system collects diagnostics from the infrastructure provider that best matches the alert's label set — Kubernetes, Prometheus, or local machine — using a priority heuristic.

### Feature 2 — Graceful Failure Handling & Pipeline Halt
If diagnostics cannot be collected, the pipeline halts cleanly rather than producing a fabricated AI analysis from empty data.

---

## Acceptance Criteria

### Feature 1: Multi-Provider Diagnostic Collection

**AC1.1** — When a new firing alert passes noise reduction, the system automatically selects a diagnostic provider using the following heuristic (first match wins):
1. `provider_id` label present in alert → route to that specific connector
2. `instance: local` or `namespace: local-system` → Local Machine provider
3. `pod` or `namespace` label present → Kubernetes provider
4. `instance` label present (non-local) → Prometheus provider
5. Fallback → first available provider in the connector registry

**AC1.2** — **Kubernetes Provider** collects:
- Pod logs: last 100 lines for the affected pod (`labels.pod`, `labels.namespace`)
- Namespace events: recent events for the affected namespace
- Node metrics: CPU and memory from the metrics-server if available

**AC1.3** — **Prometheus Provider** collects:
- Recent metric values for the alert's `instance` target
- Query results from the alert's `generatorURL` if available

**AC1.4** — **Local Machine Provider** collects (via psutil):
- CPU usage percentage
- Memory usage and availability
- Disk usage per mount point
- Running process list

**AC1.5** — The collected diagnostic output is stored as a raw string on the incident (`raw_diagnostics`) and passed directly to the AI RCA engine (US04). It is also surfaced in the Control Room UI under the "Raw Telemetry" tab.

**AC1.6** — A timeline event `"Diagnostics collected successfully"` (source: `Diagnostics`) is added to the incident on success.

---

### Feature 2: Graceful Failure Handling & Pipeline Halt

**AC2.1** — If the diagnostic collection returns an empty result, or the output contains any of the keywords `unreachable`, `error`, or `failed`, the system treats the collection as a failure.

**AC2.2** — On diagnostic failure:
- `incident.diagnostics_failed` is set to `true`
- `incident.diagnostics_error` is populated with the error message
- A timeline event `"CRITICAL: Diagnostics failed — <error_message>"` (source: `Diagnostics`) is added
- A `Link Failure` Teams card is sent (see US02 AC2.1)
- **The pipeline halts** — AI RCA and runbook stages are skipped entirely

**AC2.3** — The Control Room UI reflects the failure state: the "Approve Execution" runbook button is disabled, and a banner displays the diagnostics error message so the on-call engineer knows the cause.

**AC2.4** — A WebSocket event `"Pipeline Failure: Infrastructure unreachable."` is broadcast to all connected clients when diagnostics fail.

---

## Definition of Done

- [ ] Provider selection heuristic routes alerts to the correct provider based on label matching
- [ ] Kubernetes provider collects pod logs, namespace events, and node metrics
- [ ] Prometheus provider collects metric values for the alert's target
- [ ] Local machine provider collects CPU, memory, disk, and process data
- [ ] `raw_diagnostics` field is populated on the incident on success
- [ ] Pipeline halts cleanly on failure — no AI or runbook stages execute
- [ ] `diagnostics_failed` flag is set and error is stored on failure
- [ ] `Link Failure` Teams card is sent on diagnostic failure
- [ ] Control Room UI disables runbook approval when diagnostics have failed

---

## Out of Scope

- Kubernetes RBAC manifest (deployment concern — not a code deliverable of this story)
- Log storage or export (diagnostics are in-memory only)
- Diagnostic collection for resolved alerts (only firing alerts trigger collection)
- Prometheus remote-write or long-term metric queries
- SSH-based diagnostic collection for non-instrumented hosts
