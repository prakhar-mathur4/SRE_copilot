# US08 — Chaos Engineering & Simulation

| Field | Value |
|---|---|
| **Epic** | Observability & Fleet Control |
| **Priority** | P2 — Medium |
| **Status** | ✅ Delivered |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE engineer or product demonstrator,  
**I want** to trigger predefined failure scenarios and inject synthetic alerts directly from the UI, without touching the real infrastructure,  
**So that** I can validate the full incident pipeline end-to-end and demonstrate the product in environments without live Alertmanager integration.

---

## Background

Testing the incident pipeline in production is unsafe, and setting up a full Alertmanager environment for a demo is slow. This story provides two simulation tools: a metric override layer that makes the cluster health dashboard respond as if a failure is happening, and a direct alert injection button that fires a synthetic alert into the full pipeline (diagnostics → AI RCA → runbook) without any Alertmanager involvement. Together they allow SREs to validate pipeline behaviour and PMs to demonstrate the product in any environment.

---

## Features in Scope

### Feature 1 — Scenario-Based Metric Override and Manual Alert Injection
The system supports three predefined chaos scenarios that intercept and override real cluster metrics, plus three preset manual alert injection buttons that bypass noise reduction and fire directly into the incident pipeline.

### Feature 2 — Visual Chaos Mode Indicator and Global Restoration
While any chaos scenario is active, the UI applies a distinctive visual state to the Chaos view and cluster health indicators, and provides a single-click global restoration control that deactivates all running scenarios at once.

---

## Acceptance Criteria

### Feature 1: Scenario-Based Metric Override and Manual Alert Injection

**AC1.1** — `GET /api/v1/chaos/scenarios` returns the list of all available chaos scenarios. Each scenario has: `id`, `name`, `description`, `is_active`.

**AC1.2** — The three built-in scenarios are:

| ID | Name | Metric Effect |
|---|---|---|
| `node_failure` | Node Outage | `nodes_online` set to `0`; `status` set to `critical` |
| `cpu_spike` | CPU Saturation | `cpu_usage` set to `99.9` |
| `mem_leak` | Memory Leak | `memory_usage` set to `95.5` |

**AC1.3** — `POST /api/v1/chaos/trigger` with `{ "id": "<scenario_id>", "active": true|false }` activates or deactivates a scenario. Returns `{ "success": true, "scenario": "<id>", "active": <bool> }`. Returns HTTP 404 if the scenario ID is not found.

**AC1.4** — When one or more scenarios are active, `GET /api/v1/health/cluster` returns `simulation_mode: true` and the overridden metric values in the `environments` array. The Dashboard cluster health card reflects the simulated state.

**AC1.5** — The Chaos view includes a Manual Alert Injection section with three preset buttons:

| Button | Alert Name | Provider Target | Severity |
|---|---|---|---|
| Fire Local Alert | `LocalDiskFull` | `instance: local` | `critical` |
| Fire VM Alert | `HighCPUUsage` | `instance: vm-test-01` | `warning` |
| Fire K8s Alert | `PodCrashLooping` | `namespace: default`, `pod: web-api-pod-xyz` | `critical` |

**AC1.6** — Each injection button calls `POST /api/v1/alerts/test` with the preset payload. The frontend auto-generates a unique fingerprint (`test-<timestamp>-<random>`) to prevent incident ID collisions across repeated injections. The noise reduction pipeline is bypassed entirely — the alert is routed directly into incident processing.

**AC1.7** — After clicking an injection button, it shows "FIRING..." and is disabled for 1 second before re-enabling. A success or failure notification is shown to the operator.

---

### Feature 2: Visual Chaos Mode Indicator and Global Restoration

**AC2.1** — Each chaos scenario card applies a distinct visual state based on `is_active`:
- **Active**: orange border, `bg-alert-orange/5` background, pulsing `"ACTIVE"` badge in the top-right corner, button label changes to "Abort Simulation" with an orange background
- **Inactive**: primary-color hover border, `"Trigger Scenario"` button with neutral background

**AC2.2** — When any scenario is active, a "Global Restoration" button appears at the top of the Chaos view. Clicking it deactivates all currently active scenarios by calling `POST /api/v1/chaos/trigger` with `active: false` for each. The Chaos view and cluster health re-render after restoration completes.

**AC2.3** — `GET /api/v1/health/cluster` exposes `simulation_mode: true` whenever any chaos scenario is active. The Dashboard reads this flag and renders a simulation mode indicator on the cluster health card.

**AC2.4** — After any scenario toggle or global restoration, the Chaos view re-fetches `GET /api/v1/chaos/scenarios` and `GET /api/v1/health/cluster` to reflect the updated state.

---

## Definition of Done

- [ ] `GET /api/v1/chaos/scenarios` returns all three scenarios with correct `is_active` state
- [ ] `POST /api/v1/chaos/trigger` activates and deactivates scenarios correctly
- [ ] Active scenarios override the correct metrics in `GET /api/v1/health/cluster`
- [ ] `simulation_mode: true` returned when any scenario is active
- [ ] Dashboard cluster health card reflects simulation_mode state
- [ ] All three Manual Alert Injection buttons call `POST /api/v1/alerts/test` with correct preset payloads
- [ ] Injected alerts bypass noise reduction and enter the full pipeline
- [ ] Unique fingerprints auto-generated on each injection
- [ ] Active scenario cards show orange border, "ACTIVE" badge, and "Abort Simulation" button
- [ ] "Global Restoration" button appears when any scenario is active and deactivates all

---

## Out of Scope

- Custom user-defined chaos scenarios (only three built-in scenarios are supported)
- Chaos scenario scheduling (time-based auto-activation)
- Real infrastructure disruption (chaos affects metric reporting only, not actual pods or nodes)
- Chaos event history or audit log
- Chaos injection via API without UI (no CLI or script interface)
