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

logger = logging.getLogger("sre_copilot")
router = APIRouter()

async def process_alert_background(alert: AlertData):
    """Background processor for a single alert"""
    alert_name = alert.labels.get('alertname', 'Unknown')
    namespace = alert.labels.get('namespace', 'default')
    severity = alert.labels.get('severity', 'warning')
    status = alert.status
    fingerprint = alert.fingerprint
    
    # 1. Timeline tracking
    incident = timeline_manager.create_or_update_incident(
        fingerprint=fingerprint,
        alert_name=alert_name,
        status=status,
        severity=severity,
        namespace=namespace
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
    
    diagnostics = await collect_diagnostics(namespace, alert.labels)
    incident.diagnostics_collected = True
    timeline_manager.add_event(incident_id, "Diagnostics collected successfully", "Diagnostics")
    await ws_manager.broadcast({"type": "EVENT_ADDED", "incident_id": incident_id, "message": "Diagnostics collected."})
    
    # 4. AI RCA
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
        alert_name = alert.labels.get('alertname', 'Unknown')
        namespace = alert.labels.get('namespace', 'N/A')
        severity = alert.labels.get('severity', 'none')
        logger.info(f"Alert {alert.status}: {alert_name} (Severity: {severity}) in namespace: {namespace}")
        
        # Dispatch background task for each alert
        background_tasks.add_task(process_alert_background, alert)
        
    return {"message": "Alert received and processing started"}
