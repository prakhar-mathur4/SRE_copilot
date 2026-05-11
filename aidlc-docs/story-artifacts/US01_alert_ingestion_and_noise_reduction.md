# US01 — Alert Ingestion & Noise Reduction

| Field | Value |
|---|---|
| **Epic** | Core Incident Pipeline |
| **Priority** | P0 — Critical Path |
| **Status** | ✅ Delivered |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE on-call engineer,  
**I want** the system to automatically receive alerts from any Alertmanager — whether pushed via webhook or discovered by background polling — and filter out noise before an incident is ever created,  
**So that** my incident queue only contains real, unique, actionable alerts and I am never paged for duplicates or suppressed events.

---

## Background

Before this story, engineers had to watch Grafana dashboards and Alertmanager UIs manually. Every duplicate firing of the same alert created noise. There was no way to suppress known maintenance periods or low-value alert classes. This story is the entry point of the entire incident pipeline — nothing downstream runs until an alert clears these gates.

---

## Features in Scope

### Feature 1 — Multi-Mode Alert Ingestion
The system accepts alerts through three distinct paths so that no Alertmanager deployment topology is left unsupported.

### Feature 2 — Noise Reduction Pipeline
Every incoming alert passes through a three-gate suppression chain before an incident is created, eliminating duplicates, suppressed classes, and maintenance-window events.

---

## Acceptance Criteria

### Feature 1: Multi-Mode Alert Ingestion

**AC1.1** — The system exposes `POST /api/v1/alerts/webhook` that accepts the standard Alertmanager v4 grouped JSON payload. Multiple alerts in a single payload are each processed individually as independent background tasks. The endpoint returns HTTP 200 with `{"message": "Alert received and processing started"}` immediately — processing is non-blocking.

**AC1.2** — On startup (after a 10-second initialisation delay), the system begins polling every registered Alertmanager connector every 30 seconds using the Alertmanager v2 API (`GET /api/v2/alerts?active=true&silenced=false&inhibited=false`). Only connectors of type `alertmanager` are polled; Kubernetes, Prometheus, and local machine connectors are not.

**AC1.3** — The polling loop detects resolutions automatically: alerts present in the previous poll cycle but absent in the current one are synthesised as `status: resolved` and routed through the full pipeline. No explicit webhook call from Alertmanager is required for resolution.

**AC1.4** — Each alert ingested via the polling path carries an auto-injected label `alertmanager_source: <connector_id>` so that multi-Alertmanager environments can be distinguished in the context resolution chain.

**AC1.5** — The system exposes `POST /api/v1/alerts/test` for synthetic alert injection (used by diagnostics and chaos flows). This path bypasses the noise reduction pipeline and routes the alert directly into incident processing. The frontend auto-generates a unique fingerprint (`test-<timestamp>-<random>`) to prevent incident ID collisions.

**AC1.6** — Alerts silenced or inhibited within Alertmanager itself are never ingested; the polling query explicitly excludes `silenced=true` and `inhibited=true` alerts.

---

### Feature 2: Noise Reduction Pipeline

**AC2.1** — Every alert arriving via webhook or polling passes through the noise reduction pipeline in strict order before any incident is created:
1. **Maintenance Window Check** — evaluated first
2. **CEL Filter Rules** — evaluated second
3. **Fingerprint Deduplication** — evaluated third

If any gate rejects the alert, processing stops and the alert is counted as suppressed. Resolved alerts skip the deduplication gate and always proceed.

**AC2.2** — **Maintenance Windows:** An alert is suppressed if the current UTC time falls within any active maintenance window AND the window's CEL query matches the alert's labels/annotations. Suppressed alerts increment the window's suppress counter (`maintenance_stats[window_id]`).

**AC2.3** — **CEL Filter Rules:** An alert is dropped if any `discard`-action rule's CEL expression evaluates to `true` against the alert. The CEL activation context exposes: `alertname`, `severity`, `status`, `labels` (dict), `annotations` (dict), `source`. Dropped alerts increment the rule's hit counter (`filter_stats[rule_name]`).

**AC2.4** — **Fingerprint Deduplication (Storm Protection):** A deterministic SHA-256 fingerprint is computed from the alert's label set, excluding ephemeral fields (`timestamp`, `request_id`, `trace_id`). If a fingerprint is already active (same alert is already firing), the incoming alert is dropped and the `dedup_count` for that fingerprint is incremented. A resolution for a given fingerprint clears it from the active set.

**AC2.5** — The system maintains 24-hour rolling statistics accessible at `GET /api/v1/noise/stats`:
- `received_last_24h` — firing alerts that entered the pipeline
- `dropped_last_24h` — alerts suppressed by any gate
- `processed_last_24h` — alerts that passed all gates (`received - dropped`)
- Per-rule and per-window hit counts
- Deduplication details per fingerprint (alert name, count, last seen)

**AC2.6** — Filter rules and maintenance windows are manageable at runtime via API without restarting the service:
- `GET/POST/DELETE /api/v1/filters` — manage CEL filter rules
- `GET/POST/DELETE /api/v1/maintenance` — manage maintenance windows
- `POST /api/v1/cel/evaluate` — test a CEL expression against a sample alert before saving

---

## Incident Created on Pass

When an alert clears all three gates, the system creates or updates an `IncidentState` with the following fields:

| Field | Source | Notes |
|---|---|---|
| `incident_id` | `inc-<sha256_fingerprint>` | Deterministic — same alert always maps to same ID |
| `alert_name` | `labels.alertname` | — |
| `status` | `labels.status` | `firing` or `resolved` |
| `severity` | `labels.severity` | Defaults to `warning` if label absent |
| `context` | Priority chain (see below) | Resolved string format: `"key:value"` |
| `start_time` | UTC pipeline arrival time | Reset on re-fire after resolution |
| `alert_starts_at` | Alertmanager `startsAt` field | Preserved as original fire time |
| `labels` | Full label dict | — |
| `annotations` | Full annotation dict | — |
| `dedup_count` | Joined at query time | Not stored on model; read from `noise_reducer.dedup_details` |

**Context resolution priority** (first non-empty label value wins):
`namespace` → `instance` → `service` → `job` → `cluster` → `region` → `host` → `pod` → `container` → `alertmanager_source`

---

## Incident Lifecycle Events (US01 Scope)

The following timeline events are written during detection — before any downstream pipeline runs:

| Event Description | Source Tag | Trigger |
|---|---|---|
| `"Alert triggered"` | `Alertmanager` | New incident created |
| `"Alert resolved"` | `Alertmanager` | Alert resolved via Alertmanager |
| `"Alert re-fired after resolution"` | `Alertmanager` | Same fingerprint fires again after being resolved |
| `"Incident manually resolved via Dashboard"` | `Operator` | Operator calls `POST /api/v1/incidents/{id}/resolve` |

---

## Real-Time Propagation

On every incident create, update, or manual resolution, the system broadcasts an `INCIDENT_UPDATE` WebSocket event to all connected frontend clients:

```json
{
  "type": "INCIDENT_UPDATE",
  "incident_id": "inc-<fingerprint>",
  "status": "firing | resolved",
  "severity": "critical | warning | info",
  "alert_name": "AlertName"
}
```

The frontend collapses burst events using a 200ms debounced fetch with a version guard — a burst of 10 simultaneous alerts results in a single `GET /api/v1/incidents` call, not 10. The WebSocket client reconnects automatically using exponential backoff (1s → 60s cap) with random jitter to prevent thundering herd on server restart.

---

## Definition of Done

- [ ] Webhook endpoint accepts and processes Alertmanager v4 payload
- [ ] Polling loop runs every 30s and detects both new alerts and resolutions
- [ ] Synthetic test endpoint fires alerts directly into the pipeline (bypassing noise gates)
- [ ] All three noise gates enforce the correct order of evaluation
- [ ] SHA-256 fingerprints are deterministic across restarts
- [ ] `GET /api/v1/noise/stats` returns accurate 24h rolling counts
- [ ] Filter rules and maintenance windows are modifiable at runtime
- [ ] `INCIDENT_UPDATE` WebSocket event fired on every state change
- [ ] Connectivity probe alerts (`ConnectivityProbe` in alert name) are processed but skip AI/runbook stages

---

## Out of Scope

- Persistent storage of incidents across service restarts (in-memory only; 24h retention)
- Authentication on the webhook endpoint
- Schema validation / rejection of malformed Alertmanager payloads
- Silencing alerts from within SRE Copilot itself (silencing is Alertmanager's responsibility)
- `truncatedAlerts` handling — field is accepted in the payload model but not acted upon
