# 🎙️ SRE Copilot — Command Center Demo Guide

A scripted walkthrough for demonstrating the **SRE Copilot** dashboard to stakeholders.

> **Design principle to repeat throughout the demo:** SRE Copilot is **suggest-only / human-in-the-loop**. The AI diagnoses, summarizes, and *recommends* — but **every remediation is executed manually by the on-call engineer**. There is no auto-remediation. This is a deliberate safety guarantee, not a missing feature.

---

## 🏗️ Pre-Demo Setup

### Option A — Full stack (backend on Kubernetes + dashboard)

```bash
# 1. Start Minikube & point Docker at it
minikube start && eval $(minikube docker-env)

# 2. Build and deploy the bot (Deployment: sre-copilot, Service: sre-copilot-svc)
docker build -t sre-copilot:local ./bot
kubectl apply -f k8s/
kubectl rollout status deployment/sre-copilot

# 3. Port-forward the backend API (keep running in a separate terminal)
kubectl port-forward svc/sre-copilot-svc 8000:8000
```

### Option B — Local backend (faster for a UI-focused demo)

```bash
cd bot
# (use the bot's virtualenv / requirements)
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Start the dashboard (frontend)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

> **Config notes**
> - Frontend talks to the backend at `http://localhost:8000/api/v1` and the live WebSocket `ws://localhost:8000/api/v1/ws/alerts` (see `frontend/src/utils/api.js`).
> - `OPENAI_API_KEY` powers the AI RCA. If it's missing or rate-limited, the system **falls back to a mock analysis** — the demo flow stays identical.
> - `TEAMS_WEBHOOK_URL` enables real Teams notifications; without it, a mock notification is logged.

---

## 🧭 The Command Center at a Glance

The left sidebar is the single pane of glass. Each nav item is a live, backend-driven view:

| Nav item | What it shows |
| --- | --- |
| **Global Dashboard** | KPIs (alerts received / suppressed / processed in 24h, critical / warning / info counts) + the **Fleet Telemetry Matrix** (Golden Signals per registered environment) |
| **Active Incidents** | Live, WebSocket-driven incident table — click any row to open the Control Room |
| **Runbooks** | Library of runbook pages (Confluence-backed), opened in a slide-up modal |
| **Archive** *(“Post-Mortem Ledger”)* | Resolved incidents, with delete-from-memory |
| **Chaos Engine** *(“Chaos Control”)* | Manual alert injection to exercise the RCA pipeline |
| **Rules & Suppression** | Noise filters, maintenance windows, and live CEL rule evaluation |
| **Resource Inventory** *(“Resource Registry”)* | Live pod listing, YAML inspection, pod termination |
| **SSL Monitor** | Domain certificate tracking + on-demand SSL checks |
| **Connectors & Keys** *(“Settings”)* | Register infrastructure connectors and manage environment keys |

**Top bar (always visible):**
- **View title** + a **connection-status dot** — green when the WebSocket is live.
- **“Fire Alert”** button — opens a panel to inject a synthetic alert (Probe K8s, Probe Local/VM, or a Simulated Incident).
- **Manual refresh** button.

---

## 🎭 The Demo Script: "Silence to Sev-1"

### Step 1 — The Calm Before the Storm
- **Action:** Open the **Global Dashboard**.
- **Narrative:** *"This is the SRE Copilot Command Center. The KPI strip up top shows our 24-hour alert volume — how many we received, how many we auto-suppressed as noise, and how many became real incidents. Below, the Fleet Telemetry Matrix gives us Golden Signals for every registered environment."*
- **Visual:** Point out the **green connection dot** in the top bar — the dashboard is streaming live over a WebSocket. If no infrastructure is registered yet, the matrix says *"No infrastructure registered — go to Settings to add connectors."*

### Step 2 — Show Noise Reduction (optional, great for skeptics)
- **Action:** Open **Rules & Suppression**.
- **Narrative:** *"Before any AI runs, we cut noise. Here we manage suppression filters and maintenance windows, and we can evaluate CEL expressions live against alert payloads. The 'suppressed' number on the dashboard comes straight from this engine."*

### Step 3 — Trigger an Incident
Pick whichever fits your audience:

- **Fastest (top bar):** Click **"Fire Alert"** → choose **Trigger Simulated Incident** (`SIMULATED_INCIDENT: Database Connection Leak`).
- **Pipeline-specific (Chaos Engine view):** Use **Fire Local Alert** (`LocalDiskFull`), **Fire VM Alert** (`HighCPUUsage`), or **Fire K8s Alert** (`PodCrashLooping`) — each exercises a different diagnostics provider (local psutil / Prometheus VM / Kubernetes).
- **External-source realism (terminal):** Simulate an Alertmanager webhook directly:
  ```bash
  curl -X POST -H 'Content-Type: application/json' -d '{
    "version": "4", "status": "firing", "receiver": "web.hook",
    "alerts": [{
      "status": "firing",
      "labels": {"alertname": "PodCrashLooping", "namespace": "default", "severity": "critical"},
      "annotations": {"description": "CrashLoopBackOff on web-api-pod"},
      "startsAt": "2026-06-03T12:00:00Z",
      "fingerprint": "demo-001"
    }]
  }' http://localhost:8000/api/v1/alerts/webhook
  ```
- **Narrative:** *"Let's simulate a real outage. Watch the Active Incidents table — no refresh needed."*
- **Visual:** Switch to **Active Incidents**; the new row appears instantly via WebSocket, with a high-contrast **severity badge**.

### Step 4 — Deep-Dive Triage (Incident Control Room)
- **Action:** Click the new incident row → the **Incident Control** view opens.
- **Narrative:** *"As the on-call SRE, I get immediate context in one screen."*
- **Visual — walk the panels:**
  - **Incident header:** Incident ID (with a one-click copy button), severity badge, and the timeline event count.
  - **Tabbed analysis pane:**
    - **AI RCA** — the AI's root-cause summary rendered as Markdown. *(If telemetry was thin, it shows a "Not enough information" banner and still gives a recommendation.)*
    - **Raw** — the raw diagnostics output.
    - **Payload** — the original alert's labels, annotations, and Alertmanager fire time.
    - **Runbook Fix** — lazy-loads an **AI-grounded runbook suggestion** for *this* incident (`/runbooks/suggest`), with a **"View Full"** button that opens the complete runbook page.
  - **Diagnostic Stream:** an always-dark terminal panel streaming the live diagnostics events — the dot **pulses** while RCA is in progress and turns solid green when complete.
  - **Event Timeline:** the chronological record of what the system did.

### Step 5 — AI Root Cause Analysis
- **Action:** Wait for the **AI RCA** tab to populate (Markdown appears; the remediation panel flips to **"Analysis Complete"**).
- **Narrative:** *"Instead of grepping logs for 20 minutes, the AI merges the alert context with the cluster diagnostics it collected, identifies the failure pattern, and writes up the root cause."*

### Step 6 — AI Suggested Remediation (human-in-the-loop)
- **Action:** Show the **AI Suggested Remediation** panel.
- **Narrative:** *"Here's the key part of our safety model. The AI gives a concrete, grounded remediation — but notice the label: 'Suggestion only — all actions must be performed manually by an on-call engineer.' We never let the AI touch production by itself. The engineer stays in control; the AI just removes the guesswork."*
- **Visual:** Read the suggestion text and point at the **"Suggestion only"** notice and the **"Analysis Complete"** badge.

### Step 7 — Resolution & Audit Trail
- **Action:** Resolve the incident, then open **Archive** (the "Post-Mortem Ledger").
- **Narrative:** *"Once handled, the incident moves to the Post-Mortem Ledger with its full timeline preserved — RCA, diagnostics, and runbook suggestion all retained for the postmortem. We've gone from alert to resolution in minutes, with a complete audit trail."*

---

## 🧩 Bonus Stops (if you have time or a technical audience)

- **Resource Inventory** — show the live **pod listing**, click into a pod to view its **YAML**, and (carefully!) demonstrate the guarded **pod termination** flow (`INITIATE TERMINATION:` confirm prompt).
- **SSL Monitor** — add a domain and run an **on-demand SSL check** to show certificate expiry tracking.
- **Connectors & Keys** — show how an environment is registered; once added, it appears in the Dashboard's Fleet Telemetry Matrix.
- **Connectivity Probes** — from the top-bar **Fire Alert** panel, run **Probe K8s** / **Probe Local** to verify the diagnostics pipeline end-to-end without a real incident.

---

## 🔧 Watching the Backend (for technical stakeholders)

Tail the bot logs while you trigger an alert to narrate the pipeline:

```bash
# On Kubernetes
kubectl logs -l app=sre-copilot --tail=40 -f
# Or locally: watch the uvicorn console
```

Point out the stages as they appear:
1. **Incident tracking** — a new incident timeline is created.
2. **Notification** — initial Teams notification sent (mock if no webhook configured).
3. **Diagnostics** — the bot collects events / pod state for the affected scope.
4. **AI RCA** — alert context + diagnostics sent to the LLM (mock fallback if no key).
5. **Runbook suggestion** — the incident is matched to a grounded runbook recommendation.

---

## 💎 Pro-Tips for a Great Demo
- **Have one incident pre-fired** so the AI RCA is already complete when you open the Control Room — then fire a second one live to show the real-time arrival.
- **Show the WebSocket frames** in browser DevTools (Network → WS) for technical audiences to prove the real-time updates.
- **Lean into the safety story:** when someone asks "does it auto-fix things?", the answer — *"No, by design; it recommends, humans execute"* — is a feature, not a limitation.
- **Mock fallback is your safety net:** if OpenAI is unavailable, the RCA still renders from the mock path, so the demo never stalls on an API hiccup.

---

## 🔚 Cleanup

```bash
kubectl delete -f k8s/
minikube stop
```
