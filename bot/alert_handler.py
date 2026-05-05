"""
Webhook handler for Prometheus/Alertmanager alerts.
"""
from fastapi import APIRouter, BackgroundTasks
import logging
from bot.models import AlertmanagerPayload, AlertData
from bot.timeline import timeline_manager
from bot.diagnostics import collect_diagnostics
from bot.ai_analysis import analyze_incident
from bot.runbook_executor import execute_runbook
from bot.teams_notifier import notify_teams, update_teams_message
from bot.ws_manager import manager as ws_manager
from bot.noise_reduction import noise_reducer

logger = logging.getLogger("sre_copilot")
router = APIRouter()

# Priority-ordered labels to use as context, from most to least specific
_CONTEXT_LABEL_PRIORITY = [
    "namespace",    # K8s namespace
    "instance",     # Prometheus target (host:port)
    "service",      # Service name
    "job",          # Prometheus job
    "cluster",      # Cluster name (multi-cluster setups)
    "region",       # Cloud region
    "host",         # Hostname
    "pod",          # K8s pod
    "container",    # K8s container
    "alertmanager_source",  # Which Alertmanager sent it
]

def _resolve_context(labels: dict) -> str:
    """Pick the most meaningful context label from an alert's label set."""
    for key in _CONTEXT_LABEL_PRIORITY:
        value = labels.get(key, "").strip()
        if value:
            return f"{key}:{value}"
    return "unknown"

async def process_alert_background(alert: AlertData):
    """Background processor for a single alert"""
    alert_name = alert.labels.get('alertname', 'Unknown')
    context = _resolve_context(alert.labels)
    severity = alert.labels.get('severity', 'warning')
    status = alert.status
    # Use calculated fingerprint from noise reduction pipeline
    from bot.noise_reduction import noise_reducer
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
    )
    incident_id = incident.incident_id

    # Broadcast update
    await ws_manager.broadcast({
        "type": "INCIDENT_UPDATE",
        "incident_id": incident_id,
        "status": status,
        "severity": severity,
        "alert_name": alert_name
    })
    
    # If it's a resolution, timeline_manager already handles the report logic
    if status == "resolved":
        await notify_teams(incident_id, alert, "Resolved")
        return

    # For new firing alerts:
    # 2. Initial Notification
    timeline_manager.add_event(incident_id, "Sending initial Teams notification", "Notifier")
    await notify_teams(incident_id, alert, "Investigating")

    # 3. Collect Diagnostics
    timeline_manager.add_event(incident_id, "Starting diagnostics collection", "Diagnostics")
    await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Collecting diagnostics..."})
    
    try:
        diagnostics = await collect_diagnostics(context, alert.labels)
        
        # Check if diagnostics actually returned real data
        if not diagnostics or "unreachable" in diagnostics.lower() or "error" in diagnostics.lower() or "failed" in diagnostics.lower():
            raise Exception(diagnostics or "Infrastructure unreachable")
            
        incident.diagnostics_collected = True
        incident.raw_diagnostics = diagnostics
        timeline_manager.add_event(incident_id, "Diagnostics collected successfully", "Diagnostics")
        await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Diagnostics collected."})
    except Exception as e:
        error_msg = str(e)
        incident.diagnostics_failed = True
        incident.diagnostics_error = error_msg
        timeline_manager.add_event(incident_id, f"CRITICAL: Diagnostics failed - {error_msg}", "Diagnostics")
        await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Pipeline Failure: Infrastructure unreachable."})
        await update_teams_message(incident_id, alert, "Link Failure", f"Monitoring pipeline could not reach the target: {error_msg}")
        return # STOP THE PIPELINE - No false data
    
    # 4. AI RCA (Only for real incidents, or if specifically requested)
    is_probe = "ConnectivityProbe" in alert_name
    
    if is_probe:
        timeline_manager.add_event(incident_id, "Connectivity verified successfully. Probe complete.", "System")
        await update_teams_message(incident_id, alert, "Probe Success", "Infrastructure is connected and telemetry is flowing correctly.")
        return # PROBE COMPLETE - Skip AI/Runbooks for pure connectivity tests
        
    timeline_manager.add_event(incident_id, "Starting AI Root Cause Analysis", "AI Engine")
    await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Analyzing root cause..."})
    
    rca_result = await analyze_incident(alert, diagnostics)
    logger.info(f"[{incident_id}] AI RCA Result:\n{rca_result}")
    incident.rca_completed = True
    incident.rca_report = rca_result
    timeline_manager.add_event(incident_id, "AI Analysis completed", "AI Engine")
    await ws_manager.broadcast({
        "type": "RCA_COMPLETE",
        "incident_id": incident_id,
        "rca": rca_result
    })
    
    # Update Notification with RCA
    await update_teams_message(incident_id, alert, "RCA Available", rca_result)

    # 5. Runbook Automation
    timeline_manager.add_event(incident_id, "Evaluating runbook mapping", "Runbook Engine")
    action_result = await execute_runbook(alert_name, rca_result)
    if action_result:
        incident.runbook_executed = True
        incident.runbook_action = action_result
        timeline_manager.add_event(incident_id, f"Runbook executed: {action_result}", "Runbook Engine")
        await ws_manager.broadcast({
            "type": "RUNBOOK_EXECUTED",
            "incident_id": incident_id,
            "action": action_result
        })
    
    # Final Notification update
    await update_teams_message(incident_id, alert, "Mitigation Applied" if action_result else "Action Required", rca_result, action_result)

@router.post("/webhook")
async def handle_alert(payload: AlertmanagerPayload, background_tasks: BackgroundTasks):
    logger.info(f"Received alert payload: status={payload.status}, alerts_count={len(payload.alerts)}")
    
    for alert in payload.alerts:
        # Noise Reduction & Deduplication Pipeline
        fingerprint = noise_reducer.process_incoming_alert(alert)
        if not fingerprint:
            continue
            
        alert_name = alert.labels.get('alertname', 'Unknown')
        context = _resolve_context(alert.labels)
        severity = alert.labels.get('severity', 'none')
        logger.info(f"Alert {alert.status}: {alert_name} (Severity: {severity}) in context: {context}")
        
        # Dispatch background task for each alert
        background_tasks.add_task(process_alert_background, alert)
        
    return {"message": "Alert received and processing started"}
