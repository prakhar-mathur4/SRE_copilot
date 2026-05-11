"""
Webhook handler for Prometheus/Alertmanager alerts.
"""
from fastapi import APIRouter, BackgroundTasks
import logging
from bot.models import AlertmanagerPayload, AlertData
from bot.timeline import timeline_manager
from bot.diagnostics import collect_diagnostics
from bot.ai_analysis import analyze_incident
from bot.teams_notifier import notify_teams, update_teams_message
from bot.ws_manager import manager as ws_manager
from bot.noise_reduction import noise_reducer

logger = logging.getLogger("sre_copilot")
router = APIRouter()

# Priority-ordered labels to use as context, from most to least specific
_CONTEXT_LABEL_PRIORITY = [
    "namespace",
    "instance",
    "service",
    "job",
    "cluster",
    "region",
    "host",
    "pod",
    "container",
    "alertmanager_source",
]


def _resolve_context(labels: dict) -> str:
    """Pick the most meaningful context label from an alert's label set."""
    for key in _CONTEXT_LABEL_PRIORITY:
        value = labels.get(key, "").strip()
        if value:
            return f"{key}:{value}"
    return "unknown"


async def process_alert_background(alert: AlertData):
    """Background processor for a single alert."""
    alert_name = alert.labels.get("alertname", "Unknown")
    context = _resolve_context(alert.labels)
    severity = alert.labels.get("severity", "warning")
    status = alert.status
    fingerprint = noise_reducer.calculate_fingerprint(alert)

    # 1. Timeline tracking
    incident = timeline_manager.create_or_update_incident(
        fingerprint=fingerprint,
        alert_name=alert_name,
        status=status,
        severity=severity,
        context=context,
        labels=dict(alert.labels),
        annotations=dict(alert.annotations),
        alert_starts_at=alert.startsAt,
    )
    incident_id = incident.incident_id

    await ws_manager.broadcast({
        "type": "INCIDENT_UPDATE",
        "incident_id": incident_id,
        "status": status,
        "severity": severity,
        "alert_name": alert_name,
    })

    if status == "resolved":
        await notify_teams(incident_id, alert, "Resolved")
        return

    # 2. Initial Teams notification
    timeline_manager.add_event(incident_id, "Sending initial Teams notification", "Notifier")
    await notify_teams(incident_id, alert, "Investigating")

    # 3. Collect telemetry (best-effort — never stops the pipeline)
    timeline_manager.add_event(incident_id, "Collecting telemetry", "Diagnostics")
    await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Collecting telemetry..."})

    diagnostics = ""
    try:
        diagnostics = await collect_diagnostics(context, alert.labels)
        if diagnostics:
            incident.diagnostics_collected = True
            incident.telemetry_available = True
            incident.raw_diagnostics = diagnostics
            timeline_manager.add_event(incident_id, "Telemetry collected", "Diagnostics")
            await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Telemetry collected."})
        else:
            incident.telemetry_available = False
            incident.telemetry_error = "No matching infrastructure connector for this alert."
            timeline_manager.add_event(incident_id, "No telemetry — no matching provider", "Diagnostics")
            await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "No telemetry — continuing analysis."})
    except Exception as e:
        error_msg = str(e)
        incident.telemetry_available = False
        incident.telemetry_error = error_msg
        timeline_manager.add_event(incident_id, f"Telemetry collection failed: {error_msg}", "Diagnostics")
        await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Telemetry unavailable — continuing analysis."})

    # Connectivity probes stop here — no AI needed for pure health checks
    if "ConnectivityProbe" in alert_name:
        timeline_manager.add_event(incident_id, "Connectivity probe complete.", "System")
        await update_teams_message(incident_id, alert, "Probe Complete", "Infrastructure connection verified.")
        return

    # 4. AI Root Cause Analysis (always runs, even without telemetry)
    timeline_manager.add_event(incident_id, "Starting AI Root Cause Analysis", "AI Engine")
    await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Analyzing root cause..."})

    rca_report, suggested_remediation = await analyze_incident(alert, diagnostics)
    logger.info(f"[{incident_id}] AI RCA completed")

    incident.rca_completed = True
    incident.rca_report = rca_report
    if suggested_remediation:
        incident.suggested_remediation = suggested_remediation

    timeline_manager.add_event(incident_id, "AI analysis completed", "AI Engine")
    await ws_manager.broadcast({
        "type": "RCA_COMPLETE",
        "incident_id": incident_id,
        "rca": rca_report,
        "suggested_remediation": suggested_remediation,
    })

    await update_teams_message(incident_id, alert, "Analysis Available", rca_report, suggested_remediation or None)


@router.post("/webhook")
async def handle_alert(payload: AlertmanagerPayload, background_tasks: BackgroundTasks):
    logger.info(f"Received alert payload: status={payload.status}, alerts_count={len(payload.alerts)}")

    for alert in payload.alerts:
        fingerprint = noise_reducer.process_incoming_alert(alert)
        if not fingerprint:
            continue

        alert_name = alert.labels.get("alertname", "Unknown")
        context = _resolve_context(alert.labels)
        severity = alert.labels.get("severity", "none")
        logger.info(f"Alert {alert.status}: {alert_name} (Severity: {severity}) in context: {context}")

        background_tasks.add_task(process_alert_background, alert)

    return {"message": "Alert received and processing started"}
