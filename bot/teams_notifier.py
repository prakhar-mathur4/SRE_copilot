"""
Module for sending rich notifications to Microsoft Teams.
"""
import os
import logging
import httpx
from bot.models import AlertData
from typing import Optional

logger = logging.getLogger("sre_copilot")

TEAMS_WEBHOOK_URL = os.environ.get("TEAMS_WEBHOOK_URL")

async def notify_teams(incident_id: str, alert: AlertData, status_msg: str) -> None:
    """Send initial or status update notification to Teams."""
    await update_teams_message(incident_id, alert, status_msg, rca_summary=None, action_taken=None)

async def update_teams_message(incident_id: str, alert: AlertData, status_msg: str, rca_summary: Optional[str] = None, action_taken: Optional[str] = None) -> None:
    """
    Sends an Adaptive Card to Microsoft Teams.
    """
    if not TEAMS_WEBHOOK_URL:
        logger.warning(f"TEAMS_WEBHOOK_URL not set. Mocking notification for {incident_id}: {status_msg}")
        return
        
    alert_name = alert.labels.get('alertname', 'Unknown')
    severity = alert.labels.get('severity', 'Warning')
    namespace = alert.labels.get('namespace', 'default')
    description = alert.annotations.get('description', 'No description provided')
    
    # Adaptive Card schema
    card = {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": f"🚨 SRE Copilot Alert: {alert_name}",
                            "weight": "Bolder",
                            "size": "Medium",
                            "color": "Attention" if severity.lower() in ["critical", "high"] else "Warning"
                        },
                        {
                            "type": "FactSet",
                            "facts": [
                                {"title": "Incident ID:", "value": incident_id},
                                {"title": "Status:", "value": status_msg},
                                {"title": "Severity:", "value": severity},
                                {"title": "Namespace:", "value": namespace}
                            ]
                        },
                        {
                            "type": "TextBlock",
                            "text": "Description",
                            "weight": "Bolder",
                            "spacing": "Medium"
                        },
                        {
                            "type": "TextBlock",
                            "text": description,
                            "wrap": True
                        }
                    ]
                }
            }
        ]
    }
    
    # Append RCA if available
    if rca_summary:
        card["attachments"][0]["content"]["body"].extend([
            {
                "type": "TextBlock",
                "text": "🤖 AI Root Cause Analysis",
                "weight": "Bolder",
                "spacing": "Medium",
                "color": "Accent"
            },
            {
                "type": "TextBlock",
                "text": str(rca_summary[:1000] + "..." if len(rca_summary) > 1000 else rca_summary), # Truncate if too long
                "wrap": True
            }
        ])
        
    # Append Action/Runbook if available
    if action_taken:
        card["attachments"][0]["content"]["body"].extend([
            {
                "type": "TextBlock",
                "text": "⚙️ Runbook Action",
                "weight": "Bolder",
                "spacing": "Medium",
                "color": "Good"
            },
            {
                "type": "TextBlock",
                "text": action_taken,
                "wrap": True
            }
        ])

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(TEAMS_WEBHOOK_URL, json=card)
            response.raise_for_status()
            logger.info(f"Successfully notified Teams for {incident_id} ({status_msg})")
    except Exception as e:
        logger.error(f"Failed to send Teams notification: {e}")
