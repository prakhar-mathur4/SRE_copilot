"""
Runbook suggestion and execution module.
"""
import logging
from typing import Optional

logger = logging.getLogger("sre_copilot")

async def get_runbook_recommendation(alert_name: str, ai_rca: str) -> str:
    """
    Returns a recommended runbook action string based on alert context.
    """
    if alert_name == "HighMemoryUsage":
        return "Suggested Action: Capture heap dump, then safely restart the pod if usage > 95%."
    elif alert_name == "HighErrorRate":
        return "Suggested Action: Check upstream dependencies and API gateway logs."
    elif alert_name == "HighCPUUsage":
        return "Suggested Action: Review current traffic spike, consider scaling up HPA max replicas."
    elif alert_name == "DatabaseConnectionFailure":
        return "Suggested Action: Verify Database credentials in Secret, check network egress policies."
    else:
        # Fallback to AI's suggestion if available
        if ai_rca and "Suggested Mitigation" in ai_rca:
            return "Runbook Engine: Please refer to the AI Suggested Mitigation steps above."
            
    return "Standard Protocol: Restart target resource and monitor logs for regression."


async def execute_runbook(alert_name: str, ai_rca: str) -> Optional[str]:
    """
    Evaluates the alert and AI RCA to either suggest a runbook 
    or execute predefined safe automation steps.
    """
    logger.info(f"Evaluating runbook actions for alert: {alert_name}")
    
    # In a fully implementation, this would match against a library of scripts
    # or an external runbook engine like Ansible Tower / Rundeck.
    
    return await get_runbook_recommendation(alert_name, ai_rca)

