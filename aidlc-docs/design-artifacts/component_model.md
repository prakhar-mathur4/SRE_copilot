# Component Model Design

## Overview
This document outlines the internal component architecture for the SRE Copilot system. The components are designed to be cohesive, loosely coupled, and responsibilities are distinctly separated across the defined Design Units.

## Core Components

### 1. Incident Bot (API Gateway & Event Router)
- **Role**: Receives webhooks from Alertmanager and serves as the central router for the application.
- **Sub-components**:
  - **Webhook Receiver (FastAPI Router)**: Exposes endpoints like `/api/v1/alerts` to receive JSON payloads.
  - **Payload Validator**: Uses Pydantic to validate incoming Alertmanager payloads.
  - **Event Dispatcher**: Routes the validated alert to the appropriate internal services (Notifier, Timeline, Diagnostics).

### 2. Teams Notifier
- **Role**: Handles formatting and dispatching messages to Microsoft Teams.
- **Sub-components**:
  - **Message Formatter**: Converts raw alert data into visually rich formats (e.g., Adaptive Cards with color-coding for severity).
  - **Teams Client**: Handles HTTP requests to the MS Teams webhook URL or Graph API.

### 3. Diagnostics Engine
- **Role**: Retrieves contextual logs, metrics, and state information from the Kubernetes cluster based on the alert.
- **Sub-components**:
  - **K8s API Client**: Connects to the EKS cluster (using `kubernetes` python client) to fetch Pod state, Events, and resource metrics.
  - **Prometheus/Grafana Client**: Fetches specific metric queries related to the failing service.
  - **Data Aggregator**: Compiles the gathered data into a structured format for the AI Analyzer.

### 4. AI Analyzer
- **Role**: Consumes the alert context and diagnostic data to perform Root Cause Analysis (RCA) and suggest remediation steps.
- **Sub-components**:
  - **Prompt Builder**: Constructs the LLM prompt combining the incident data, guidelines, and context.
  - **LLM Client**: Interfaces with the AI provider (e.g., OpenAI, Anthropic, or local model).
  - **Response Parser**: Extracts structured insights and actionable runbook parameters from the generated text.

### 5. Runbook Executor
- **Role**: Executes pre-defined remediation scripts or tools based on AI recommendations or manual triggers.
- **Sub-components**:
  - **Execution Engine**: Sandboxed runner for executing shell scripts, Python scripts, or Kubernetes jobs.
  - **Secrets Manager**: securely injects required credentials/tokens into the runbooks.
  - **Result Reporter**: Feeds execution outcomes back to the Timeline Service.

### 6. Timeline Service
- **Role**: Tracks the lifecycle of an incident and generates reports upon resolution.
- **Sub-components**:
  - **State Manager**: Maintains the active incidents (in-memory for MVP, progressing to persistent DB like Redis/Postgres).
  - **Event Logger**: Records milestones (e.g., Alert Triggered -> Diagnostics Gathered -> Teams Notified -> RCA Complete -> Runbook Executed -> Resolved).
  - **Report Generator**: Compiles the timeline events into a detailed Markdown post-mortem report.

### 7. Dashboard Cockpit (Frontend)
- **Role**: Single-pane-of-glass for incident monitoring and cluster management.
- **Sub-components**:
  - **Incident Feed**: Real-time view of active incidents via WebSockets.
  - **Pod Inventory Registry**: Tabular management interface for K8s pods.
  - **Chaos Control Panel**: Interface to trigger and monitor simulations.
  - **Diagnostic/RCA Viewer**: Markdown-rendered views of AI insights and cluster state.

### 8. Chaos Engineering Engine
- **Role**: Simulates failures to test observability and response pipelines.
- **Sub-components**:
  - **Scenario Registry**: Catalog of predefined failures (Node Outage, CPU Spike).
  - **State Interceptor**: Middleware that modifies real metrics/health responses to simulate failure states.
  - **Simulation Manager**: Handles the lifecycle and duration of active chaos scenarios.

## Data Flow & Interaction
1. **Alert Received**: `Alertmanager` -> `Incident Bot`
2. **State Tracking**: `Incident Bot` informs `Timeline Service` (Event: Alert Triggered)
3. **Notification**: `Incident Bot` -> `Teams Notifier` (Sends Initial Alert)
4. **Data Gathering**: `Incident Bot` -> `Diagnostics Engine` -> Returns Context
5. **Analysis**: Context sent from `Incident Bot` -> `AI Analyzer` -> Returns RCA + Runbook Suggestion
6. **Live Update**: `Incident Bot` broadcasts state changes to `Dashboard Cockpit` via WebSockets.
7. **Action**: `Runbook Executor` is triggered via `Dashboard Cockpit` (manual approval). Outcome is logged and broadcasted.
8. **Resolution**: `Alertmanager` sends RESOLVED -> `Incident Bot` -> `Teams Notifier` & `Timeline Service` (Generates Final Report).
