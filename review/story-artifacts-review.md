# Story Artifacts Review — SRE Copilot
**Reviewed by:** Product Owner (AI-assisted)
**Date:** 2026-05-22
**Previous review:** 2026-05-11
**Source artifacts:** `aidlc-docs/story-artifacts/`
**Compared against:** Live codebase at `frontend/src/` and `bot/`

---

## Changes Since Last Review (2026-05-11 → 2026-05-22)

| Area | What Changed | Story Impact |
|------|-------------|-------------|
| **Multi-provider LLM** | `bot/llm_client.py` added — supports OpenAI, Anthropic, Gemini, Groq selectable via `LLM_PROVIDER` env var | US04: closes the "OpenAI only" gap |
| **Keyword PromQL catalog** | Prometheus provider now maps alert name keywords (cpu, disk, memory, network, latency, errors) to targeted PromQL queries, with label injection per instance | US03: closes the "alert-type-to-diagnostic mapping" gap |
| **Graceful telemetry pipeline** | Diagnostics failure no longer blocks the pipeline; `telemetry_available` flag set; AI RCA always runs even without telemetry | US03, US04: more resilient pipeline |
| **Context resolution** | `_resolve_context()` in `alert_handler.py` picks the best label from a priority chain (namespace → instance → service → job → cluster → region → host → pod) | US01: richer incident context |
| **Archive overhaul** | Delete flow, search/filter/sort, pagination (20/page), report cache, live auto-refresh via state subscriber, duration uses `alert_starts_at` | US06: significant UX improvement |
| **Control Room remediation** | Removed broken "Approve Execution" button; now shows AI-generated `suggested_remediation` as read-only suggestion | US05: button removed (no regression in execution — it never worked) |
| **Unconfigured LLM UX** | When no API key set, RCA returns a clear "Not Configured" message pointing to Settings instead of silent mock | US04: better operator experience |
| **Documentation** | `pages/` folder with full documentation for Archive, Control Room, Active Incidents, and Dashboard views | Non-story |

---

## Executive Summary

SRE Copilot is an AI-assisted multi-infrastructure incident management platform. The story artifacts define 8 user stories across incident detection, Teams notifications, diagnostics, AI RCA, runbook automation, post-mortem reporting, pod management, and chaos engineering.

**Overall alignment: 8.1 / 10** *(up from 7.5 on 2026-05-11)*

The core incident pipeline (US01 → US06) is strong and has improved materially since the last review. Multi-provider LLM support (US04) and the keyword PromQL catalog (US03) close two previously noted gaps. The archive UI (US06) is now production-quality. The two remaining critical gaps are unchanged: **runbook execution is still a stub** and **there is no persistent storage**. Authentication is still absent.

| Story | Title | Score | Delta | Status |
|-------|-------|-------|-------|--------|
| US01 | Incident Detection | 9/10 | → | No change |
| US02 | Teams Notification | 7/10 | → | No change |
| US03 | Automated Diagnostics | 9/10 | ↑ +1 | Keyword PromQL + graceful failure |
| US04 | AI RCA | 9/10 | ↑ +1 | Multi-provider LLM built |
| US05 | Runbook Automation | 4/10 | → | Still a stub; Approve button removed |
| US06 | Post-Mortem Report | 7/10 | → | Archive UX improved; persistence still missing |
| US07 | Pod Management | 9/10 | → | No change |
| Chaos | Chaos Engine | 9/10 | → | No change |

---

## US01 — Incident Detection

### Original Story
> As a System Administrator / SRE, I want the bot to automatically receive and parse alerts from Kubernetes (via Alertmanager) so that I don't have to manually monitor dashboards.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Expose webhook endpoint `/alerts/webhook` | ✅ | `POST /api/v1/alerts/webhook` — live in `bot/alert_handler.py` |
| 2 | Accept standard Alertmanager JSON payload | ✅ | Parses version 4 Alertmanager schema: `alertname`, `labels`, `annotations`, `status`, `startsAt`, `fingerprint` |
| 3 | Parse `alertname`, `severity`, `namespace`, `pod`, `status` | ✅ | All parsed; context resolved via `_resolve_context()` with priority chain: namespace → instance → service → job → cluster → region → host → pod |
| 4 | Log incoming alerts for auditing | 🟡 | Python `logging` used — functional but not a formal audit trail; no persistent log store |

### What Was Built Beyond the Story
- **Deduplication**: fingerprint-based dedup with `dedup_count` tracking
- **Re-fire detection**: if an alert re-fires after resolution, `start_time` and `alert_starts_at` are reset
- **Synthetic test alert**: `POST /api/v1/alerts/test` for dev/chaos purposes
- **Noise reduction pre-processing**: CEL filter rules and maintenance windows evaluated before incident creation
- **Context label priority chain**: richer than the story's "namespace/pod" — picks the most meaningful label from 10 candidates

### Gaps / Risks
- **No persistent audit log**: Only Python `logging`. Process restart loses all history. Compliance risk.
- **No schema validation**: Alertmanager payload trusted as-is; malformed payloads could cause silent failures.

### Product Owner Recommendation
- Open tech debt story: **"Persist alert audit log to file/database"**
- Add Pydantic schema validation on the webhook endpoint

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
- Teams card includes RCA summary and suggested remediation (beyond original spec)
- Simulation Mode warning in UI header

### Gaps / Risks *(unchanged since last review)*
- **MS Graph API not implemented**: Every notification creates a new card. No threading. Breaks follow-up UX on mobile.
- **No retry logic**: If the webhook POST fails, the notification is silently dropped.
- **Single channel**: All alerts go to one Teams channel. No per-severity routing.

### Product Owner Recommendation
- **High priority**: Implement Graph API threading — table-stakes for enterprise on-call.
- Add webhook POST retry with exponential backoff (3 attempts).
- Future: per-severity channel routing.

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

### What Was Built Beyond the Story *(updated)*
- **Keyword PromQL catalog**: `prometheus_provider.py` maps alert-name keywords to targeted metric queries. Categories: `cpu`, `memory`, `disk`, `network`, `latency`, `errors`, `down`. Falls back to a general set if no keyword matches.
- **Label injection**: `_inject_filter()` adds `instance` or `namespace` labels into every PromQL selector, scoping queries to the affected host.
- **Graceful telemetry failure**: `telemetry_available` flag tracks outcome; AI RCA always runs even with no telemetry. Control Room shows an amber "NO TELEMETRY" badge and a warning banner instead of blocking.
- **Multi-provider fallback**: K8s → Prometheus → LocalMachine. Story only mentioned K8s.
- **Alert-type-to-diagnostic mapping**: Now implemented via keyword catalog (was only noted as desired in the previous review).

### Gaps / Risks
- **Demo-mode failure**: When K8s not configured and Prometheus returns no data, the fallback chain reaches LocalMachine (psutil). Reasonable for dev, but misleading in a customer demo.
- **No RBAC documentation**: No K8s RBAC manifest in the repo. Deployment gap, not a code gap.

### Product Owner Recommendation
- Add `DEPLOYMENT.md` with K8s RBAC manifest (ServiceAccount, ClusterRole, ClusterRoleBinding)
- Open story: **"Diagnostic dry-run / connectivity check on connector save"**

---

## US04 — AI Root Cause Analysis

### Original Story
> As an SRE On-Call Engineer, I want an AI component to analyze alert details and collected diagnostics so that I can quickly get a summarized hypothesis for root cause.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Send alert context + diagnostics to LLM | ✅ | `ai_analysis.py` sends labels, annotations, raw_diagnostics to configured LLM |
| 2 | Structured response: Summary, Root Causes, Next Steps | ✅ | Prompt enforces Markdown with "Root Cause Hypothesis" and "Suggested Remediation" sections |
| 3 | Forward analysis to MS Teams | ✅ | RCA (truncated to 1000 chars) embedded in Teams Adaptive Card |
| 4 | Analysis generated within <30 seconds | ✅ | Async pipeline; typical latency 3–8s (provider-dependent) |

### What Was Built Beyond the Story *(updated)*
- **Multi-provider LLM** (`bot/llm_client.py`): OpenAI (gpt-4o), Anthropic (claude-sonnet-4-6), Gemini (gemini-2.0-flash), Groq (llama-3.3-70b-versatile). Selectable via `LLM_PROVIDER` env var; model overridable via `LLM_MODEL`. This closes the "OpenAI only" gap from the previous review.
- **Unconfigured LLM UX**: When no API key is set, returns a formatted "AI Analysis Not Configured" message with a direct link to Settings — not a silent mock.
- **`_extract_remediation()`**: Pulls the first remediation step from the RCA and stores it separately as `suggested_remediation` for display in the Control Room remediation card.
- **UI rendering**: RCA displayed as rendered Markdown in Control Room (using `marked`).
- **Temperature 0.2**: Deterministic, reproducible outputs.

### Gaps / Risks
- **No local/on-premise LLM**: Groq (cloud) hosts Llama 3, but there is no Ollama/local Llama integration. Customers with strict data-residency requirements still cannot use a fully on-premise setup.
- **Max tokens 500**: Complex incidents with long diagnostics may produce truncated RCA. No UI indicator when output is cut off.
- **`GPT-4o Vision` badge**: The Control Room card header still hardcodes "GPT-4o Vision" regardless of the actual configured provider.
- **No source citations**: The AI prompt does not enforce referencing specific log lines or events.

### Product Owner Recommendation
- Add an Ollama integration to `llm_client.py` for true on-premise support
- Fix the hardcoded "GPT-4o Vision" badge — replace with `active_provider_info()` call
- Raise `max_tokens` to 800–1000 for complex incidents

---

## US05 — Runbook Suggestions and Automation

### Original Story
> As an SRE On-Call Engineer, I want the system to suggest or automatically execute predefined runbooks based on alert type so that known issues can be mitigated faster.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Repository of predefined runbooks (Python/Ansible/bash) | ❌ | No actual runbook scripts exist; only hardcoded suggestion strings |
| 2 | Map alert names to runbooks | 🟡 | `runbook_executor.py` maps 4 alert names to text strings. No real mapping table or script library. |
| 3 | Present runbook as clickable action in Teams | 🟡 | Teams card shows runbook action text; no interactive "click to execute" button |
| 4 | Execute runbook upon user action | ❌ | No actual script, kubectl, or Ansible is run. The Control Room "Approve Execution" button was removed in this review cycle. |
| 5 | Report success/failure back to Teams | 🟡 | Teams notified of "Mitigation Applied" but with no real execution outcome |

### Notable Change Since Last Review
The Control Room remediation panel was redesigned. The "Approve Execution" button (which was broken — caused a 422 error due to missing `rca_summary` field) was removed. The panel now shows the AI-generated `suggested_remediation` text as **read-only**, with a disclaimer: *"Suggestion only — all actions must be performed manually by an on-call engineer."* This is a UX improvement but does not move the story forward.

### Gaps / Risks *(unchanged)*
- **This remains the biggest gap in the product.** The core value proposition — "click to fix" — is not delivered.
- No runbook library (no Python scripts, Ansible playbooks, or bash)
- No real execution path of any kind

### Product Owner Recommendation
- **High priority sprint**: Build the first 3 real runbooks using the existing Kubernetes provider:
  1. Restart pod (`kubectl rollout restart deployment/<name>`)
  2. Scale deployment (`kubectl scale deployment/<name> --replicas=N`)
  3. Automated log capture to file
- Re-introduce the approval UI once execution is real — the human-in-the-loop gate is the right design
- Open dedicated epic: **"Runbook Library v1"**

---

## US06 — Incident Timeline and Post-Mortem Report

### Original Story
> As an SRE Manager, I want the system to automatically generate a post-incident timeline and report so that the team can conduct efficient post-mortems without manual data compilation.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Log timestamps for all pipeline stages | ✅ | `TimelineEvent` objects added at: alert fire, telemetry collection, AI RCA, runbook, resolution |
| 2 | Compile chronological timeline on resolution | ✅ | Timeline manager builds event list; sorted by timestamp |
| 3 | AI summarizes entire event into Markdown report | ✅ | Report generated on `status = resolved` for high/critical/page/warning severity |
| 4 | Save report to directory or send via email/Teams | 🟡 | In memory only; shown in Archive UI; not saved to disk or emailed |

### Archive UX Improvements Since Last Review
The Archive page was substantially overhauled and is now production-quality:
- Search by name, ID, or context; severity and sort filters; state persisted across navigation
- Pagination (20 per page)
- Delete individual incidents with confirmation dialog
- Report modal with cached API call (no refetch on re-open)
- Live auto-refresh when incidents resolve while the view is open
- Duration uses `alert_starts_at` (original fire time) over `start_time`

These improvements do not close the story ACs (no persistence, no email), but the surface for reviewing reports is now solid.

### Gaps / Risks *(unchanged at AC level)*
- **No persistence**: Backend restart loses all history. Archive is unreliable for real post-mortem use.
- **No email delivery**: Story mentions email — not implemented.
- **24h expiry**: Reports disappear after 24 hours. Teams typically review incidents 2–5 days later.

### Product Owner Recommendation
- **Critical for enterprise**: Implement file-based or SQLite persistence for resolved incidents on resolution
- Minimum viable: write `./data/incidents/{date}/{incident_id}.json` on resolution
- Email delivery can follow; persistence cannot wait

---

## US07 — Pod Inventory and Fleet Management

### Original Story
> As an SRE, I want a real-time registry of all pods in my cluster so that I can quickly assess fleet health and take manual corrective actions without kubectl.

### Acceptance Criteria vs Implementation

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | Tabular view of all pods across namespaces | ✅ | Pods page with 11-column table |
| 2 | Metadata: Name, Namespace, Kind, Node IP, Age | ✅ | All present |
| 3 | Health signals: Status, Restart count, CPU/Memory | ✅ | Status with colored dot, Restarts (orange if >0), CPU/Memory columns |
| 4 | Namespace filtering | ✅ | Dropdown filter, auto-populated |
| 5 | YAML inspection | ✅ | Modal terminal with rendered pod YAML |
| 6 | Delete/restart pod with confirmation | ✅ | Delete with `confirm()`; `DELETE /api/v1/pods/{ns}/{name}` |
| 7 | Multi-cluster transparency | 🟡 | Cluster column shown; limited to one cluster in demo |

### Gaps / Risks *(unchanged)*
- No dedicated "Restart" button — delete is present but rollout restart is separate
- CPU/Memory empty if metrics-server not installed
- Multi-cluster aggregation unverified with two real connectors

### Product Owner Recommendation
- Add a "Restart" button (rollout restart) distinct from delete
- Add metrics-server availability check with tooltip
- Validate multi-cluster with two real connectors before claiming complete

---

## Chaos Engine Stories

### Acceptance Criteria vs Implementation *(unchanged)*

| Story | Criterion | Status | Evidence |
|-------|-----------|--------|----------|
| US1 | Toggle simulation via API or UI | ✅ | `POST /api/v1/chaos/trigger`; toggle buttons per scenario |
| US2 | Registry pattern for new scenarios | ✅ | `chaos_manager.py` registry; UI renders all scenarios dynamically |
| US3 | Visual simulation indicator | ✅ | Orange "⚠️ Simulation Mode" badge in header; `state.isSimulationMode` flag |
| US4 | "Stop All Chaos" single action | ✅ | "Global Restoration" button |

### Gaps / Risks *(unchanged)*
- Chaos scenarios only inject fake alerts — no real infrastructure disruption
- New scenarios require code change, not a UI/config operation

### Product Owner Recommendation
- Document clearly: Chaos Engine v1 is "alert simulation", not "infrastructure disruption"
- Open future story: **"Chaos Engine v2 — Real Infrastructure Disruption via LitmusChaos"**

---

## Cross-Cutting Gaps

| Gap | Severity | Status |
|-----|----------|--------|
| No persistent storage | 🔴 Critical | **Unchanged** — all incidents lost on restart |
| No authentication/authorization | 🔴 Critical | **Unchanged** — zero auth on UI and API |
| No RBAC | 🟠 High | **Unchanged** |
| In-memory connector store | 🟠 High | **Unchanged** — `connectors.json` is the only persistence |
| No audit trail | 🟠 High | **Unchanged** |
| Local LLM fallback (Ollama) | 🟡 Medium | **Partially mitigated** — Groq (cloud-hosted Llama 3) added; true on-premise still missing |
| Email notifications | 🟡 Medium | **Unchanged** |
| Hardcoded "GPT-4o Vision" badge | 🟡 Medium | **New** — badge doesn't reflect actual configured LLM |
| Predictive anomaly detection | 🟡 Medium | **Unchanged** — roadmap item, not started |
| `prefers-reduced-motion` | 🟢 Low | **Unchanged** |

---

## Feature Scope Drift (Built Beyond Stories)

| Feature | Location | Impact | Status |
|---------|----------|--------|--------|
| Noise Reduction (CEL rules + dedup + maintenance windows) | `bot/noise_reduction.py`, Rules page | High | No backfill story yet |
| Multi-Infrastructure Connectors | Settings page, `bot/providers/` | High | No backfill story yet |
| CEL Playground | Rules page | Medium | No backfill story yet |
| Control Room (Bento Grid UI) | `frontend/src/views/ControlRoom.js` | High | No backfill story yet |
| WebSocket real-time patching | `bot/ws_manager.py`, `main.js` | High | No backfill story yet |
| Multi-provider LLM client | `bot/llm_client.py` | High | **New since last review** — no backfill story |
| Keyword PromQL catalog | `bot/providers/prometheus_provider.py` | High | **New since last review** — no backfill story |
| Archive delete + pagination + cache | `frontend/src/views/Archive.js` | Medium | **New since last review** |
| Dashboard KPI cards + Activity Feed | Dashboard view | Medium | No backfill story yet |

**Recommendation:** The multi-provider LLM client and the PromQL catalog are high-value differentiators — write backfill stories and acceptance criteria for both.

---

## Priority Action Items for Product Owner

### Immediate (Next Sprint)
1. **Open story: "Implement basic incident persistence"** — SQLite or file-based. Without this, the product cannot be used in production.
2. **Open story: "Add API authentication"** — Bearer token minimum. The open API is a security liability.
3. **Open story: "Build Runbook Library v1"** — 3 real runbooks. Closes the biggest promise-vs-reality gap.

### Short Term (Next 2 Sprints)
4. **Open story: "MS Teams Graph API threading"** — Critical for on-call UX.
5. **Fix: "GPT-4o Vision badge"** — Replace hardcoded text with `active_provider_info()` — 1-line fix.
6. **Backfill story: "Multi-provider LLM Engine"** — Document and formalize AC for provider selection, model override, key validation, unconfigured UX.
7. **Backfill story: "Keyword-based Diagnostic Targeting"** — Document AC for PromQL catalog, label injection, fallback behavior.
8. **Backfill story: "Noise Reduction Engine"** — CEL rules, dedup, maintenance windows.
9. **Open story: "Diagnostic dry-run on connector save"** — Validate K8s/Prometheus connectivity before saving.

### Medium Term (Roadmap)
10. **Open story: "Local LLM support (Ollama)"** — VPP commitment for data-residency customers. Groq is cloud; not a substitute.
11. **Open story: "Chaos Engine v2 — Real Infrastructure Disruption"** — LitmusChaos integration.
12. **Open story: "Audit Log"** — Who did what, when. Enterprise compliance requirement.

---

## Alignment Score by Story

| Story | Previous Score | Current Score | Change |
|-------|---------------|---------------|--------|
| US01 — Incident Detection | 9/10 | 9/10 | → |
| US02 — Teams Notification | 7/10 | 7/10 | → |
| US03 — Automated Diagnostics | 8/10 | 9/10 | ↑ Keyword PromQL, graceful telemetry |
| US04 — AI RCA | 8/10 | 9/10 | ↑ Multi-provider LLM built |
| US05 — Runbook Automation | 4/10 | 4/10 | → Still a stub; approve button removed |
| US06 — Post-Mortem Report | 7/10 | 7/10 | → Archive UX much better; persistence still missing |
| US07 — Pod Management | 9/10 | 9/10 | → |
| Chaos Engine | 9/10 | 9/10 | → |
| **Overall** | **7.5/10** | **8.1/10** | **↑ +0.6** |
