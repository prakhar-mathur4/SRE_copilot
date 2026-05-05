"""
AI-based Root Cause Analysis logic.
"""
import os
import logging
from openai import AsyncOpenAI
from bot.models import AlertData

logger = logging.getLogger("sre_copilot")

# Defer client initialization to ensure it doesn't crash on import if key is missing
client = None

def get_openai_client():
    global client
    if client is None and os.environ.get("OPENAI_API_KEY"):
        client = AsyncOpenAI()
    return client
async def analyze_incident(alert: AlertData, diagnostics_payload: str) -> str:
    """
    Sends the incident details and diagnostics to the LLM to perform Root Cause Analysis.
    Returns the LLM's assessment and recommended actions.
    """
    alert_name = alert.labels.get('alertname', 'Unknown Alert')
    severity = alert.labels.get('severity', 'page')
    description = alert.annotations.get('description', 'No description provided')
    
    infra_type = "Virtual Machine (VM)" if "instance" in alert.labels and "pod" not in alert.labels else "Kubernetes cluster"

    if "SIMULATED_INCIDENT" in alert_name:
        return f"""
### 🔎 Root Cause Analysis (Simulation)
The diagnostic engine has identified a **Thread Pool Exhaustion** in the `auth-service` running on the local node. 

**Evidence**:
- **CPU Spikes**: Consistent 85% load across all cores.
- **Connection Leak**: `lsof` indicates 450+ established TCP connections to the local database, exceeding the 100-connection limit.
- **Latency**: API response times have degraded from 40ms to 1200ms.

### 💡 Hypothesis
A recent deployment introduced a database client that doesn't properly close connections in the `/validate-token` endpoint, leading to resource starvation.

### ✅ Recommended Remediation
1.  **Immediate**: Flush established connections to the auth-service.
2.  **Long-term**: Review connection pool settings in the `application.yaml` and ensure `try-with-resources` blocks are implemented.
"""

    if not os.environ.get("OPENAI_API_KEY"):
        logger.warning("OPENAI_API_KEY not set. Reporting connectivity without AI RCA.")
        return f"""
### 🟢 Connectivity Verified
**Status**: Successfully connected to {infra_type}.

### ⚠️ AI Analysis Unavailable
The AI Engine is currently disconnected. To enable Root Cause Analysis and automated mitigation suggestions, please configure the `OPENAI_API_KEY` in the system environment.

**Telemetry gathered**: {len(diagnostics_payload)} characters of raw data available in the telemetry tab.
"""
    
    prompt = f"""
    You are an expert Site Reliability Engineer (SRE).
    An incident has just occurred in the {infra_type}.

    Alert Details:
    - Name: {alert_name}
    - Severity: {severity}
    - Description: {description}
    - Labels: {alert.labels}

    Automated Diagnostics Context:
    {diagnostics_payload}

    Please provide a concise Root Cause Analysis (RCA) and ordered steps to mitigate the issue.
    Keep the formatting as clean Markdown, with sections for "Root Cause Hypothesis" and "Suggested Mitigation".
    """
    
    try:
        openai_client = get_openai_client()
        logger.info(f"Sending prompt to LLM for RCA of {alert_name} on {infra_type}")
        response = await openai_client.chat.completions.create(
            model="gpt-4", # or gpt-3.5-turbo if cost is a concern
            messages=[
                {"role": "system", "content": f"You are a helpful and expert SRE AI assistant focusing on {infra_type} incidents."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2, # Low temperature for more deterministic and factual responses
            max_tokens=600
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error communicating with OpenAI API: {e}")
        return f"AI Analysis failed due to an error: {str(e)}"

def _mock_ai_analysis(alert: AlertData, diagnostics: str) -> str:
    """Mock analysis for local testing when API key isn't present."""
    alert_name = alert.labels.get('alertname', 'Unknown Alert')
    
    if alert_name == "HighMemoryUsage":
        return """
### Root Cause Hypothesis
The application container ran out of memory, possibly due to a memory leak in the Java heap space, leading to an `OOMKilled` event.

### Suggested Mitigation
1. Increase the memory limit for the deployment temporarily.
2. Capture a heap dump if the issue persists after scaling limits.
3. Review recent code changes affecting memory allocation in this service.
"""
    elif alert_name == "HighErrorRate":
        return """
### Root Cause Hypothesis
The service is experiencing a high 5xx error rate because one or more pods are in a `CrashLoopBackOff` state due to a refused database connection.

### Suggested Mitigation
1. Check if the backend database is up and reachable.
2. Verify network policies or firewall rules that might block traffic to `10.0.x.x`.
3. Check database credentials or connection string configuration in the affected pods.
"""
        
    return """
### Root Cause Hypothesis
Generic failure detected based on mock diagnostics.

### Suggested Mitigation
1. Review standard application logs.
2. Check upstream and downstream service health.
"""
