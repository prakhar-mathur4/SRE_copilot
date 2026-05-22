"""
AI-based Root Cause Analysis logic.
"""
import re
import logging
from typing import Tuple
from bot.models import AlertData
from bot.llm_client import call_llm, is_llm_configured, active_provider_info

logger = logging.getLogger("sre_copilot")

_SYSTEM_PROMPT = (
    "You are a concise, expert SRE AI assistant. "
    "Respond only with the requested Markdown — no preamble or trailing commentary."
)


def _extract_remediation(rca_text: str) -> str:
    """Pull the first action item from the Suggested Remediation section."""
    match = re.search(r'##\s*Suggested Remediation\s*\n(.*?)(?:\n##|\Z)', rca_text, re.DOTALL | re.IGNORECASE)
    if not match:
        return ""
    for line in match.group(1).splitlines():
        cleaned = line.strip().lstrip("0123456789.-• ").strip()
        if cleaned:
            return cleaned
    return ""


async def analyze_incident(alert: AlertData, diagnostics_payload: str) -> Tuple[str, str]:
    """Run AI root cause analysis on an incident.

    Returns (rca_report, suggested_remediation).
    Never raises — returns a graceful fallback on any failure.
    """
    alert_name = alert.labels.get("alertname", "Unknown Alert")
    severity    = alert.labels.get("severity", "unknown")
    description = alert.annotations.get("description", "No description provided.")
    namespace   = alert.labels.get("namespace", "")
    instance    = alert.labels.get("instance", "")

    if "SIMULATED_INCIDENT" in alert_name:
        rca = """## Root Cause Hypothesis
Thread pool exhaustion in `auth-service` — a database client introduced in the latest deploy does not close connections, causing resource starvation (CPU 85%+, 450+ open TCP connections vs. 100-connection limit, API latency 40ms → 1200ms).

## Suggested Remediation
1. Restart `auth-service` to flush the connection pool immediately.
2. Add `try-with-resources` around the DB client in the `/validate-token` handler.
3. Set `max_pool_size` in `application.yaml` and enable a connection-leak detector.
4. Monitor CPU and connection count for 10 minutes after restart to confirm recovery."""
        return rca, "Restart auth-service to flush the connection pool, then patch the DB client to close connections properly."

    if not is_llm_configured():
        info = active_provider_info()
        msg = (
            f"### AI Analysis Not Configured\n"
            f"No API key found for provider **{info['provider']}**. "
            f"Go to **Settings → AI Engine**, select your provider, and enter your API key."
        )
        return msg, ""

    target_parts = []
    if instance:
        target_parts.append(f"Instance: {instance}")
    if namespace:
        target_parts.append(f"Namespace: {namespace}")
    target_str = ", ".join(target_parts) or "unknown"

    telemetry_section = (
        f"\n### Telemetry\n{diagnostics_payload}"
        if diagnostics_payload
        else "\n### Telemetry\nNo telemetry data was collected for this alert."
    )

    prompt = f"""You are an expert Site Reliability Engineer (SRE) performing root cause analysis.

## Alert
- **Name**: {alert_name}
- **Severity**: {severity}
- **Target**: {target_str}
- **Description**: {description}
- **Labels**: {dict(alert.labels)}
{telemetry_section}

## Instructions
Respond in clean Markdown with exactly these two sections:

## Root Cause Hypothesis
1-3 sentences identifying the most likely root cause based on the alert and any available telemetry.

## Suggested Remediation
Numbered list of 2-4 concrete, ordered steps an on-call engineer should take immediately.
Each step must be one sentence. This is a suggestion only — no automated actions will be taken."""

    try:
        info = active_provider_info()
        logger.info(f"Sending RCA prompt to {info['provider']} ({info['model']}) for alert: {alert_name}")
        rca = await call_llm(_SYSTEM_PROMPT, prompt)
        return rca, _extract_remediation(rca)
    except Exception as e:
        logger.error(f"LLM API error during RCA for {alert_name}: {e}")
        return f"### AI Analysis Failed\nUnable to contact the AI engine: `{e}`", ""
