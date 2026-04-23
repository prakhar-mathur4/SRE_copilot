# 🚀 SRE Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=flat&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Python](https://img.shields.io/badge/python-3670A0?style=flat&logo=python&logoColor=ffdd54)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)

**SRE Copilot** is a Kubernetes-native, AI-assisted Incident Management platform. It transforms noisy alerts into actionable insights by automatically gathering cluster diagnostics, performing AI-driven Root Cause Analysis (RCA), and orchestrating incident response workflows.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🕹️ Chaos Control** | Simulate node failures, CPU spikes, and memory leaks to test cluster resilience and Copilot response. |
| **📊 Industrial Command Center** | A high-density, real-time dashboard powered by WebSockets for situational awareness. |
| **🧠 AI-Driven RCA** | Leverages OpenAI GPT-4 to summarize logs and metrics into human-readable root cause hypotheses. |
| **🔍 Auto-Diagnostics** | Automatically fetches logs, pod statuses, and namespace events via the Kubernetes API. |
| **🛠️ Runbook Automation** | Maps incidents to organizational runbooks with a secure "CONFIRM" approval flow. |
| **📝 Incident Timeline** | Tracks lifecycle state transitions and generates comprehensive Markdown post-mortems. |
| **📢 Multi-Channel Alerts** | Seamless integration with MS Teams (and mock fallbacks) for instant notifications. |

---

## 📁 Repository Structure

```text
├── .agents/                # Agentic workflows and automation scripts
├── bot/                    # Core Python Application (FastAPI)
│   ├── main.py             # Entry point & app configuration
│   ├── alert_handler.py    # Background task orchestration
│   ├── chaos_manager.py    # Chaos simulation engine 🆕
│   ├── diagnostics.py      # K8s API integration logic
│   ├── ai_analysis.py      # OpenAI GPT inference engine
│   └── dashboard_router.py # API & WebSocket endpoints
├── frontend/               # Dashboard UI (Vite + Vanilla JS + Tailwind CSS)
├── k8s/                    # Kubernetes manifests (Deployment, Service, RBAC)
├── runbooks/               # Standard Operating Procedures (SOPs) for mitigation
├── tests/                  # Backend and integration tests
├── demo/                   # Demo scripts and presentation guides
└── aidlc-docs/             # Design artifacts, requirements, and user stories
```

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11, FastAPI, Pydantic, Uvicorn, Kubernetes Python Client
- **Frontend**: Vite, Vanilla JavaScript, Tailwind CSS, WebSockets
- **AI**: OpenAI `gpt-4-turbo-preview` (Async API)
- **Infrastructure**: Kubernetes (Minikube / EKS), Docker
- **Observability**: Prometheus Alertmanager integration

---

## 🚀 Quick Start (Local)

### 1. Prerequisites
- Docker & [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- `kubectl` CLI
- OpenAI API Key

### 2. Environment Setup
```bash
minikube start
eval $(minikube docker-env)
```

### 3. Deploy to Kubernetes
Update `k8s/deployment.yaml` with your `OPENAI_API_KEY`, then run:
```bash
docker build -t sre-copilot:local ./bot
kubectl apply -f k8s/
kubectl rollout status deployment/sre-copilot
```

### 4. Access the Dashboard
```bash
# Port-forward the service
kubectl port-forward svc/sre-copilot-svc 8000:8000
```
Visit `http://localhost:8000` to view the **Industrial Command Center**.

---

## 🧪 Development Workflow

For a detailed guide on running the project locally without Kubernetes or for active development, please refer to our internal workflow:

- **Local Run Workflow**: [run-locally.md](file:///.agents/workflows/run-locally.md)

### Simulated Alert Testing
You can trigger a mock alert to see the Copilot in action:
```bash
curl -X POST http://localhost:8000/api/v1/alerts/webhook \
  -H "Content-Type: application/json" \
  -d '{"version": "4", "status": "firing", "alerts": [{"labels": {"alertname": "HighCPUUsage", "severity": "critical"}}]}'
```

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Built with ❤️ by the SRE Copilot Team</p>
