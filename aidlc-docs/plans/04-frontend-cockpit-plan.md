# SRE Copilot — Frontend Cockpit: Implementation Plan (v4 — Alignment-Reviewed)

**Date:** 2026-03-17  
**Status:** ✅ Ready for Execution  
**Framework:** Next.js 14 (App Router, TypeScript, Tailwind CSS)

---

## Alignment Summary

All 6 User Stories and 8 Design Artifacts have been reviewed. The frontend plan is **aligned** on the core needs. The changes below incorporate discovered gaps and new requirements from the artifacts.

### Alignment Matrix

| User Story | Design Artifact | Frontend Plan Coverage | Gap / Addition |
|---|---|---|---|
| US01 — Incident Detection | DU1 Observability, DU2 Incident Bot | ✅ Dashboard shows all alerts | ➕ Add `alertname`, `pod` label display on card |
| US02 — Teams Notification | DU6 Notification System | 🟡 Teams is separate channel | ➕ Add "Teams Notification Status" indicator on incident card |
| US03 — Automated Diagnostics | DU3 Diagnostics Engine | ✅ `DiagnosticsPanel` planned | ➕ Show diagnostic source (pod-specific vs namespace events vs mocked) |
| US04 — AI RCA | DU4 AI Analyzer | ✅ `RcaPanel` planned with Markdown | ➕ AI response must show "Summary", "Possible Root Causes", "Suggested Next Steps" sections (per US04 AC) |
| US05 — Runbook Automation | DU5 Runbook Executor | ✅ `CommandPanel` planned | ➕ **Human approval required** (per US05 AC + DU5 rule) — "▶ Run" must show a confirmation modal before triggering |
| US06 — Incident Timeline & Report | DU7 Timeline System | ✅ `Timeline` component planned | ➕ Post-mortem Markdown report view; only for High/Critical severity; 24h retention indicator |

---

## Key Gaps Found & How They Are Addressed

### 1. ➕ Human Approval Confirmation Modal (US05 + DU5)
> *"We require human approval for all runbooks."*

The `CommandPanel` "▶ Run" button **must show a confirmation modal** before POSTing to `/api/v1/runbook/trigger`. This is a hard requirement from US05. Added `<ConfirmModal>` component.

### 2. ➕ Post-Mortem Report View (US06 + DU7)
> *"The AI should summarize the entire event into a Markdown report."*
> *"Reports only for High/Critical severity alerts."*

Add a **Post-Mortem Report** section at the bottom of the Incident Detail page. When an incident is `resolved` and severity is `high` or `critical`, a `<PostMortemPanel>` renders the compiled Markdown report from the backend. For lower severity incidents, show a muted "Report not generated (severity: warning)".

### 3. ➕ Teams Notification Status (US02 + DU6)
> *"When an alert is resolved, a follow-up Resolved notification should be sent to the same thread."*

Add a `TeamsStatusBadge` on each incident card: shows `Notified ✓` (green) or `Not configured` (muted) depending on whether `TEAMS_WEBHOOK_URL` is set. This surfaces in the UI so engineers know if Teams is active.

### 4. ➕ AI Response Structure (US04)
> *"The prompt must enforce a structured response: Summary, Possible Root Causes, Suggested Next Steps."*

`RcaPanel` will render those specific sections with visual hierarchy — each section gets its own styled heading within the Markdown renderer.

### 5. ➕ Pod Label Display (US01 / US03)
> *"Parse alertname, severity, namespace, pod (if applicable)."*

Incident cards and detail pages will display the `pod` label if present — currently missing from the plan.

---

## Final Architecture (Updated)

```
sre-copilot/
└── frontend/
    ├── .env.example                  # NEXT_PUBLIC_API_URL config
    ├── .env.local                    # Local dev config (gitignored)
    ├── app/
    │   ├── layout.tsx                # Root layout (NavBar, font)
    │   ├── page.tsx                  # Dashboard: incident grid + stats
    │   ├── incidents/[id]/page.tsx   # Incident detail page
    │   └── api/                      # Next.js route handlers → FastAPI proxy
    │       ├── incidents/route.ts
    │       ├── incidents/[id]/route.ts
    │       ├── alerts/test/route.ts
    │       └── runbook/trigger/route.ts
    ├── components/
    │   ├── IncidentCard.tsx          # Alert card with Teams badge + pod label
    │   ├── SeverityBadge.tsx         # Coloured severity pill
    │   ├── TeamsStatusBadge.tsx      # Teams notification status (US02) ← NEW
    │   ├── StatsBar.tsx              # Active / Critical / Resolved counts
    │   ├── HealthBadge.tsx           # Live /health endpoint badge
    │   ├── RcaPanel.tsx              # Structured Markdown RCA (US04 sections)
    │   ├── DiagnosticsPanel.tsx      # K8s diagnostics source-annotated code block
    │   ├── CommandPanel.tsx          # Free-text + shell commands + Copy button
    │   ├── ConfirmModal.tsx          # Human approval modal before Run (US05) ← NEW
    │   ├── PostMortemPanel.tsx       # Markdown post-mortem report (US06) ← NEW
    │   └── Timeline.tsx              # Chronological event trail
    ├── lib/
    │   ├── api.ts                    # Typed fetch helpers (NEXT_PUBLIC_API_URL)
    │   └── utils.ts                  # parseCommands, formatDuration, severityColor
    ├── package.json
    ├── tailwind.config.ts
    └── next.config.ts
```

---

## Backend Changes Required

New file `bot/dashboard_router.py`, registered in `bot/main.py`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/incidents` | All in-memory incidents |
| `GET` | `/api/v1/incidents/{incident_id}` | Single incident + events + report |
| `POST` | `/api/v1/alerts/test` | Fire test alert (bypass Alertmanager) |
| `POST` | `/api/v1/runbook/trigger` | Execute runbook (human-approved) |

The `GET /api/v1/incidents/{incident_id}` response should include the `report` field (Markdown post-mortem string, or `null`).

---

## Backend URL Configuration

```env
# .env.example (committed)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Local dev — FastAPI running directly
NEXT_PUBLIC_API_URL=http://localhost:8000

# Kubernetes (port-forwarded)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Kubernetes Ingress / NodePort / EKS Load Balancer
NEXT_PUBLIC_API_URL=http://<external-ip-or-hostname>
```

---

## Design System (Tailwind Extended Tokens)

| Name | Value | Use |
|------|-------|-----|
| `cockpit` | `#0d1117` | Page background |
| `surface` | `#161b22` | Cards, panels |
| `border-dim` | `#30363d` | Borders |
| `green` | `#3fb950` | Resolved / healthy |
| `amber` | `#d29922` | Warning |
| `red` | `#f85149` | Critical / firing |
| `blue` | `#58a6ff` | AI / info |
| `primary` | `#e6edf3` | Main text |
| `muted` | `#8b949e` | Secondary text |

---

## Proposed File Changes

### Back-End

#### [NEW] `bot/dashboard_router.py`
#### [MODIFY] `bot/main.py`

### Front-End (all new under `frontend/`)

#### [NEW] Core app files
- `frontend/.env.example`, `frontend/next.config.ts`, `frontend/tailwind.config.ts`, `frontend/package.json`
- `frontend/app/layout.tsx` — Root layout with NavBar
- `frontend/app/page.tsx` — Dashboard with 5s polling
- `frontend/app/incidents/[id]/page.tsx` — Full incident detail view
- `frontend/app/api/**` — Proxy route handlers

#### [NEW] Components
- `IncidentCard.tsx` — Shows pod label + Teams badge (US01, US02)
- `SeverityBadge.tsx` — Coloured pill per severity
- `TeamsStatusBadge.tsx` — Teams notification status indicator (US02)
- `StatsBar.tsx` — Active, Critical, Resolved counts
- `HealthBadge.tsx` — Live health beacon
- `RcaPanel.tsx` — Structured 3-section Markdown RCA (US04)
- `DiagnosticsPanel.tsx` — Source-annotated K8s diagnostics (US03)
- `CommandPanel.tsx` — Free-text + extracted commands + Copy (US05)
- `ConfirmModal.tsx` — Human approval before running command (US05 hard requirement)
- `PostMortemPanel.tsx` — Post-mortem report for High/Critical resolved alerts (US06)
- `Timeline.tsx` — Chronological event trail (US06)

#### [NEW] Library
- `frontend/lib/api.ts` — All typed fetch wrappers
- `frontend/lib/utils.ts` — `parseCommands`, `formatDuration`, `severityColor`, `isHighSeverity`

---

## Verification Plan

### 1. Start FastAPI Backend
```bash
cd /Users/prakharmathur/Desktop/Practise/sre-copilot
source .venv/bin/activate
uvicorn bot.main:app --reload --port 8000
```

### 2. Verify New Endpoints
```bash
curl http://localhost:8000/api/v1/incidents
# Expected: []

curl -X POST http://localhost:8000/api/v1/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"alertname":"HighCPUUsage","namespace":"kube-system","severity":"warning","fingerprint":"test-001"}'
# Expected: {"message":"Test alert queued"}

curl http://localhost:8000/api/v1/incidents
# Expected: [{incident_id:"inc-test-001", ...}]

curl http://localhost:8000/api/v1/incidents/inc-test-001
# Expected: full incident object with events[]
```

### 3. Start Frontend
```bash
cd /Users/prakharmathur/Desktop/Practise/sre-copilot/frontend
cp .env.example .env.local
npm install && npm run dev
# Open http://localhost:3000
```

### 4. Manual UI Verification
- [ ] Dark cockpit dashboard loads
- [ ] Health badge shows green "Healthy"
- [ ] Stats bar shows correct counts
- [ ] Incident card for `HighCPUUsage` appears within 5 seconds
- [ ] Card shows severity badge (amber), namespace, pod label if present, Teams status badge
- [ ] Click "View Details" → `/incidents/inc-test-001`
- [ ] **RcaPanel**: shows "Summary", "Possible Root Causes", "Suggested Next Steps" sections
- [ ] **DiagnosticsPanel**: shows raw diagnostics in code block with source annotation
- [ ] **CommandPanel**: shows free-text suggestion AND extracted shell commands
- [ ] Copy button copies command text to clipboard with toast
- [ ] **Trigger "▶ Run"** → ConfirmModal appears before executing
- [ ] Confirm in modal → POST to runbook trigger → success/error toast
- [ ] Timeline shows all events with timestamps and source labels
- [ ] For resolved high/critical incident → **PostMortemPanel** shows Markdown report
- [ ] For warning severity resolved incident → shows muted "Report not generated"

---

## Out of Scope (this iteration)
- Authentication / login
- Persistent storage (in-memory only, 24h retention per US06)
- WebSocket / SSE
- Mobile responsiveness
- MS Graph API authenticated thread replies (US02 advanced mode)
