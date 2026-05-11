# US07 — Pod Registry & Fleet Management

| Field | Value |
|---|---|
| **Epic** | Observability & Fleet Control |
| **Priority** | P1 — High |
| **Status** | ✅ Delivered |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE on-call engineer,  
**I want** a live registry of all running pods and cluster resources with their health signals, and the ability to inspect their specs and terminate them directly from the browser,  
**So that** I can triage and remediate resource-level issues without opening a terminal or switching to kubectl.

---

## Background

During an active incident, an engineer often needs to answer two questions: "what is running and is it healthy?" and "can I restart this pod without affecting others?". Opening a terminal, authenticating, and running kubectl commands takes time and context-switch cost. This story surfaces that information directly in the SRE Copilot UI, auto-refreshing every 5 seconds, so the engineer can assess and act without leaving the incident workflow.

---

## Features in Scope

### Feature 1 — Real-Time Pod Registry with Health Signals
The system provides a live, filterable table of all pods across connected infrastructure providers, polling every 5 seconds and displaying per-pod health metrics and status signals.

### Feature 2 — YAML Inspection and Pod Deletion with Confirmation
Operators can inspect the full Kubernetes manifest for any listed pod and delete it via a browser confirmation gate, with the table refreshing automatically after deletion.

---

## Acceptance Criteria

### Feature 1: Real-Time Pod Registry with Health Signals

**AC1.1** — `GET /api/v1/pods` returns a list of pod objects. Each object includes: `name`, `namespace`, `cluster_name`, `kind`, `node_ip`, `status`, `age`, `cpu_usage`, `memory_usage`, `restarts`.

**AC1.2** — `GET /api/v1/pods?namespace={ns}` filters the result to pods in the specified namespace. The Pods view includes a namespace filter dropdown that updates the query parameter on selection.

**AC1.3** — `GET /api/v1/health/cluster` returns a cluster health summary with: `cpu_usage`, `memory_usage`, `nodes_total`, `nodes_online`, `status`, `simulation_mode`, and an `environments` array containing per-provider health objects.

**AC1.4** — `GET /api/v1/health/timeseries/{provider_id}` returns 2-hour historical time series data for a specific provider. The Dashboard uses this for sparkline visualisation.

**AC1.5** — The Pods view polls `GET /api/v1/pods` every 5 seconds. A "LIVE" indicator is shown briefly after each successful refresh. If the user navigates away from the Pods view, the polling interval is cleared.

**AC1.6** — Pod status is colour-coded in the table: `Running` → green, `Pending` → orange, any other status → red. Pods with `restarts > 0` display the restart count in orange.

---

### Feature 2: YAML Inspection and Pod Deletion with Confirmation

**AC2.1** — Each pod row includes two action buttons: a YAML inspection button and a delete button.

**AC2.2** — Clicking the YAML button calls `GET /api/v1/pods/{namespace}/{pod_name}/yaml` and opens a fullscreen overlay modal displaying the raw YAML spec. The modal has a close button and a "Return to Registry" button.

**AC2.3** — `GET /api/v1/pods/{namespace}/{pod_name}/yaml` returns `{ "yaml": "<yaml_string>" }`. On fetch failure, the modal displays `"FATAL: SPECIFICATION DECODE FAILURE."`.

**AC2.4** — Clicking the delete button opens a browser `confirm()` dialog with the message `"INITIATE TERMINATION: {pod_name}?"`. The delete API is only called if the operator confirms.

**AC2.5** — On confirmation, `DELETE /api/v1/pods/{namespace}/{pod_name}` is called. On success, the Pods view refreshes immediately. On failure (non-2xx), the API returns HTTP 500 and the UI does not refresh.

---

## Definition of Done

- [ ] `GET /api/v1/pods` returns full pod list with all required fields
- [ ] Namespace filter query parameter narrows the pod list correctly
- [ ] `GET /api/v1/health/cluster` returns cluster-wide health including `simulation_mode`
- [ ] `GET /api/v1/health/timeseries/{provider_id}` returns 2-hour history
- [ ] Pods view polls every 5 seconds and clears interval on view change
- [ ] Running/Pending/failed status colour coding displayed correctly
- [ ] YAML modal opens and displays spec on clicking the YAML button
- [ ] Delete requires confirm() dialog and calls DELETE endpoint only on confirmation
- [ ] Pod table refreshes automatically after successful deletion

---

## Out of Scope

- Kubernetes RBAC configuration (deployment concern)
- Multi-cluster namespace disambiguation (single provider context only)
- Pod log streaming in the UI (logs are available via the Control Room Raw Telemetry tab for active incidents)
- Pod editing or patching via the UI
- Persistent pod history across service restarts
