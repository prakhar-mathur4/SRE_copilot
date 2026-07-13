import httpx
import logging
from typing import Dict, Any, List

from bot.providers.base import DiagnosticProvider

logger = logging.getLogger("sre_copilot")


class VMAlertProvider(DiagnosticProvider):
    """
    Diagnostic provider for vmalert (VictoriaMetrics' rule evaluator).

    vmalert *produces* alerts by evaluating alerting rules against a
    VictoriaMetrics/Prometheus datasource. It differs from Alertmanager:
      - It exposes ``/api/v1/alerts`` and ``/api/v1/rules`` (Prometheus-style),
        NOT Alertmanager's ``/api/v2/alerts``.
      - It reports both ``pending`` and ``firing`` states (Alertmanager only
        sees alerts once they fire and are routed).
      - It has no concept of silences/inhibition/grouping.

    Only ``firing`` alerts are fed into the incident pipeline (pending alerts
    have not yet satisfied their rule's ``for:`` duration).
    """

    def __init__(self, url: str, name: str = "vmalert"):
        self.url = url.rstrip("/")
        self.provider_name = name
        self.provider_type = "vmalert"
        # Maps our label-fingerprint → full raw alert dict from the last poll.
        # Used to detect resolutions (firing alert disappears from the list).
        self._active_alerts: Dict[str, dict] = {}

    async def _check_health(self, client: httpx.AsyncClient) -> bool:
        """vmalert health probe: prefer /health, fall back to /-/healthy."""
        for path in ("/health", "/-/healthy"):
            try:
                res = await client.get(f"{self.url}{path}")
                if res.status_code == 200:
                    return True
            except Exception:
                continue
        return False

    async def get_health_metrics(self) -> Dict[str, Any]:
        """Report vmalert reachability and a firing-alert count for the health card."""
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                if not await self._check_health(client):
                    return {"status": "offline", "name": self.provider_name, "error": "Health check failed"}

                summary = await self._summarize(client)
                firing = summary.get("firing", 0)
                return {
                    "status": "online",
                    "name": self.provider_name,
                    "cpu_usage": 0,
                    "memory_usage": 0,
                    "nodes_online": firing,
                    "nodes_total": firing,
                    "alert_count": firing,
                }
        except Exception as e:
            logger.error(f"vmalert unreachable at {self.url}: {e}")
        return {"status": "offline", "name": self.provider_name, "error": "Unreachable"}

    async def _fetch_alerts(self, client: httpx.AsyncClient) -> List[Dict[str, Any]]:
        """Raw alert list from vmalert's /api/v1/alerts."""
        try:
            res = await client.get(f"{self.url}/api/v1/alerts")
            if res.status_code == 200:
                return res.json().get("data", {}).get("alerts", []) or []
        except Exception as e:
            logger.error(f"Failed to fetch vmalert alerts from {self.url}: {e}")
        return []

    async def _summarize(self, client: httpx.AsyncClient) -> Dict[str, int]:
        """Count alerts by state (firing / pending / inactive)."""
        counts = {"firing": 0, "pending": 0, "inactive": 0}
        for a in await self._fetch_alerts(client):
            state = (a.get("state") or "").lower()
            if state in counts:
                counts[state] += 1
        return counts

    async def poll_alerts(self) -> List[Dict[str, Any]]:
        """Return all currently active alerts (firing + pending) from vmalert."""
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            return await self._fetch_alerts(client)

    async def poll_firing_alerts(self) -> List[Dict[str, Any]]:
        """Return only firing alerts — the ones that become incidents."""
        return [a for a in await self.poll_alerts() if (a.get("state") or "").lower() == "firing"]

    async def get_alerts_summary(self) -> Dict[str, int]:
        """firing / pending / inactive counts — for dashboards and future ops."""
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            return await self._summarize(client)

    async def get_rules(self) -> List[Dict[str, Any]]:
        """Return rule groups (with per-rule state/health) from /api/v1/rules."""
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                res = await client.get(f"{self.url}/api/v1/rules")
                if res.status_code == 200:
                    return res.json().get("data", {}).get("groups", []) or []
        except Exception as e:
            logger.error(f"Failed to fetch vmalert rules from {self.url}: {e}")
        return []

    async def collect_diagnostics(self, context: str, alert_labels: Dict[str, str]) -> str:
        """Surface the vmalert rule behind this alert — its expression, state, and health."""
        alert_name = alert_labels.get("alertname")
        if not alert_name:
            return ""

        groups = await self.get_rules()
        for group in groups:
            for rule in group.get("rules", []):
                if rule.get("name") == alert_name and rule.get("type", "alerting") == "alerting":
                    lines = [
                        "### Rule from vmalert",
                        f"**Rule**: {alert_name} — **State**: {rule.get('state', 'unknown')} — "
                        f"**Health**: {rule.get('health', 'unknown')}",
                        "",
                        f"**Expression**: `{rule.get('query', 'n/a')}`",
                    ]
                    duration = rule.get("duration")
                    if duration:
                        lines.append(f"**For**: {duration}s")
                    last_err = rule.get("lastError")
                    if last_err:
                        lines.append(f"**Last error**: {last_err}")
                    lines.append(f"\n*Source: {self.url}*")
                    return "\n".join(lines)
        return ""

    async def list_resources(self, context: str = None) -> List[Dict[str, Any]]:
        return []

    async def get_time_series(self) -> Dict[str, Any]:
        return {"cpu": [], "memory": []}
