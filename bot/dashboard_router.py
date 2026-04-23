"""
Dashboard Router — exposes incident data and test utilities to the SRE Copilot frontend.
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List
import logging
import json

from bot.timeline import timeline_manager
from bot.alert_handler import process_alert_background
from bot.models import AlertData
from bot.runbook_executor import execute_runbook
from bot.ws_manager import manager
from bot.diagnostics import get_cluster_health_metrics, list_all_pods, get_pod_yaml, delete_pod
from bot.chaos_manager import chaos_manager

logger = logging.getLogger("sre_copilot")
router = APIRouter()


# WebSocket connection endpoint
@router.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, though we mainly use it for server-to-client broadcast
            data = await websocket.receive_text()
            logger.debug(f"Received message from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Global Health Status (Mock for now)
# ---------------------------------------------------------------------------

@router.get("/health/cluster")
async def get_cluster_health():
    """Return real-time global health metrics for the dashboard."""
    return await get_cluster_health_metrics()


# ---------------------------------------------------------------------------
# Chaos Engine Endpoints
# ---------------------------------------------------------------------------

@router.get("/chaos/scenarios")
async def list_chaos_scenarios():
    """Return all available chaos scenarios and their active status."""
    return chaos_manager.get_all_scenarios()

class ChaosTriggerRequest(BaseModel):
    id: str
    active: bool

@router.post("/chaos/trigger")
async def trigger_chaos(payload: ChaosTriggerRequest):
    """Activate or deactivate a chaos scenario."""
    success = chaos_manager.toggle_scenario(payload.id, payload.active)
    if not success:
        raise HTTPException(status_code=404, detail=f"Scenario {payload.id} not found")
    return {"success": True, "scenario": payload.id, "active": payload.active}

class TestAlertRequest(BaseModel):
    alertname: str
    namespace: str = "default"
    severity: str = "warning"
    fingerprint: str = "test-001"
    pod: Optional[str] = None
    description: Optional[str] = None


class RunbookTriggerRequest(BaseModel):
    incident_id: str
    alert_name: str
    rca_summary: str


# ---------------------------------------------------------------------------
# GET /api/v1/incidents
# ---------------------------------------------------------------------------

@router.get("/incidents")
async def list_incidents():
    """Return all in-memory incidents, serialised to JSON-safe dicts."""
    result = []
    for incident in timeline_manager.incidents.values():
        result.append({
            "incident_id": incident.incident_id,
            "alert_name": incident.alert_name,
            "status": incident.status,
            "severity": incident.severity,
            "namespace": incident.namespace,
            "start_time": incident.start_time.isoformat(),
            "last_updated": incident.last_updated.isoformat(),
            "diagnostics_collected": incident.diagnostics_collected,
            "rca_completed": incident.rca_completed,
            "rca_report": incident.rca_report,
            "runbook_executed": incident.runbook_executed,
            "runbook_action": incident.runbook_action,
            "event_count": len(incident.events),
        })
    # Sort newest first
    result.sort(key=lambda x: x["start_time"], reverse=True)
    return result


# ---------------------------------------------------------------------------
# GET /api/v1/incidents/{incident_id}
# ---------------------------------------------------------------------------

@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Return a single incident with full event timeline and post-mortem report."""
    incident = timeline_manager.incidents.get(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    events = [
        {
            "timestamp": e.timestamp.isoformat(),
            "description": e.description,
            "source": e.source,
        }
        for e in incident.events
    ]

    # Attempt to retrieve a stored report (if resolved + high/critical)
    report = None
    if incident.status == "resolved" and incident.severity.lower() in ["high", "critical", "page"]:
        report = timeline_manager.generate_report(incident_id)

    return {
        "incident_id": incident.incident_id,
        "alert_name": incident.alert_name,
        "status": incident.status,
        "severity": incident.severity,
        "namespace": incident.namespace,
        "start_time": incident.start_time.isoformat(),
        "last_updated": incident.last_updated.isoformat(),
        "diagnostics_collected": incident.diagnostics_collected,
        "rca_completed": incident.rca_completed,
        "rca_report": incident.rca_report,
        "runbook_executed": incident.runbook_executed,
        "runbook_action": incident.runbook_action,
        "events": events,
        "report": report,
    }


# ---------------------------------------------------------------------------
# POST /api/v1/alerts/test
# ---------------------------------------------------------------------------

@router.post("/alerts/test")
async def fire_test_alert(payload: TestAlertRequest, background_tasks: BackgroundTasks):
    """Fire a synthetic test alert without Alertmanager — useful for frontend testing."""
    labels = {
        "alertname": payload.alertname,
        "namespace": payload.namespace,
        "severity": payload.severity,
    }
    if payload.pod:
        labels["pod"] = payload.pod

    alert = AlertData(
        status="firing",
        labels=labels,
        annotations={"description": payload.description or f"Test alert: {payload.alertname} in {payload.namespace}"},
        startsAt="2026-03-17T00:00:00Z",
        endsAt="0001-01-01T00:00:00Z",
        generatorURL="",
        fingerprint=payload.fingerprint,
    )

    logger.info(f"Firing synthetic test alert: {payload.alertname} (fingerprint={payload.fingerprint})")
    background_tasks.add_task(process_alert_background, alert)
    return {"message": "Test alert queued", "fingerprint": payload.fingerprint, "incident_id": f"inc-{payload.fingerprint}"}


# ---------------------------------------------------------------------------
# POST /api/v1/runbook/trigger
# ---------------------------------------------------------------------------

@router.post("/runbook/trigger")
async def trigger_runbook(payload: RunbookTriggerRequest):
    """Execute a runbook action for a given incident (human-approved from UI)."""
    logger.info(f"UI-triggered runbook execution for incident {payload.incident_id}")

    result = await execute_runbook(payload.alert_name, payload.rca_summary)

    if result:
        timeline_manager.add_event(
            payload.incident_id,
            f"Runbook triggered from UI: {result}",
            "UI/Dashboard"
        )
        return {"success": True, "action": result}

    return {"success": False, "action": None, "detail": "No matching runbook found for this alert."}


# ---------------------------------------------------------------------------
# Pod Inventory Endpoints
# ---------------------------------------------------------------------------

@router.get("/pods")
async def list_pods(namespace: Optional[str] = None):
    """Return a list of all pods with metrics and metadata."""
    return await list_all_pods(namespace)

@router.get("/pods/{namespace}/{pod_name}/yaml")
async def fetch_pod_yaml(namespace: str, pod_name: str):
    """Return the YAML representation of a specific pod."""
    yaml_content = await get_pod_yaml(pod_name, namespace)
    return {"yaml": yaml_content}

@router.delete("/pods/{namespace}/{pod_name}")
async def remove_pod(namespace: str, pod_name: str):
    """Delete a specific pod."""
    success = await delete_pod(pod_name, namespace)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to delete pod {pod_name}")
    return {"success": True}
