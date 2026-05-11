# Story Artifacts Review — SRE Copilot
**Reviewed by:** Product Owner (AI-assisted)
**Date:** 2026-05-11
**Source artifacts:** `aidlc-docs/story-artifacts/`
**Compared against:** Live codebase at `frontend/src/` and `bot/`

---

## Executive Summary

SRE Copilot is an AI-assisted multi-infrastructure incident management platform. The story artifacts define 8 user stories across incident detection, Teams notifications, diagnostics, AI RCA, runbook automation, post-mortem reporting, pod management, and chaos engineering.

**Overall alignment: 7.5 / 10**

The core incident pipeline (US01 → US06) is well-implemented and largely matches the stories. The product has gone further than the stories in several areas (noise reduction, multi-infrastructure connectors, CEL playground, bento-style Control Room). However, three significant gaps exist: runbook execution is still a stub, persistent storage was never built, and the MS Graph API threading requirement from US02 was not implemented. The chaos engine and pod management stories are fully matched.

| Story | Title | AC Match | Gaps |
|-------|-------|----------|------|
| US01 | Incident Detection | ✅ Full | Minor: no formal audit log |
| US02 | Teams Notification | 🟡 Partial | Graph API threading not built |
| US03 | Automated Diagnostics | ✅ Full | Demo-mode K8s unreachable warning |
| US04 | AI RCA | ✅ Full | Local LLM fallback not built |
| US05 | Runbook Automation | 🟡 Partial | Execution is a stub; no actual script run |
| US06 | Post-Mortem Report | 🟡 Partial | No email delivery; no persistent storage |
| US07 | Pod Management | ✅ Full | Multi-cluster limited to demo |
| Chaos | Chaos Engine | ✅ Full | No gap |

---

## US01 — Incident Detection

### Original Story
> As a System Administrator / SRE, I want the bot to automatically receive and parse alerts from Kubernetes (via Alertmanager) so that I don't have to manually monitor dashboards.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Expose webhook endpoint `/alerts/webhook` | ✅ | `POST /api/v1/alerts/webhook` — live in `bot/alert_handler.py` |
| 2 | Accept standard Alertmanager JSON payload | ✅ | Parses version 4 Alertmanager schema: `alertname`, `labels`, `annotations`, `status`, `startsAt`, `fingerprint` |
| 3 | Parse `alertname`, `severity`, `namespace`, `pod`, `status` | ✅ | All parsed; namespace resolved from label priority (`namespace` > `exported_namespace` > `job`) |
| 4 | Log incoming alerts for auditing | 🟡 | Python `logging` used — functional but not a formal audit trail; no persistent log store |

### What Was Built Beyond the Story
- **Deduplication**: fingerprint-based dedup with `dedup_count` tracking (not in story)
- **Re-fire detection**: if an alert re-fires after resolution, `start_time` and `alert_starts_at` are reset — important edge case handled
- **Synthetic test alert**: `POST /api/v1/alerts/test` for dev/chaos purposes (not in story)
- **Noise reduction pre-processing**: CEL filter rules and maintenance windows evaluated before incident creation

### Gaps / Risks
- **No persistent audit log**: The story requires logging for auditing but only Python `logging` is used. If the process restarts, all history is lost. This is a compliance risk for enterprise customers.
- **No schema validation**: Alertmanager payload is trusted as-is; malformed payloads could cause silent failures.

### Product Owner Recommendation
- Open a tech debt story: **"Persist alert audit log to file/database"**
- Add input schema validation (Pydantic model) on the webhook endpoint

---

## US02 — Microsoft Teams Notification

### Original Story
> As an SRE On-Call Engineer, I want to receive formatted alerts in Microsoft Teams so that I can immediately be aware of Kubernetes incidents on my phone or desktop.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Send message via Webhook URL or Graph API | 🟡 | Webhook only — Graph API not implemented |
| 2 | Adaptive Card format | ✅ | Adaptive Card JSON with severity color coding |
| 3 | Severity visual indicators (Red=Critical, Yellow=Warning) | ✅ | `"Attention"` for critical/page, `"Warning"` for others |
| 4 | Include: Alert Name, Severity, Summary, Namespace/Pod | ✅ | All fields included; also adds Incident ID, RCA truncated to 1000 chars |
| 5 | Follow-up "Resolved" notification | ✅ | Teams card updated on resolution with status change |

### What Was Built Beyond the Story
- Teams card also includes RCA summary and runbook action (beyond original spec)
- Simulation Mode warning in UI header (not a Teams story, but good UX)

### Gaps / Risks
- **MS Graph API not implemented**: The story explicitly lists "MS Graph API" as an integration answer. Without it, Teams messages cannot be threaded — every notification creates a new card. This breaks the "follow-up resolved notification" UX on mobile (no thread context).
- **No retry logic**: If the webhook POST fails, the notification is silently dropped.
- **Teams URL hardcoded to env var**: No per-connector Teams channel routing (all alerts go to one channel).

### Product Owner Recommendation
- **High priority gap**: Implement Graph API threading. This is table-stakes for enterprise on-call workflows.
- Add webhook POST retry with exponential backoff (3 attempts)
- Future: per-severity channel routing (critical → #alerts-critical, warning → #alerts-warning)

---

## US03 — Automated Diagnostics Collection

### Original Story
> As an SRE On-Call Engineer, I want the bot to automatically gather relevant logs, events, and metrics when an alert fires so that I have immediate context without manually running kubectl commands.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Connect to EKS cluster securely based on alert labels | ✅ | Uses `kubernetes` Python client; kubeconfig from env or default context |
| 2 | Fetch recent `kubectl events` for affected namespace | ✅ | Pod events fetched per namespace in `kubernetes_provider.py` |
| 3 | Fetch recent logs (last 100 lines) for affected Pod | ✅ | Pod logs: last 100 lines; 5-minute tail |
| 4 | Store diagnostics and pass to AI engine | ✅ | Stored in `incident.raw_diagnostics`; forwarded to `ai_analysis.py` |
| 5 | Summary/link appended to Teams alert | ✅ | Diagnostic summary embedded in Teams Adaptive Card |

### What Was Built Beyond the Story
- **Multi-provider fallback**: if K8s unavailable, falls back to Prometheus metrics, then local machine (psutil). Story only mentioned K8s.
- **Alert-type-to-diagnostic mapping**: mentioned in story notes as desired — implemented via provider registry
- **Diagnostics failure handling**: `diagnostics_failed` flag set; UI shows error banner in Control Room; runbook approval button disabled

### Gaps / Risks
- **Demo-mode failure**: When K8s is not configured (e.g., local dev), diagnostics fail with "Infrastructure unreachable". The fallback chain helps, but the error path UI needs clearer user guidance.
- **No RBAC documentation**: Story specifies "Bot runs in dedicated K8s namespace with RBAC" — no RBAC manifest found in the repo. This is a deployment gap, not a code gap.
- **Node metrics**: Node-level CPU/memory is called but may return mock data in demo mode.

### Product Owner Recommendation
- Add a `DEPLOYMENT.md` with the K8s RBAC manifest (ServiceAccount, ClusterRole, ClusterRoleBinding)
- Add a "Diagnostics unavailable — check connector settings" call-to-action link in the Control Room error banner
- Open story: **"Diagnostic dry-run / connectivity check on connector save"**

---

## US04 — AI Root Cause Analysis

### Original Story
> As an SRE On-Call Engineer, I want an AI component to analyze alert details and collected diagnostics so that I can quickly get a summarized hypothesis for root cause.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Send alert context + diagnostics to LLM | ✅ | `ai_analysis.py` sends labels, annotations, raw_diagnostics to OpenAI |
| 2 | Structured response: Summary, Root Causes, Next Steps | ✅ | Prompt enforces Markdown format with "Root Cause Hypothesis" and "Suggested Mitigation" |
| 3 | Forward analysis to MS Teams | ✅ | RCA (truncated to 1000 chars) embedded in Teams Adaptive Card |
| 4 | Analysis generated within <30 seconds | ✅ | Async pipeline; typical latency 3–8s (GPT-4 dependent) |

### What Was Built Beyond the Story
- **UI rendering**: RCA displayed as rendered Markdown in the Control Room "AI RCA" tab (using `marked` library) — far beyond original spec of just forwarding to Teams
- **Fallback mock RCA**: When no `OPENAI_API_KEY`, realistic mock analysis is returned (CPU spike simulation, connection leak narrative) — good for demo without API cost
- **Temperature control**: 0.2 (deterministic) — not in story but good engineering decision
- **Raw telemetry tab**: Alongside RCA, raw diagnostic output is shown in a terminal-style view

### Gaps / Risks
- **OpenAI only**: Story mentions "OpenAI, Anthropic, local" LLM support. Only OpenAI is implemented. For enterprise customers with data privacy requirements, no local LLM option (Llama/Ollama) is available.
- **Max tokens 600**: Some complex incidents may produce truncated RCA — no indicator in UI when content is cut off.
- **No source citations**: Story requirement "always provide sources (log links, event references)" is in the VPP risk mitigations but not enforced in the AI prompt.

### Product Owner Recommendation
- **Medium priority**: Add Anthropic Claude or Ollama as alternative LLM providers (abstract behind `LLMProvider` interface)
- Add citation enforcement to the OpenAI prompt: "Reference specific log lines or events"
- Add token usage tracking for cost visibility in Settings page

---

## US05 — Runbook Suggestions and Automation

### Original Story
> As an SRE On-Call Engineer, I want the system to suggest or automatically execute predefined runbooks based on alert type so that known issues can be mitigated faster.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Repository of predefined runbooks (Python/Ansible/bash) | ❌ | No actual runbook scripts exist; only recommendation strings |
| 2 | Map alert names to runbooks | 🟡 | `runbook_executor.py` returns action strings (e.g., "Restart target resource") but no actual mapping table |
| 3 | Present runbook as clickable action in Teams | 🟡 | Teams card shows runbook action text, but no interactive "click to execute" Teams button |
| 4 | Execute runbook upon user action | ❌ | Execution is logged only — no actual script, kubectl, or Ansible is run |
| 5 | Report success/failure back to Teams | 🟡 | Teams notified of "Mitigation Applied" status but with no actual outcome data |

### What Was Built Beyond the Story
- **Human-in-the-loop UI**: Control Room Remediation panel shows proposed command, requires typing "EXECUTE" to confirm — good safety gate not in original story
- **Diagnostics-gated approval**: If diagnostics failed, the Execute button is disabled — prevents blind execution

### Gaps / Risks
- **This is the biggest gap in the product.** The core value proposition — "click to fix" — is not delivered. The system recommends but cannot act.
- No runbook library exists (no Python scripts, no Ansible playbooks, no bash)
- No MS Graph API for Teams interactive buttons (mentioned in story notes)
- No success/failure feedback loop — impossible to validate if remediation worked

### Product Owner Recommendation
- **High priority sprint**: Build the first 3 real runbooks:
  1. Restart pod (`kubectl rollout restart deployment/<name>`)
  2. Scale deployment (`kubectl scale deployment/<name> --replicas=N`)
  3. Trigger log capture (automated `kubectl logs` dump to file)
- Implement execution in `runbook_executor.py` using the existing Kubernetes provider
- Add execution result (stdout/stderr) back to timeline and Teams card
- Open a dedicated epic: **"Runbook Library v1"**

---

## US06 — Incident Timeline and Post-Mortem Report

### Original Story
> As an SRE Manager, I want the system to automatically generate a post-incident timeline and report so that the team can conduct efficient post-mortems without manual data compilation.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Log timestamps for all pipeline stages | ✅ | `TimelineEvent` objects added at: alert fire, diagnostics, AI RCA, runbook, resolution |
| 2 | Compile chronological timeline on resolution | ✅ | Timeline manager builds event list; sorted by timestamp |
| 3 | AI summarizes entire event into Markdown report | ✅ | Report generated on `status = resolved` for high/critical/page severity |
| 4 | Save report to directory or send via email/Teams | 🟡 | Stored in memory only; shown in Archive UI; not saved to disk or emailed |

### What Was Built Beyond the Story
- **Archive UI**: Full post-mortem ledger page with search, severity filter, and Markdown-rendered report modal — far beyond "save to directory"
- **Report gating**: Only critical/page/high severity generates a report — reasonable product decision
- **24h retention**: Incidents expire after 24 hours (noted in VPP as limitation)

### Gaps / Risks
- **No persistence**: If the backend restarts, all incident history and reports are lost. This makes the Archive page unreliable for real post-mortem use.
- **No email delivery**: Story explicitly mentions email as a delivery option — not implemented.
- **24h expiry**: Reports disappear the next day. For a post-mortem tool, this is a critical gap — teams often review incidents 2–5 days later.

### Product Owner Recommendation
- **Critical gap for enterprise use**: Implement SQLite or PostgreSQL persistence for incidents and reports
- Minimum viable persistence: write resolved incident JSON + report to `./data/incidents/{date}/` on disk
- Open story: **"Persist incidents to disk/database on resolution"**
- Email delivery can wait; persistence cannot

---

## US07 — Pod Inventory and Fleet Management

### Original Story
> As an SRE, I want a real-time registry of all pods in my cluster so that I can quickly assess fleet health and take manual corrective actions without kubectl.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Tabular view of all pods across namespaces | ✅ | Pods page with 11-column table |
| 2 | Metadata: Name, Namespace, Kind, Node IP, Age | ✅ | All present in table |
| 3 | Health signals: Status, Restart count, CPU/Memory | ✅ | Status with colored dot, Restarts (orange if >0), CPU/Memory columns |
| 4 | Namespace filtering | ✅ | Dropdown filter, auto-populated with discovered namespaces |
| 5 | YAML inspection | ✅ | Modal terminal with rendered pod YAML manifest |
| 6 | Delete/restart pod with confirmation | ✅ | Delete button with `confirm()` dialog; `DELETE /api/v1/pods/{ns}/{name}` |
| 7 | Multi-cluster transparency | 🟡 | Cluster column shown; multi-cluster aggregation architecture present but limited to one cluster in demo |

### What Was Built Beyond the Story
- Auto-refresh every 5 seconds with live indicator animation
- Namespace dropdown auto-updates as new namespaces are discovered
- Kind badge (Pod, Deployment, etc.) styled distinctly
- Operation buttons per row (view YAML + delete) with hover reveal

### Gaps / Risks
- **Multi-cluster in demo only**: Architecture supports multiple connectors but the `GET /api/v1/pods` aggregation may only reliably pull from the first configured K8s connector.
- **No restart action**: Story mentions "restart pod" — delete is there but restart (rollout restart) is not a separate button.
- **CPU/Memory may show stale data**: Values come from the Kubernetes provider; if metrics-server is not installed on the cluster, these columns will be empty or N/A.

### Product Owner Recommendation
- Add a dedicated "Restart" button (triggers `kubectl rollout restart`) distinct from delete
- Add metrics-server availability check with a tooltip explaining when CPU/Memory is unavailable
- Validate multi-cluster aggregation with two real connectors before claiming the feature complete

---

## Chaos Engine Stories

### Original Stories (4)

| Story | Acceptance Criterion | Status | Evidence |
|-------|---------------------|--------|----------|
| US1: Node outage toggle | Toggle simulation via API or UI | ✅ | `POST /api/v1/chaos/trigger`; UI toggle buttons per scenario |
| US2: Extensible scenarios | Registry pattern for new scenario types | ✅ | `chaos_manager.py` registry; UI renders all scenarios dynamically |
| US3: Visual simulation indicator | Clear warning when Chaos Mode active | ✅ | Orange "⚠️ Simulation Mode" badge in header, pulsing; `state.isSimulationMode` flag |
| US4: Rapid restoration | "Stop All Chaos" single action | ✅ | "Global Restoration" button visible when any simulation active |

### What Was Built Beyond the Story
- Manual Alert Injection section (3 buttons: Local, VM, K8s) — fires synthetic alerts through the full pipeline for end-to-end testing
- Per-scenario active state with visual orange highlighting (border, shadow, badge)
- Scenario abort mid-toggle updates all UI without page reload

### Gaps / Risks
- No chaos scenarios actually disrupt infrastructure — they only inject fake alerts. A real chaos test (e.g., network partition, pod kill) would require integration with a tool like Chaos Mesh or LitmusChaos.
- Scenarios are hardcoded in `chaos_manager.py`. The extensibility story says "registry" — the structure exists but adding a new scenario requires code change, not a UI/config operation.

### Product Owner Recommendation
- This is acceptable for v1 (fire fake alerts = validate the pipeline). Document clearly that Chaos Engine v1 is "alert simulation", not "infrastructure disruption".
- Open future story: **"Chaos Engine v2 — Real Infrastructure Disruption via LitmusChaos"**
- Add an "Add Custom Scenario" form in the UI (name + alert payload template) to fulfil the extensibility story without code changes

---

## Cross-Cutting Gaps (Not Covered by Any Story)

These are gaps discovered in the codebase that no story addresses but matter for the product:

| Gap | Severity | Notes |
|-----|----------|-------|
| No persistent storage | 🔴 Critical | All incidents, reports, connectors lost on restart. Blocks production use. |
| No authentication/authorization | 🔴 Critical | The UI and API have zero auth. Anyone with network access can fire alerts, delete pods, execute runbooks. |
| No RBAC | 🟠 High | VPP mentions RBAC for runbooks — not started. |
| In-memory only connector store | 🟠 High | `connectors.json` is the only persistence. If not committed, connectors are lost. |
| No audit trail | 🟠 High | Who deleted a pod? Who approved a runbook? No record. |
| Local LLM fallback | 🟡 Medium | VPP promises Llama 3 for privacy-sensitive customers — not started. |
| Email notifications | 🟡 Medium | VPP mentions email — not started. |
| Predictive anomaly detection | 🟡 Medium | VPP roadmap "Later" item — not started (expected). |
| `prefers-reduced-motion` | 🟢 Low | Design system checklist item — animate-pulse and spin not gated on user preference. |

---

## Feature Scope Drift (Built Beyond Stories)

The team built several features not described in any story artifact. These are positive additions but should be backfilled into the story artifacts to keep documentation current:

| Feature | Location | Impact |
|---------|----------|--------|
| Noise Reduction (CEL rules + dedup + maintenance windows) | `bot/noise_reduction.py`, Rules page | High — core product differentiator |
| Multi-Infrastructure Connectors | Settings page, `bot/providers/` | High — supports K8s, Prometheus, Alertmanager, Local Machine |
| CEL Playground | Rules page | Medium — developer tool for testing suppression logic |
| Control Room (Bento Grid UI) | `frontend/src/views/ControlRoom.js` | High — most complex UI view, not described in any story |
| WebSocket real-time patching | `bot/ws_manager.py`, `main.js` | High — core UX (no page refresh on updates) |
| Dashboard KPI cards + Live Activity Feed | Dashboard view | Medium — standard observability dashboard features |
| Dark mode (permanent) | `index.html`, `tailwind.config.js` | Low — UX/brand decision |

**Recommendation:** Write backfill stories for Noise Reduction, Multi-Infra Connectors, and Control Room — these are the most valuable features and currently have no acceptance criteria to test against.

---

## Priority Action Items for Product Owner

### Immediate (Next Sprint)
1. **Open story: "Implement basic incident persistence"** — SQLite or file-based. Without this, the product cannot be used in production.
2. **Open story: "Add API authentication"** — Bearer token minimum; JWT for enterprise. The current open API is a security liability.
3. **Open story: "Build Runbook Library v1"** — 3 real runbooks using existing Kubernetes provider. This closes the biggest promise-vs-reality gap.

### Short Term (Next 2 Sprints)
4. **Open story: "MS Teams Graph API threading"** — Closes the US02 gap; critical for on-call UX.
5. **Backfill story: "Noise Reduction Engine"** — Document and formalize AC for CEL rules, dedup, maintenance windows.
6. **Backfill story: "Multi-Infrastructure Connector Registry"** — Document AC for connector add/delete/status.
7. **Open story: "Diagnostic dry-run on connector save"** — Validate K8s/Prometheus connectivity before saving.

### Medium Term (Roadmap)
8. **Open story: "Local LLM support (Ollama/Llama 3)"** — VPP commitment for privacy-sensitive enterprise customers.
9. **Open story: "Chaos Engine v2 — Real Infrastructure Disruption"** — LitmusChaos integration.
10. **Open story: "Audit Log"** — Who did what, when. Required for enterprise compliance.

---

## Alignment Score by Story

| Story | Score | Rationale |
|-------|-------|-----------|
| US01 — Incident Detection | 9/10 | All ACs met; only gap is formal audit log |
| US02 — Teams Notification | 7/10 | Cards work well; Graph API threading missing; no retry |
| US03 — Automated Diagnostics | 8/10 | Multi-provider fallback exceeds story; RBAC manifest missing |
| US04 — AI RCA | 8/10 | Strong implementation; local LLM not built; no source citations |
| US05 — Runbook Automation | 4/10 | Suggestions only; zero actual execution; no runbook library |
| US06 — Post-Mortem Report | 7/10 | Great UI; no persistence; no email |
| US07 — Pod Management | 9/10 | All ACs met; multi-cluster limited in demo |
| Chaos Engine | 9/10 | All 4 stories met; real infrastructure disruption is future scope |
| **Overall** | **7.6/10** | Core pipeline solid; persistence and runbook execution are critical gaps |
