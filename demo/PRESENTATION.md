# 🚀 SRE Copilot: Live Demo Script

**Project Objective:** Demonstrate a Kubernetes-native AI assistant designed to intercept Prometheus alerts, gather cluster context, provide a GPT-4 Root Cause Analysis (RCA), and automatically map the incident to a mitigation strategy (Runbook).

---

## 🛠️ Phase 1: Environment Setup

_Before presenting, ensure Minikube and Docker are running, and your `OPENAI_API_KEY` is configured in `k8s/deployment.yaml`._

**Step 1. Start the cluster**
```bash
minikube start
```

**Step 2. Bind Docker daemon to Minikube**
```bash
eval $(minikube docker-env)
```

**Step 3. Build the application image locally**
```bash
docker build -t sre-copilot:local ./bot
```

**Step 4. Deploy the SRE Copilot**
```bash
kubectl apply -f k8s/
```
_Explain to the audience that this creates a ServiceAccount with read-only native API access to Pods, Events, and Deployments. It also deploys the FastAPI backend._

---

## 🏃 Phase 2: Simulating an Incident

**Step 1. Forward the Bot's API port**
Open a new terminal session and run:
```bash
kubectl port-forward svc/sre-copilot-svc 8000:8000
```
_Tell the audience: "We are exposing the webhook endpoint that Prometheus Alertmanager would normally use."_

**Step 2. Trigger the "High CPU" Alert**
In your original terminal session, simulate an incoming Alertmanager webhook:

```bash
curl -X POST -H 'Content-Type: application/json' -d '{
  "version": "4",
  "groupKey": "key",
  "status": "firing",
  "receiver": "web.hook",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighCPUUsage",
        "namespace": "kube-system",
        "severity": "warning"
      },
      "annotations": {
        "description": "CPU usage > 80% on kube-system namespace"
      },
      "startsAt": "2026-03-06T12:00:00Z",
      "fingerprint": "12345"
    }
  ]
}' http://localhost:8000/api/v1/alerts/webhook
```
_The endpoint responds instantly with a `200 OK` indicating the background processing pipeline has started._

---

## 🔍 Phase 3: Observing the AI Pipeline

Now we stream the logs of the bot to watch the automation unfold in real-time.

**Step 1. Check the live execution logs**
```bash
kubectl logs -l app=sre-copilot --tail=40 -f
```

**Step 2. Explain the log output to the audience:**

*   **Incident Tracking:** Notice `Creating new incident timeline: inc-12345`. The App is securely tracking state.
*   **Notification Stage:** `Sending initial Teams notification`. (It warns that a mock is used if the Teams Webhook isn't configured).
*   **Kubernetes Diagnostics:** `Collecting diagnostics for namespace: kube-system`. The bot reaches out to the Kubernetes API to gather all recent cluster events and failed pods inside the affected namespace.
*   **AI Engine (The Magic!):** `Sending prompt to LLM for RCA...`. The Bot merges the Alert Context + Cluster Diagnostic output and asks OpenAI for an RCA.
*   **The Output:** Point the audience to the generated Markdown. You should see it actively hypothesize the problem (e.g., *storage-provisioner failing to mount*, *metrics-server CPU spike*, etc.) and propose actionable mitigation steps!
*   **Runbook Engine:** Finally, `Runbook executed: Suggested Action...`. The Bot matches the alert to a specific, predefined organizational runbook procedure!

---

## 🔚 Phase 4: Wrap Up & Q/A
**Key Takeaways:**
1. Reduces Mean Time To Resolution (MTTR) by diagnosing cluster issues instantly.
2. Combines Kubernetes API contextual awareness with LLMs context size constraints natively.
3. Automatically notifies stakeholders and proposes immediate runbook interventions.

**Cleanup:**
```bash
kubectl delete -f k8s/
minikube stop
```
