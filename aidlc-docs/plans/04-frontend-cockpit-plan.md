# SRE Copilot — Frontend Cockpit: Implementation Plan (v4 — Final Implementation)

**Date:** 2026-04-26  
**Status:** ✅ Implemented  
**Framework:** Vite + Vanilla JavaScript (SPA), Tailwind CSS

---

## Architecture (As Implemented)

The frontend is a Single Page Application (SPA) built with Vite for speed and Vanilla JS for maximum control over DOM manipulations and WebSocket integrations.

### Core Structure
```
sre-copilot/
└── frontend/
    ├── index.html                    # Main entry point with Tailwind CDN
    ├── src/
    │   ├── main.js                   # Application logic & View rendering
    │   ├── style.css                 # Custom styles & Tailwind components
    │   └── assets/                   # Media & Icons
    ├── package.json
    └── vite.config.js
```

### Components & Views (Logic in `main.js`)
- **Global State**: Managed via a reactive `state` object in `main.js`.
- **WebSocket Manager**: Connects to `/api/v1/ws/alerts` for real-time updates.
- **View Renderers**:
    - `renderActiveIncidentsView`: The "Industrial Command Center" table.
    - `renderControlRoomView`: The deep-dive triage room with RCA and Diagnostics.
    - `renderArchiveView`: Filterable ledger of resolved incidents.
    - `renderChaosView`: Simulation controls.
    - `renderPodsView`: Resource Registry with metrics.
- **UI Elements**:
    - `showReportModal`: Renders post-mortem Markdown reports.
    - `SeverityBadge`: Coloured pills for incident severity.
    - `ConfirmModal`: Human-in-the-loop approval before runbook execution.

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
