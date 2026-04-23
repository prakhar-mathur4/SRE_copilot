# Design Unit 3: Diagnostics Engine

## Overview
This unit is triggered by the Incident Bot when an alert is received. Its sole purpose is to connect to the Kubernetes cluster and gather contextual data (logs, events, metrics) related to the specific alert labels.

## Cohesion & Coupling
- **Cohesive:** Strictly handles Kubernetes API interactions to collect diagnostic data.
- **Loosely Coupled:** It takes standard alert labels as input and returns a structured dictionary or string of diagnostic text. It does not parse the alert meaning itself, nor does it talk to the AI or teams.
- **Security constraint:** The bot must run in a dedicated EKS namespace with restricted RBAC permissions to read logs/events.

## Components
1. **Diagnostics Collection Module (`diagnostics.py`)**

## Related User Stories
- US03: Automated Diagnostics Collection
