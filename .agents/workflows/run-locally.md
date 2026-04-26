# Run SRE Copilot Locally

This guide provides three ways to run SRE Copilot: **Docker Compose** (fastest), **Kubernetes/Minikube** (prod-like), and **Manual** (best for development).

## 🛠️ Prerequisites

Before starting, ensure you have:
- **Docker & Docker Compose** (for Methods A & B)
- **Minikube & kubectl** (for Method B)
- **Python 3.11+ & Node.js 20+** (for Method C)
- **OpenAI API Key** (required for AI Analysis)

---

## ⚙️ Step 0: Environment Configuration

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
PROMETHEUS_URL=http://localhost:9090
MONITORED_SERVICES=nginx,python,node,uvicorn
```

---

## 🚀 Method A: Docker Compose (Fastest)

This starts both the **Backend (Bot)** and the **Frontend (Dashboard)** in containers.

// turbo
```bash
docker-compose up --build
```

- **Dashboard**: [http://localhost:5173](http://localhost:5173)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## ☸️ Method B: Kubernetes (Minikube)

Use this to test Kubernetes-native features like Pod diagnostics and RBAC.

1. **Start Minikube**:
   // turbo
   ```bash
   minikube start
   eval $(minikube docker-env)
   ```

2. **Build & Deploy**:
   // turbo
   ```bash
   docker build -t sre-copilot:local ./bot
   kubectl apply -f k8s/
   kubectl rollout status deployment/sre-copilot
   ```

3. **Port Forward**:
   ```bash
   # Backend API
   kubectl port-forward svc/sre-copilot-svc 8000:8000
   ```

*Note: In this mode, the frontend must be run manually (see Method C) or by building the frontend and mounting it to the bot.*

---

## 💻 Method C: Manual Development

Best for active coding with Hot Module Replacement (HMR).

1. **Start Backend**:
   // turbo
   ```bash
   cd bot
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn bot.main:app --reload --port 8000
   ```

2. **Start Frontend**:
   // turbo
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## ✅ Verification & Testing

### 1. Check API Health
```bash
curl http://localhost:8000/health
```

### 2. Fire a Simulated Alert
Trigger the AI diagnostic pipeline:
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "version": "4",
  "status": "firing",
  "alerts": [{"labels": {"alertname": "HighCPUUsage", "severity": "critical"}}]
}' http://localhost:8000/api/v1/alerts/webhook
```

### 3. Test Chaos Engineering
Visit the Dashboard, navigate to the **Chaos Engine** tab, and toggle "Node Outage" to see real-time metric manipulation.

---

## 📝 Notes
- **Mock Mode**: If `OPENAI_API_KEY` is not set, the bot falls back to mock RCA summaries.
- **Teams Notifications**: Set `TEAMS_WEBHOOK_URL` in `.env` to receive Adaptive Cards.
