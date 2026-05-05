"""
Incident Timeline System module.
Tracks the state of incidents and generates reports.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import logging

logger = logging.getLogger("sre_copilot")

class TimelineEvent(BaseModel):
    timestamp: datetime
    description: str
    source: str

class IncidentState(BaseModel):
    incident_id: str
    alert_name: str
    status: str
    severity: str
    context: str
    start_time: datetime
    events: List[TimelineEvent] = []
    diagnostics_collected: bool = False
    diagnostics_failed: bool = False
    diagnostics_error: Optional[str] = None
    rca_completed: bool = False
    rca_report: Optional[str] = None
    raw_diagnostics: Optional[str] = None
    runbook_executed: bool = False
    runbook_action: Optional[str] = None
    last_updated: datetime

class TimelineManager:
    def __init__(self):
        # In-memory storage for incidents: incident_id -> IncidentState
        self.incidents: Dict[str, IncidentState] = {}
        # Keep incidents for 24 hours
        self.retention_period = timedelta(hours=24)

    def _generate_incident_id(self, fingerprint: str) -> str:
        return f"inc-{fingerprint}"

    def create_or_update_incident(self, fingerprint: str, alert_name: str, status: str, severity: str, context: str) -> IncidentState:
        incident_id = self._generate_incident_id(fingerprint)
        now = datetime.utcnow()
        
        if incident_id not in self.incidents:
            logger.info(f"Creating new incident timeline: {incident_id} for {alert_name}")
            self.incidents[incident_id] = IncidentState(
                incident_id=incident_id,
                alert_name=alert_name,
                status=status,
                severity=severity,
                context=context,
                start_time=now,
                last_updated=now
            )
            self.add_event(incident_id, "Alert triggered", "Alertmanager")
        else:
            incident = self.incidents[incident_id]
            incident.status = status
            incident.last_updated = now
            if status == "resolved":
                self.add_event(incident_id, "Alert resolved", "Alertmanager")
                self.generate_report(incident_id)
                
        return self.incidents[incident_id]

    def add_event(self, incident_id: str, description: str, source: str) -> None:
        if incident_id in self.incidents:
            event = TimelineEvent(
                timestamp=datetime.utcnow(),
                description=description,
                source=source
            )
            self.incidents[incident_id].events.append(event)
            self.incidents[incident_id].last_updated = datetime.utcnow()
            logger.info(f"[{incident_id}] Event added: {description} ({source})")

    def generate_report(self, incident_id: str) -> Optional[str]:
        if incident_id not in self.incidents:
            return None
            
        incident = self.incidents[incident_id]
        
        # Only generate reports for High/Critical (or if unspecified/other for robustness, but rule says high/crit ideally)
        if incident.severity.lower() not in ["high", "critical", "page"]:
            logger.info(f"Skipping report generation for {incident_id} due to severity {incident.severity}")
            return None
            
        logger.info(f"Generating post-mortem report for incident {incident_id}")
        
        report_lines = [
            f"# Incident Post-Mortem: {incident.alert_name}",
            f"**Incident ID:** {incident.incident_id}",
            f"**Severity:** {incident.severity}",
            f"**Context:** {incident.context}",
            f"**Started:** {incident.start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}",
            f"**Resolved:** {incident.last_updated.strftime('%Y-%m-%d %H:%M:%S UTC')}",
            "",
            "## Timeline of Events",
        ]
        
        for event in incident.events:
            report_lines.append(f"- **{event.timestamp.strftime('%H:%M:%S')}** [{event.source}]: {event.description}")
            
        report = "\n".join(report_lines)
        
        # In a real system, this might save to a file, Confluence, or send via email.
        # For now, we log it.
        logger.info(f"Incident Report Generated:\n{report}")
        return report

    def cleanup(self):
        """Remove stale incidents older than retention period"""
        now = datetime.utcnow()
        stale_ids = [
            inc_id for inc_id, inc in self.incidents.items()
            if now - inc.last_updated > self.retention_period
        ]
        for inc_id in stale_ids:
            logger.info(f"Cleaning up stale incident {inc_id}")
            del self.incidents[inc_id]

# Global singleton
timeline_manager = TimelineManager()
