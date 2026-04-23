# 🎙️ SRE Copilot: Industrial Command Center Demo Guide

This guide provides a scripted walkthrough for demonstrating the **SRE Copilot Industrial Command Center** to stakeholders.

---

## 🏗️ Pre-Demo Setup (The "One-Liner")

Before the demo begins, ensure the environment is ready.

1.  **Start Infrastructure & Backend**:
    ```bash
    # Start Minikube & Connect Docker
    minikube start && eval $(minikube docker-env)

    # Build and Deploy Bot
    docker build -t sre-copilot:local ./bot
    kubectl apply -f k8s/
    kubectl rollout status deployment/sre-copilot

    # Port-forward to localhost:8000 (Keep this running in background)
    kubectl port-forward svc/sre-copilot-svc 8000:8000
    ```

2.  **Start Dashboard (Frontend)**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

---

## 🎭 The Demo Script: "Silence to Sev-1"

### Step 1: The "Calm Before the Storm"
- **Action**: Show the Dashboard's **Active Incidents** view.
- **Narrative**: *"Welcome to the Industrial Command Center. Right now, our cluster `eks-production-01` is healthy. You can see the Global Cluster Health on the right—CPU and Memory are stable, and all nodes are green. This is our single pane of glass for real-time situational awareness."*
- **Visual**: Point out the **Green Status Dot** (Top Right) indicating the WebSocket is active.

### Step 2: The Incident Trigger
- **Action**: Click the **"Fire Test Alert"** button in the top right.
- **Narrative**: *"Let's simulate a real-world outage. I'm firing a `CrashLoopBackOff` alert for a critical service in the `production` namespace. Watch the table—no refresh needed."*
- **Visual**: Point to the new row appearing instantly in the table. Note the **High Contrast Severity Badge**.

### Step 3: Deep-Dive Triage
- **Action**: Click the newly created incident row.
- **Narrative**: *"As an on-call SRE, I need immediate context. I'm entering the Incident Control Room. On the left, we see the real-time Timeline—the system has already started diagnostics collection. In the center, our AI RCA engine is already analyzing the logs."*
- **Visual**: Show the **Timeline Stepper** updating and the **AI RCA Panel** with the pulsing animation ("Analyzing...").

### Step 4: AI Root Cause Analysis
- **Action**: Wait for the AI RCA to complete (Markdown appears).
- **Narrative**: *"Instead of grepping logs for 20 minutes, our AI has summarized the root cause. It identifies the failure pattern and suggests a specific mitigation based on our internal runbooks."*

### Step 5: Live Diagnostics (Optional)
- **Action**: Scroll down to the **Diagnostic Logs** terminal.
- **Narrative**: *"While the AI gives us the summary, the raw truth is right here. We're streaming the diagnostic output directly from Kubernetes into this terminal for manual verification."*

### Step 6: Targeted Remediation
- **Action**: Click **"Approve"** in the Runbook Pane, then type `CONFIRM` in the prompt.
- **Narrative**: *"The AI suggested a mitigation. I can execute it with one click. We maintain safety with a confirmation prompt. Once approved, the orchestrator handles the K8s operation."*
- **Visual**: Show the terminal scrolling with the runbook execution output and the final **"Action Successfully Executed"** status.

### Step 7: Incident Resolution
- **Action**: Go back to the **Active Incidents** list.
- **Narrative**: *"The incident is now resolved. The cluster health reflects the fix. We've gone from alert to resolution in under 2 minutes, with a full audit trail maintained in our archive."*

---

## 💎 Pro-Tips for a Great Demo
- **Dark Mode Aesthetic**: Always use a dark-themed browser or VS Code to match the "Command Center" vibe.
- **Network Tab**: If you have technical stakeholders, show the **WebSocket Frames** in the browser DevTools to prove the real-time nature of the platform.
- **Mock Fallback**: If OpenAI is rate-limited, the system automatically falls back to a mock analysis—the demo flow remains identical!
