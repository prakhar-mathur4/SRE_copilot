---
description: How to run the SRE Copilot project locally (follows the official README)
---

# Run SRE Copilot Locally

Always follow the steps exactly as documented in the project README (`/README.md`).

## Prerequisites (verify each before starting)

1. Check Docker Engine is running: `docker info`
2. Check `minikube` is installed: `minikube version`
3. Check `kubectl` is installed: `kubectl version --client`
4. Confirm `OPENAI_API_KEY` is set in `k8s/deployment.yaml` (line 27)

## Step 1 — Configure the Environment

Open `k8s/deployment.yaml` and ensure `OPENAI_API_KEY` has a real value.
Optionally set `TEAMS_WEBHOOK_URL` (leave empty `""` for mock logging).

## Step 2 — Start Minikube & Connect Docker

// turbo
```bash
minikube start
```

// turbo
```bash
eval $(minikube docker-env)
```

## Step 3 — Build the Docker Image & Deploy to Kubernetes

Build the image directly into Minikube's Docker environment:

// turbo
```bash
docker build -t sre-copilot:local ./bot
```

Apply all Kubernetes manifests (RBAC, Deployment, Service):

// turbo
```bash
kubectl apply -f k8s/
```

Wait for the pod to be ready:

// turbo
```bash
kubectl rollout status deployment/sre-copilot
```

## Step 4 — Test the Pipeline

Forward the FastAPI port to localhost:

```bash
kubectl port-forward svc/sre-copilot-svc 8000:8000
```

In a second terminal, send a simulated Alertmanager payload:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "version": "4",
  "status": "firing",
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
      "fingerprint": "123456"
    }
  ]
}' http://localhost:8000/api/v1/alerts/webhook
```

## Step 5 — Monitor Logs

```bash
kubectl logs -l app=sre-copilot -f
```

## Notes

- Swagger UI is available at: http://localhost:8000/docs
- If Kubernetes is unavailable, `diagnostics.py` automatically falls back to mock data
- For quick local testing WITHOUT Kubernetes: `uvicorn bot.main:app` (see README §Developing Locally)
