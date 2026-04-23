# Multi-Infrastructure Scaling & Provider Architecture

## Overview
SRE Copilot has evolved from a Kubernetes-only incident bot into a **Multi-Infrastructure Observability Platform**. The backend now leverages a pluggable `DiagnosticProvider` architecture that allows the system to aggregate health metrics, resources, and diagnostics from multiple disparate environments simultaneously.

## Active Providers

### 1. Kubernetes Provider (`KubernetesProvider`)
- **Purpose**: Connects to the local `~/.kube/config` or in-cluster RBAC service account to fetch live node metrics, pod statuses, and YAML manifests.
- **Context**: Renders under the `kubernetes` context in the dashboard.

### 2. Local Machine Provider (`LocalMachineProvider`)
- **Purpose**: Utilizes `psutil` to dynamically monitor the raw host server (e.g., an EC2 instance, bare-metal server, or local Mac). It surfaces raw CPU and Memory utilization.
- **Context**: Renders under the `local-system` context.
- **Process Filtering**: By default, host machines run hundreds of background system processes. You can explicitly filter which processes are mapped into the dashboard's **Resource Registry** using the `.env` file:
  ```env
  # Only track these specific services:
  MONITORED_SERVICES=nginx,python,node,uvicorn
  ```

### 3. Prometheus Provider (`PrometheusProvider`)
- **Purpose**: Executes PromQL queries against a central metrics datastore to fetch metrics for traditional VMs or remote infrastructure.
- **Context**: Configured via the `PROMETHEUS_URL` environment variable.

## Adding a Custom Provider

To add a new data source (e.g., AWS CloudWatch, Datadog):
1. Create a new class inheriting from `bot.providers.base.DiagnosticProvider`.
2. Implement the required async methods: `get_health_metrics()`, `collect_diagnostics()`, and `list_resources()`.
3. Register the new class in `bot/providers/__init__.py`.

## Dashboard Impact
The **Industrial Command Center** dynamically maps over all connected providers:
- **Global Infrastructure Health**: Renders distinct progress bars and status indicators for each connected provider.
- **Active Incidents**: Includes a new "Context" filter to isolate alerts to a specific infrastructure slice.
- **Resource Registry**: Aggregates Kubernetes Pods and Local Processes into a unified, filterable table.
