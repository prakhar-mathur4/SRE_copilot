# Product Requirements Document (PRD): SRE Copilot

> **Status:** Living document — refreshed to match the implemented product.
> Each feature is tagged **[Built]** (in the codebase today), **[Partial]**
> (implemented with known gaps), or **[Planned]** (designed/intended, not yet built).
> See `AUDIT.md` for a candid assessment of production-readiness gaps and
> `AUTH_RBAC_PLAN.md` for the authentication design.

## 1. Executive Summary
SRE Copilot is an AI-native incident management platform that automates the
initial response, diagnostics, and root-cause analysis (RCA) of incidents
across Kubernetes clusters, Prometheus/VictoriaMetrics-monitored VMs, and local
hosts. It acts as an "AI SRE" bridging raw monitoring alerts and human
remediation: it ingests alerts, suppresses noise, collects diagnostics,
generates AI RCA, recommends runbooks, and presents everything in a real-time
operator cockpit — now behind a full authentication and role-based access
layer.

## 2. Target Audience
*   **SREs / DevOps / On-call Engineers**: Reduce MTTR; automate repetitive
    triage and diagnostics.
*   **Platform Engineers**: Build toward automated, self-healing infrastructure.
*   **SRE Leads / Team Admins**: Manage operator access, roles, and audit.

## 3. Core Features & Functional Requirements

### F1: Incident Response Pipeline
*   **[Built] Alert Ingestion** — two paths: a push **Alertmanager webhook**
    (`/api/v1/alerts/webhook`) and a continuous **Alertmanager poller** (~30s)
    that diffs active/resolved alerts by fingerprint.
*   **[Built] Noise Reduction** — SHA-256 dedup / storm protection, **CEL**
    filter rules, and maintenance windows, with live noise-reduction stats.
*   **[Built] Automated Diagnostics** — contextual, label-routed collection via a
    pluggable provider layer (K8s pod/node health, events, logs; PromQL instant
    + range queries; local `psutil`).
*   **[Built] AI-Driven RCA** — multi-provider LLM client (**OpenAI, Anthropic,
    Gemini, Groq**) producing a structured RCA + extracted remediation.
*   **[Partial] Runbook Automation** — runbook **recommendation** (static lookup
    + Confluence-grounded LLM suggestion) with human-in-the-loop approval is
    built; actual **execution is a stub** and gated behind approval (see AUDIT.md).

### F2: Dashboard Cockpit (10 operator views)
*   **[Built] Global Dashboard** — KPIs, cluster health, real-time activity feed.
*   **[Built] Active Incidents** — live alert/incident status and diagnostic
    progress over WebSocket.
*   **[Built] Incident Control Room** — per-incident detail: timeline, RCA,
    diagnostics, runbook suggestion.
*   **[Built] Post-Mortem Archive** — searchable/filterable resolved incidents
    with Markdown reports.
*   **[Built] Rules & Suppression** — manage filter rules, maintenance windows,
    CEL evaluation.
*   **[Built] Pod / Resource Registry** — fleet view with metrics; view YAML;
    delete pod (privileged + step-up).
*   **[Built] SSL Monitor** — domain certificate expiry/issuer tracking with
    parallel checks.
*   **[Built] Runbooks** — Confluence knowledge-base browser + modal viewer
    (DOMPurify-sanitized).
*   **[Built] Chaos Engine** — failure-simulation console to validate alerting
    and response (simulation only; clearly a test tool).
*   **[Built] Settings / Connectors** — manage infrastructure connectors and LLM
    / integration configuration (secrets are masked on read).

### F3: Authentication, Access Control & Audit *(new — was "API keys via .env")*
*   **[Built] Self-contained auth** — username/password login; first-run admin
    bootstrap with a one-time generated password and forced change; sessions in
    httpOnly+SameSite cookies; CSRF protection on mutations; login rate-limit +
    lockout.
*   **[Built] RBAC** — role ladder **Viewer → Responder → Maintainer → Admin →
    Owner**, enforced centrally on every API route and the WebSocket; UI gated
    by role.
*   **[Built] User Management** — admins create users (one-time temp password +
    forced change), change roles, enable/disable, reset, delete.
*   **[Built] Service-Account API Tokens** — admin-issued, role-scoped Bearer
    tokens for CI/automation (CSRF-exempt; cannot perform step-up ops).
*   **[Built] Step-up Re-auth** — destructive ops (pod delete, secret writes)
    require a password re-prompt.
*   **[Built] Audit Log** — auth events and privileged mutations recorded.
*   **[Built] Identity abstraction** — `IdentityProvider` seam so external SSO
    can be added without app rewrite.
*   **[Planned] Enterprise SSO** — OIDC/SAML, SCIM provisioning, multi-tenancy,
    custom roles, audit-log export.

### F4: Observability & Notifications
*   **[Built] Microsoft Teams** — Adaptive-Card notifications on incident
    lifecycle (no-op if unconfigured).
*   **[Built] WebSocket Live Feed** — authenticated real-time push to the cockpit.
*   **[Built] Post-Mortem Reporting** — auto-generated Markdown reports for
    high-severity incidents.
*   **[Planned] Additional channels** — Slack, PagerDuty/Opsgenie paging +
    escalation, on-call schedules, ack/assign workflow.
*   **[Planned] Self-observability** — `/metrics`, structured logs, poller
    heartbeat.

### F5: SLO / SLI / SLA *(planned)*
*   **[Planned] SLO definitions** (OpenSLO-style) with PromQL/MetricsQL SLIs
    computed against Prometheus/VictoriaMetrics, error-budget tracking, and
    multi-window multi-burn-rate alerts that flow back in as incidents.
*   **[Planned] SLA layer** — customer dimension, periodic attainment reports,
    breach log.

## 4. Technical Architecture & Constraints
*   **[Built] Stack** — Python/FastAPI backend; vanilla-JS + Vite + Tailwind SPA;
    WebSocket for live updates; stdlib-only auth (SQLite store, PBKDF2).
*   **[Built] Extensibility** — plugin-based **provider** architecture
    (Kubernetes, Prometheus, Alertmanager, local machine) and pluggable LLM
    providers; connector registry via `connectors.json`.
*   **[Built] Deployment** — Kubernetes manifests (`k8s/`) and Docker Compose;
    `start.sh` for local run.
*   **[Built] Security baseline** — auth on all routes + WS; explicit CORS
    allow-list; masked secrets; optional HMAC-signed webhook.
*   **[Partial] State & HA** — durable **auth/session/audit** state in SQLite;
    **incidents, timeline, dedup, and config remain in-memory singletons** →
    single-replica, lost on restart (AUDIT.md P1: externalize to Postgres/Redis).
*   **[Built] Connectivity** — cluster RBAC for K8s diagnostics; network access
    to central Prometheus/VictoriaMetrics for VM diagnostics.
*   **[Planned] Hardening** — outbound timeouts/retries, offload blocking I/O,
    durable work queue, least-privilege RBAC, CI/CD pipeline.

## 5. Quality & Testing
*   **[Built] Automated tests** — `pytest` + FastAPI `TestClient` covering auth,
    RBAC, user management, API tokens, WebSocket auth, step-up, and the webhook
    contract.
*   **[Planned] CI pipeline** — lint/type/test/build + dependency & image scans
    on PRs (currently no CI).

## 6. Success Metrics
*   **MTTR Reduction**: target 30%+ reduction in time-to-root-cause.
*   **Noise Reduction Rate**: % of alerts suppressed as duplicate/filtered.
*   **Automation Coverage**: % of incidents with an accepted AI runbook
    recommendation.
*   **Adoption / Access**: active operator accounts and role distribution.
*   **[Planned] SLO Attainment**: error-budget burn per tracked service.

## 7. Known Gaps / Non-Goals (current release)
*   Incidents and operational config are **not persisted** across restarts.
*   Runbook **execution**, chaos fault-injection, and pod-delete are
    **simulated/partial** — see AUDIT.md for the full list.
*   No enterprise SSO, paging/escalation, or SLO tracking yet (all **[Planned]**).
*   Single-replica only until state is externalized.
