# Code Generation Plan: SRE Copilot Backend

## Goal Description
Implement the complete backend system for the SRE Copilot bot using Python and FastAPI. The system will handle Prometheus/Alertmanager webhooks, gather Kubernetes diagnostics, perform AI-based root cause analysis, execute runbook automation, post rich notifications to Microsoft Teams, and maintain an incident timeline.

## Proposed Changes

1. **`bot/main.py`**
   - Enhance the FastAPI application setup.
   - Add CORS middleware, error handlers, and lifecycle events (startup/shutdown).

2. **`bot/alert_handler.py`**
   - Implement the webhook receiver logic to process incoming Alertmanager payloads.
   - Orchestrate calls to `timeline`, `diagnostics`, `ai_analysis`, `runbook_executor`, and `teams_notifier`.

3. **`bot/diagnostics.py`**
   - Implement Kubernetes API integration.
   - Collect logs, events, and pod status for the given namespace/resources.

4. **`bot/ai_analysis.py`**
   - Provide an interface to an LLM for parsing diagnostics and alert context.
   - Return a Root Cause Analysis (RCA) summary and actionable steps.

5. **`bot/runbook_executor.py`**
   - Implement logic to map specific alerts (e.g., `HighMemoryUsage`) to predefined runbook instructions or suggest actions based on the AI RCA.

6. **`bot/teams_notifier.py`**
   - Implement MS Teams webhook integration using Adaptive Cards.
   - Send notifications for alert creation, updates, diagnostics, AI RCA, and resolution.

7. **`bot/timeline.py`**
   - Track state for incidents in memory or file-based.
   - Record timestamps: alert received, diagnostics compiled, AI RCA generated, runbook suggested, resolved.
   - Generate a Markdown post-mortem report.

8. **`bot/requirements.txt`**
   - Add new dependencies like `kubernetes`, `httpx`, `openai`.

## Verification Plan
- **Automated Tests:** Validate FastAPI app starts cleanly and endpoint routes are registered.
- **Manual Verification:** Send a mock Alertmanager JSON payload locally to `/api/v1/alerts/webhook` and verify logs confirming diagnostics, AI RCA, and timeline generation are executed.
