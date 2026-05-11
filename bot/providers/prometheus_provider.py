import logging
import httpx
import os
import re
from typing import Dict, Any, List, Optional, Tuple
from bot.providers.base import DiagnosticProvider

logger = logging.getLogger("sre_copilot")

# ---------------------------------------------------------------------------
# PromQL query catalog — keyed by alert-name keyword category
# ---------------------------------------------------------------------------
_QUERY_CATALOG: Dict[str, List[Tuple[str, str]]] = {
    "cpu": [
        ("CPU Usage %",        '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        ("CPU iowait %",       'avg by (instance) (irate(node_cpu_seconds_total{mode="iowait"}[5m])) * 100'),
    ],
    "memory": [
        ("Memory Usage %",     "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100"),
        ("Swap Usage %",       "(1 - (node_memory_SwapFree_bytes / node_memory_SwapTotal_bytes)) * 100"),
    ],
    "disk": [
        ("Disk Usage %",       'avg((1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})) * 100)'),
        ("Disk Read Bytes/s",  "rate(node_disk_read_bytes_total[5m])"),
        ("Disk Write Bytes/s", "rate(node_disk_written_bytes_total[5m])"),
    ],
    "network": [
        ("Net Rx Bytes/s",     "rate(node_network_receive_bytes_total[5m])"),
        ("Net Tx Bytes/s",     "rate(node_network_transmit_bytes_total[5m])"),
        ("Net Errors/s",       "rate(node_network_receive_errs_total[5m]) + rate(node_network_transmit_errs_total[5m])"),
    ],
    "latency": [
        ("CPU Usage %",        '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        ("Net Rx Bytes/s",     "rate(node_network_receive_bytes_total[5m])"),
    ],
    "errors": [
        ("Net Errors/s",       "rate(node_network_receive_errs_total[5m]) + rate(node_network_transmit_errs_total[5m])"),
        ("Disk Read Bytes/s",  "rate(node_disk_read_bytes_total[5m])"),
    ],
    "down": [
        ("CPU Usage %",        '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
        ("Memory Usage %",     "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100"),
        ("Disk Usage %",       'avg((1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})) * 100)'),
    ],
}

_DEFAULT_QUERIES: List[Tuple[str, str]] = _QUERY_CATALOG["down"]

_KEYWORD_MAP: Dict[str, str] = {
    "disk": "disk", "storage": "disk", "filesystem": "disk", "volume": "disk", "inode": "disk",
    "cpu": "cpu", "load": "cpu", "throttl": "cpu",
    "mem": "memory", "memory": "memory", "oom": "memory", "swap": "memory",
    "network": "network", "net": "network", "bandwidth": "network", "packet": "network",
    "latency": "latency", "lag": "latency", "slow": "latency", "timeout": "latency",
    "error": "errors", "fail": "errors", "crash": "errors",
    "down": "down", "unreachable": "down", "offline": "down",
}


def _inject_filter(query: str, key: str, val: str) -> str:
    """Inject a label=value filter into every metric selector in a PromQL expression."""
    kv = f'{key}="{val}"'
    # Add to existing selectors: {existing} → {kv,existing}
    out = re.sub(r'\{([^}]*)\}', lambda m: f'{{{kv},{m.group(1)}}}' if m.group(1) else f'{{{kv}}}', query)
    # Add selector to bare node_* metrics not already followed by {
    out = re.sub(
        r'\b(node_[a-zA-Z0-9_]+)(?!\{)([(\[,\s\)\+\-\*/]|$)',
        lambda m: f'{m.group(1)}{{{kv}}}{m.group(2)}',
        out,
    )
    return out


def _strip_filter(query: str, key: str) -> str:
    """Remove a specific label filter — converts an instance query to cluster-wide fallback."""
    out = re.sub(rf'{re.escape(key)}="[^"]*",?', '', query)
    out = re.sub(r',\s*\}', '}', out)
    out = re.sub(r'\{\s*\}', '', out)
    out = re.sub(r'\{,', '{', out)
    return out


class PrometheusProvider(DiagnosticProvider):
    def __init__(self, prometheus_url: str = None):
        # Prefer environment variable if not passed; strip trailing slash to avoid double-slash URLs
        url = prometheus_url or os.getenv("PROMETHEUS_URL", "")
        self.prometheus_url = url.rstrip("/")
        self.provider_name = "Prometheus VM Monitor"
        self.provider_type = "prometheus"

    async def get_health_metrics(self) -> Dict[str, Any]:
        """Check Prometheus health and fetch real CPU/memory metrics."""
        if not self.prometheus_url:
            return {"status": "offline", "name": self.provider_name, "error": "PROMETHEUS_URL not configured"}

        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                res = await client.get(f"{self.prometheus_url}/-/healthy")
                if res.status_code != 200:
                    return {"status": "offline", "name": self.provider_name, "error": f"HTTP {res.status_code}"}

                cpu_usage = 0
                mem_usage = 0

                query_cpu = '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
                r_cpu = await client.get(f"{self.prometheus_url}/api/v1/query", params={"query": query_cpu})
                if r_cpu.status_code == 200:
                    results = r_cpu.json().get("data", {}).get("result", [])
                    if results:
                        cpu_usage = round(float(results[0]["value"][1]))

                query_mem = '(1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))) * 100'
                r_mem = await client.get(f"{self.prometheus_url}/api/v1/query", params={"query": query_mem})
                if r_mem.status_code == 200:
                    results = r_mem.json().get("data", {}).get("result", [])
                    if results:
                        mem_usage = round(float(results[0]["value"][1]))

                return {
                    "status": "online",
                    "name": self.provider_name,
                    "cpu_usage": cpu_usage,
                    "memory_usage": mem_usage,
                    "nodes_online": 1,
                    "nodes_total": 1,
                }
        except Exception as e:
            logger.error(f"Prometheus unreachable at {self.prometheus_url}: {e}")

        return {"status": "offline", "name": self.provider_name, "error": "Connection timed out"}

    async def collect_diagnostics(self, context: str, alert_labels: Dict[str, str]) -> str:
        """Keyword-based diagnostic telemetry: queries Prometheus for the alert's relevant metrics."""
        if not self.prometheus_url:
            return ""

        # Best available filter label: instance > host > job > agent
        filter_key, filter_val = None, None
        for lk in ("instance", "host", "job", "agent"):
            lv = alert_labels.get(lk)
            if lv:
                filter_key, filter_val = lk, lv
                break

        # Detect relevant query categories from alert name
        alert_name = (alert_labels.get("alertname") or context or "").lower()
        categories: set = set()
        for kw, cat in _KEYWORD_MAP.items():
            if kw in alert_name:
                categories.add(cat)

        queries_to_run: List[Tuple[str, str]] = []
        if categories:
            seen: set = set()
            for cat in sorted(categories):
                for entry in _QUERY_CATALOG.get(cat, []):
                    if entry[0] not in seen:
                        queries_to_run.append(entry)
                        seen.add(entry[0])
        else:
            queries_to_run = list(_DEFAULT_QUERIES)

        lines: List[str] = []
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Target / uptime check
                up_q = f'up{{{filter_key}="{filter_val}"}}' if filter_key else "up"
                up_results = await self._instant_query(client, up_q)

                if up_results:
                    is_up = up_results[0]["value"][1] == "1"
                    inst = up_results[0].get("metric", {}).get("instance", filter_val or "unknown")
                    lines.append("### Telemetry from Prometheus")
                    lines.append(f"**Target**: {inst} — **Status**: {'ONLINE' if is_up else 'OFFLINE'}")
                elif filter_key:
                    lines.append("### Telemetry from Prometheus")
                    lines.append(f"*(No matching target for {filter_key}={filter_val!r} — showing cluster-wide metrics)*")
                else:
                    lines.append("### Telemetry from Prometheus (cluster-wide)")

                lines.append("")
                lines.append("| Metric | Value |")
                lines.append("|--------|-------|")

                for display_name, base_query in queries_to_run:
                    if filter_key:
                        results, is_specific = await self._run_query(client, filter_key, filter_val, base_query)
                    else:
                        results = await self._instant_query(client, base_query)
                        is_specific = False

                    if results:
                        val = self._format_value(display_name, results[0]["value"][1])
                        scope = "" if is_specific else " *(cluster avg)*"
                        lines.append(f"| {display_name} | {val}{scope} |")
                    else:
                        lines.append(f"| {display_name} | N/A |")

        except httpx.ConnectError:
            logger.error(f"Prometheus unreachable at {self.prometheus_url}")
            return ""
        except Exception as e:
            logger.error(f"Prometheus diagnostic query failed: {e}")
            return ""

        lines.append(f"\n*Source: {self.prometheus_url}*")
        return "\n".join(lines)

    async def _instant_query(self, client: httpx.AsyncClient, query: str) -> List[Dict]:
        """Execute a single PromQL instant query; returns result list or []."""
        try:
            r = await client.get(f"{self.prometheus_url}/api/v1/query", params={"query": query})
            if r.status_code == 200:
                return r.json().get("data", {}).get("result", [])
        except Exception:
            pass
        return []

    async def _run_query(self, client: httpx.AsyncClient, key: str, val: str, base_query: str) -> Tuple[List[Dict], bool]:
        """Run query with instance filter; fall back to cluster-wide if no results."""
        filtered = _inject_filter(base_query, key, val)
        results = await self._instant_query(client, filtered)
        if results:
            return results, True
        wide = _strip_filter(filtered, key)
        results = await self._instant_query(client, wide)
        return results, False

    @staticmethod
    def _format_value(display_name: str, raw: Any) -> str:
        """Format a raw Prometheus scalar for display."""
        try:
            num = float(raw)
            if "Bytes" in display_name:
                if num >= 1_048_576:
                    return f"{num / 1_048_576:.1f} MB/s"
                if num >= 1024:
                    return f"{num / 1024:.1f} KB/s"
                return f"{num:.0f} B/s"
            if "Errors/s" in display_name:
                return f"{num:.2f}/s"
            return f"{num:.1f}%"
        except (ValueError, TypeError):
            return str(raw)

    async def list_resources(self, context: str = None) -> List[Dict[str, Any]]:
        return []

    async def get_time_series(self) -> Dict[str, Any]:
        """Fetch 2 hours of historical CPU and Memory data."""
        if not self.prometheus_url:
            return {"error": "Prometheus URL not configured"}

        import time
        end_time = int(time.time())
        start_time = end_time - (2 * 3600)
        step = "60s"

        cpu_history = []
        mem_history = []

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                query_cpu = '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
                res_cpu = await client.get(f"{self.prometheus_url}/api/v1/query_range", params={
                    "query": query_cpu,
                    "start": start_time,
                    "end": end_time,
                    "step": step
                })
                if res_cpu.status_code == 200:
                    data = res_cpu.json().get("data", {}).get("result", [])
                    if data and data[0].get("values"):
                        cpu_history = [(int(v[0]), float(v[1])) for v in data[0]["values"]]

                query_mem = '(1 - (avg by (instance) (node_memory_MemAvailable_bytes) / avg by (instance) (node_memory_MemTotal_bytes))) * 100'
                res_mem = await client.get(f"{self.prometheus_url}/api/v1/query_range", params={
                    "query": query_mem,
                    "start": start_time,
                    "end": end_time,
                    "step": step
                })
                if res_mem.status_code == 200:
                    data = res_mem.json().get("data", {}).get("result", [])
                    if data and data[0].get("values"):
                        mem_history = [(int(v[0]), float(v[1])) for v in data[0]["values"]]

        except Exception as e:
            logger.error(f"Prometheus time series query failed: {e}")
            return {"error": f"Failed to fetch telemetry: {str(e)}"}

        return {
            "cpu": cpu_history,
            "memory": mem_history
        }
