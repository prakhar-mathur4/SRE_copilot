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
from bot.runbook_executor import execute_runbook, get_runbook_recommendation
from bot.ws_manager import manager
from bot.providers import registry
from bot.diagnostics import get_cluster_health_metrics, list_all_pods, get_pod_yaml, delete_pod
from bot.chaos_manager import chaos_manager
from bot.noise_reduction import noise_reducer
from bot.models import FilterRule, MaintenanceWindow

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
    reports = await get_cluster_health_metrics()
    is_sim = any(r.get("simulation_mode", False) for r in reports)
    return {
        "simulation_mode": is_sim,
        "environments": reports
    }


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
    instance: Optional[str] = None
    description: Optional[str] = None


class RunbookTriggerRequest(BaseModel):
    incident_id: str
    alert_name: str
    rca_summary: str

# ---------------------------------------------------------------------------
# Filter Rules & Maintenance Endpoints
# ---------------------------------------------------------------------------

@router.get("/noise/stats")
async def get_noise_stats():
    """Return live noise-reduction counters."""
    return noise_reducer.get_stats()

@router.get("/filters")
async def list_filters():
    return noise_reducer.filter_rules

@router.post("/filters")
async def add_filter(rule: FilterRule):
    noise_reducer.add_filter_rule(rule)
    return {"success": True}

@router.delete("/filters/{name}")
async def delete_filter(name: str):
    success = noise_reducer.remove_filter_rule(name)
    return {"success": success}

@router.get("/maintenance")
async def list_maintenance():
    return noise_reducer.maintenance_windows

@router.post("/maintenance")
async def add_maintenance(window: MaintenanceWindow):
    noise_reducer.add_maintenance_window(window)
    return {"success": True}

@router.delete("/maintenance/{id}")
async def delete_maintenance(id: str):
    success = noise_reducer.remove_maintenance_window(id)
    return {"success": success}

class CeleEvaluateRequest(BaseModel):
    expression: str
    alert: AlertData

@router.post("/cel/evaluate")
async def evaluate_cel_expression(payload: CeleEvaluateRequest):
    result = noise_reducer.evaluate_cel(payload.expression, payload.alert)
    return {"result": result}


# ---------------------------------------------------------------------------
# GET /api/v1/incidents
# ---------------------------------------------------------------------------

@router.get("/incidents")
async def list_incidents():
    """Return all in-memory incidents, serialised to JSON-safe dicts."""
    result = []
    for incident in timeline_manager.incidents.values():
        fingerprint = incident.incident_id[4:]  # strip "inc-" prefix
        dedup_count = noise_reducer.dedup_details.get(fingerprint, {}).get("count", 0)
        result.append({
            "incident_id": incident.incident_id,
            "alert_name": incident.alert_name,
            "status": incident.status,
            "severity": incident.severity,
            "namespace": incident.context,
            "start_time": incident.start_time.isoformat(),
            "alert_starts_at": incident.alert_starts_at,
            "last_updated": incident.last_updated.isoformat(),
            "labels": incident.labels,
            "annotations": incident.annotations,
            "diagnostics_collected": incident.diagnostics_collected,
            "rca_completed": incident.rca_completed,
            "rca_report": incident.rca_report,
            "runbook_executed": incident.runbook_executed,
            "runbook_action": incident.runbook_action,
            "event_count": len(incident.events),
            "dedup_count": dedup_count,
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

    # Dynamic runbook recommendation if not yet executed
    recommendation = None
    if not incident.runbook_executed:
        recommendation = await get_runbook_recommendation(incident.alert_name, incident.rca_report or "")

    return {
        "incident_id": incident.incident_id,
        "alert_name": incident.alert_name,
        "status": incident.status,
        "severity": incident.severity,
        "namespace": incident.context,
        "start_time": incident.start_time.isoformat(),
        "alert_starts_at": incident.alert_starts_at,
        "last_updated": incident.last_updated.isoformat(),
        "labels": incident.labels,
        "annotations": incident.annotations,
        "diagnostics_collected": incident.diagnostics_collected,
        "diagnostics_failed": incident.diagnostics_failed,
        "diagnostics_error": incident.diagnostics_error,
        "rca_completed": incident.rca_completed,
        "rca_report": incident.rca_report,
        "raw_diagnostics": incident.raw_diagnostics,
        "runbook_executed": incident.runbook_executed,
        "runbook_action": incident.runbook_action,
        "recommended_runbook": recommendation,
        "events": events,
        "report": report,
    }

@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident_manually(incident_id: str):
    """Manually mark an incident as resolved from the UI."""
    incident = timeline_manager.incidents.get(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    
    incident.status = "resolved"
    timeline_manager.add_event(incident_id, "Incident manually resolved via Dashboard", "Operator")
    
    # Broadcast the resolution
    await manager.broadcast({
        "type": "INCIDENT_UPDATE",
        "incident_id": incident_id,
        "status": "resolved",
        "alert_name": incident.alert_name
    })
    
    return {"success": True, "incident_id": incident_id}


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
    if payload.instance:
        labels["instance"] = payload.instance

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

# ---------------------------------------------------------------------------
# Settings & Connectors Registry
# ---------------------------------------------------------------------------

@router.get("/health/timeseries/{provider_id}")
async def get_provider_timeseries(provider_id: str):
    """Get 2-hour historical time series data for a specific provider."""
    provider = registry.get_provider(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found or offline")
    try:
        data = await provider.get_time_series()
        return data
    except Exception as e:
        logger.error(f"Error fetching time series for {provider_id}: {e}")
        return {"error": str(e)}

@router.get("/settings")
async def get_settings():
    """Return environment variables and registered connectors."""
    import os
    return {
        "env": {
            "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
            "TEAMS_WEBHOOK_URL": os.getenv("TEAMS_WEBHOOK_URL", "")
        },
        "connectors": await registry.list_providers()
    }

@router.post("/settings/env")
async def update_env_settings(payload: dict):
    """Update primary environment variables in .env."""
    import os
    env_path = os.path.join(os.getcwd(), ".env")
    
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            lines = f.readlines()
            
    new_lines = []
    updated_keys = set()
    
    for line in lines:
        if "=" in line:
            key = line.split("=")[0].strip()
            if key in payload:
                new_lines.append(f"{key}={payload[key]}\n")
                updated_keys.add(key)
                os.environ[key] = str(payload[key])
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    for key, value in payload.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}\n")
            os.environ[key] = str(value)
            
    with open(env_path, "w") as f:
        f.writelines(new_lines)
        
    return {"success": True}

@router.post("/connectors")
async def add_connector(payload: dict):
    """Add a new infrastructure connector to the registry."""
    configs = await registry.list_providers()
    
    # Generate ID if not present
    if "id" not in payload:
        import uuid
        payload["id"] = f"{payload['type']}-{str(uuid.uuid4())[:8]}"
        
    configs.append(payload)
    
    with open(registry.config_path, "w") as f:
        json.dump(configs, f, indent=2)
        
    registry.load_connectors()
    return {"success": True, "connector": payload}

@router.delete("/connectors/{connector_id}")
async def delete_connector(connector_id: str):
    """Remove a connector from the registry."""
    configs = await registry.list_providers()
    new_configs = [c for c in configs if c["id"] != connector_id]
    
    with open(registry.config_path, "w") as f:
        json.dump(new_configs, f, indent=2)
        
    registry.load_connectors()
    return {"success": True}
