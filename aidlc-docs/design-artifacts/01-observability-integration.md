# Design Unit 1: Observability Integration

## Overview
This unit is responsible for detecting anomalies in the Kubernetes cluster using the `kube-prometheus-stack` and pushing those alerts to the SRE Copilot Incident Bot.

## Cohesion & Coupling
- **Cohesive:** Focuses purely on metric alerting and webhook dispatching.
- **Loosely Coupled:** It does not know about AI, Runbooks, or Teams. It simply fires a standard JSON payload via Alertmanager webhook to the Bot's API endpoint.

## Components
1. **Prometheus / Alertmanager Configuration:** Kubernetes manifestations (e.g. `PrometheusRule`, `AlertmanagerConfig`) needed to define alerts (e.g., High CPU, Pod Crash) and route them to the bot webhook.

## Related User Stories
- US01: Incident Detection
