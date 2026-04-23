# Design Unit 2: Incident Bot API Core

## Overview
This unit is the central nervous system of SRE Copilot. It provides the FastAPI backend that receives webhooks, coordinates the other engines (Diagnostics, AI, Notifications), and tracks state.

## Cohesion & Coupling
- **Cohesive:** Focuses strictly on API routing, payload validation, and dispatching work to other cohesive engines.
- **Loosely Coupled:** Connects to other components via Python module imports or separate microservices (if scaled out). It relies on well-defined Pydantic interfaces to pass data.

## Components
1. **FastAPI Server (`main.py`)**
2. **Alert Router (`alert_handler.py`)**
3. **Data Models (`models.py`)**

## Related User Stories
- US01: Incident Detection (Webhook receiver part)
