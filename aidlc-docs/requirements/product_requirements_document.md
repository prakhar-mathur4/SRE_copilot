# Product Requirements Document (PRD): SRE Copilot

## 1. Executive Summary
SRE Copilot is an AI-native incident management platform designed to automate the initial response, diagnostics, and root-cause analysis (RCA) of Kubernetes-based and traditional Virtual Machine (VM) infrastructure outages. It acts as an "AI SRE" that bridges the gap between raw monitoring alerts and human remediation.

## 2. Target Audience
*   **SREs / DevOps Engineers**: Seeking to reduce MTTR and automate repetitive diagnostic tasks.
*   **Platform Engineers**: Building automated self-healing infrastructure.

## 3. Core Features & Functional Requirements

### F1: Incident Response Pipeline
*   **Alert Ingestion**: Support for standard Alertmanager webhook payloads, Grafana webhooks, and other customizable sources.
*   **Automated Diagnostics**: Contextual collection of K8s logs/events, as well as executing PromQL queries against central metrics stores (Prometheus/VictoriaMetrics) for VM-based infrastructure.
*   **AI-Driven RCA**: Integration with LLMs to generate structured incident summaries and remediation suggestions.
*   **Runbook Automation**: Ability to propose and execute remediation commands with human-in-the-loop approval.

### F2: Dashboard Cockpit
*   **Active Incidents Feed**: Real-time visualization of alert status and diagnostic progress.
*   **Pod Fleet Registry**: Unified view of cluster pods with resource metrics and management actions (Delete, View YAML).
*   **Incident Timeline**: Detailed trail of events for every incident, including diagnostic snapshots.
*   **Chaos Engineering Console**: Built-in failure simulation engine to validate alerting and responses.

### F3: Observability & Notifications
*   **Teams Integration**: Rich notifications with Adaptive Cards for Slack/Teams.
*   **Post-Mortem Reporting**: Automated generation of Markdown reports for High-severity incidents.

## 4. Technical Constraints
*   **Deployment**: Must run as a native Kubernetes application (Helm/Manifests), or as an enterprise-grade standalone application via Docker Compose for dedicated VM deployments.
*   **Connectivity**: Requires cluster-level RBAC for Kubernetes diagnostics, and network access to central metric stores (Prometheus/VictoriaMetrics) for VM diagnostics.
*   **Extensibility**: Plugin-based architecture for new diagnostic sources (e.g., K8s vs VM Provider) and runbooks.
*   **Security & Authentication**: Initial support for API keys and secrets via `.env` files, with an extensible design to integrate with Secret Managers (e.g., HashiCorp Vault) in the future.

## 5. Success Metrics
*   **MTTR Reduction**: 30%+ reduction in time to identify root causes.
*   **Automation Coverage**: % of incidents resolved with AI-suggested runbooks.
