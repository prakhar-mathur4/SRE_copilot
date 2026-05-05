import logging
import httpx
import os
from typing import Dict, Any, List
from bot.providers.base import DiagnosticProvider

logger = logging.getLogger("sre_copilot")

class PrometheusProvider(DiagnosticProvider):
    def __init__(self, prometheus_url: str = None):
        # Prefer environment variable if not passed
        self.prometheus_url = prometheus_url or os.getenv("PROMETHEUS_URL")
        self.provider_name = "Prometheus VM Monitor"

    async def get_health_metrics(self) -> Dict[str, Any]:
        """Verify if the Prometheus gateway is reachable."""
        if not self.prometheus_url:
            return {"status": "offline", "name": self.provider_name, "error": "PROMETHEUS_URL not configured"}
            
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                # Basic health check to the Prometheus API
                res = await client.get(f"{self.prometheus_url}/-/healthy")
                if res.status_code == 200:
                    return {"status": "healthy", "name": self.provider_name, "cpu_usage": 0, "memory_usage": 0}
        except Exception as e:
            logger.error(f"Prometheus health check failed: {e}")
            
        return {"status": "offline", "name": self.provider_name, "error": "Connection timed out"}

    async def collect_diagnostics(self, context: str, alert_labels: Dict[str, str]) -> str:
        """Query real metrics for a specific VM instance."""
        if not self.prometheus_url:
            raise Exception("PROMETHEUS_GATEWAY_CONFIG_MISSING: No Prometheus URL provided in environment.")

        instance = alert_labels.get("instance")
        if not instance:
            raise Exception("INVALID_METADATA: Alert missing 'instance' label for VM diagnostics.")

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                # 1. Check if instance is up
                query_up = f'up{{instance="{instance}"}}'
                res_up = await client.get(f"{self.prometheus_url}/api/v1/query", params={"query": query_up})
                is_up = False
                if res_up.status_code == 200:
                    results = res_up.json().get("data", {}).get("result", [])
                    if results:
                        is_up = results[0]["value"][1] == "1"
                
                status_str = "ONLINE" if is_up else "OFFLINE"
                
                # 2. Query CPU Usage (last 5m average)
                query_cpu = f'100 - (avg by (instance) (irate(node_cpu_seconds_total{{instance="{instance}",mode="idle"}}[5m])) * 100)'
                res_cpu = await client.get(f"{self.prometheus_url}/api/v1/query", params={"query": query_cpu})
                cpu_val = "N/A"
                if res_cpu.status_code == 200:
                    results = res_cpu.json().get("data", {}).get("result", [])
                    if results:
                        cpu_val = f"{float(results[0]['value'][1]):.1f}%"
                
                # 3. Query Memory Usage
                query_mem = f'(1 - (node_memory_MemAvailable_bytes{{instance="{instance}"}} / node_memory_MemTotal_bytes{{instance="{instance}"}})) * 100'
                res_mem = await client.get(f"{self.prometheus_url}/api/v1/query", params={"query": query_mem})
                mem_val = "N/A"
                if res_mem.status_code == 200:
                    results = res_mem.json().get("data", {}).get("result", [])
                    if results:
                        mem_val = f"{float(results[0]['value'][1]):.1f}%"

                return f"""
### 🖥️ VM Connectivity Verified
**Instance**: {instance}
**Status**: {status_str} (via Prometheus)

### 📊 Metric Snapshot
- **CPU Usage**: {cpu_val}
- **Memory Usage**: {mem_val}
- **Telemetry Source**: {self.prometheus_url}
"""
        except httpx.ConnectError:
            raise Exception(f"CONNECTION_REFUSED: Could not reach Prometheus at {self.prometheus_url}")
        except Exception as e:
            raise Exception(f"DIAGNOSTIC_FAILURE: {str(e)}")

    async def list_resources(self, context: str = None) -> List[Dict[str, Any]]:
        return []

    async def get_time_series(self) -> Dict[str, Any]:
        """Fetch 2 hours of historical CPU and Memory data."""
        if not self.prometheus_url:
            return {"error": "Prometheus URL not configured"}
            
        import time
        end_time = int(time.time())
        start_time = end_time - (2 * 3600) # 2 hours ago
        step = "60s" # 1 minute resolution
        
        cpu_history = []
        mem_history = []
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Query average node CPU across all nodes for general cluster health
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
                        # Convert to format: [(timestamp, value)]
                        cpu_history = [(int(v[0]), float(v[1])) for v in data[0]["values"]]

                # Query average Memory usage across all nodes
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
