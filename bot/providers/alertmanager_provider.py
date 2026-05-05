import httpx
import logging
from typing import Dict, Any, List, Set

from bot.providers.base import DiagnosticProvider

logger = logging.getLogger("sre_copilot")


class AlertmanagerProvider(DiagnosticProvider):
    def __init__(self, url: str, name: str = "Alertmanager"):
        self.url = url.rstrip("/")
        self.provider_name = name
        self.provider_type = "alertmanager"
        # Tracks fingerprints seen in the last poll to detect resolutions
        self._active_fingerprints: Set[str] = set()

    async def get_health_metrics(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                res = await client.get(f"{self.url}/-/healthy")
                if res.status_code == 200:
                    # Also fetch alert count for the health card
                    alert_count = 0
                    try:
                        r = await client.get(f"{self.url}/api/v2/alerts", params={"active": "true", "silenced": "false", "inhibited": "false"})
                        if r.status_code == 200:
                            alert_count = len(r.json())
                    except Exception:
                        pass
                    return {
                        "status": "online",
                        "name": self.provider_name,
                        "cpu_usage": 0,
                        "memory_usage": 0,
                        "nodes_online": alert_count,
                        "nodes_total": alert_count,
                        "alert_count": alert_count,
                    }
        except Exception as e:
            logger.error(f"Alertmanager unreachable at {self.url}: {e}")
        return {"status": "offline", "name": self.provider_name, "error": "Unreachable"}

    async def poll_alerts(self) -> List[Dict[str, Any]]:
        """Fetch currently active (firing) alerts from Alertmanager API v2."""
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                res = await client.get(
                    f"{self.url}/api/v2/alerts",
                    params={"active": "true", "silenced": "false", "inhibited": "false"}
                )
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.error(f"Failed to poll Alertmanager {self.url}: {e}")
        return []

    async def collect_diagnostics(self, context: str, alert_labels: Dict) -> str:
        return f"Alert sourced from Alertmanager: {self.url}"

    async def list_resources(self, context: str = None) -> List[Dict]:
        return []

    async def get_time_series(self) -> Dict:
        return {"cpu": [], "memory": []}
