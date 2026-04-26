# 🚀 SRE Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=flat&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Python](https://img.shields.io/badge/python-3670A0?style=flat&logo=python&logoColor=ffdd54)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)

**SRE Copilot** is an AI-assisted Incident Management platform built for true multi-infrastructure scalability. It transforms noisy alerts into actionable insights by automatically gathering diagnostics across **Kubernetes clusters, Virtual Machines (via Prometheus), and Local Hosts**, performing AI-driven Root Cause Analysis (RCA), and orchestrating incident response workflows.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🌐 Multi-Infrastructure** | Pluggable Provider architecture to monitor Kubernetes, Prometheus VMs, and Local Host hardware simultaneously. |
- 🧠 **AI Root Cause Analysis**: Automated incident summaries and remediation suggestions using OpenAI.
- 🏢 **Multi-Infrastructure Support**: Pluggable provider architecture for Kubernetes, Local VMs, and Prometheus.
- 🛠️ **Runbook Automation**: Proposes and executes remediation scripts with human-in-the-loop approval.
- 📊 **Industrial Dashboard**: Real-time cockpit showing firing alerts, cluster health, and a resource registry.
- 🗂️ **Post-Mortem Archive**: Real-time search and filtering for resolved incidents with detailed Markdown reports.
- 🧪 **Chaos Engineering**: Built-in failure simulation to test observability and response pipelines.

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

- **Backend**: Python 3.11+, FastAPI, Pydantic, Uvicorn, Kubernetes Python Client, `psutil`
- **Frontend**: Vite, Vanilla JavaScript, Tailwind CSS, WebSockets, `marked`
- **AI**: OpenAI `gpt-4-turbo` (Async API) or Mock Fallback
- **Infrastructure**: Kubernetes (Minikube / EKS), Docker, Prometheus
- **Messaging**: MS Teams (Adaptive Cards)

---

## 🚀 Quick Start (Local)

### 1. Prerequisites
- Docker & [Minikube](https://minikube.sigs.k8s.io/docs/start/) (if using Kubernetes features)
- `kubectl` CLI
- Python 3.11+
- OpenAI API Key

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_key_here
PROMETHEUS_URL=http://localhost:9090  # Optional, for VM monitoring
MONITORED_SERVICES=nginx,python,node,uvicorn  # Optional, comma-separated local processes to monitor
```

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
