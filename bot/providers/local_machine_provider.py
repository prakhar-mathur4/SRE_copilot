from typing import Dict, Any, List
import logging
import psutil

from bot.providers.base import DiagnosticProvider

logger = logging.getLogger("sre_copilot")

class LocalMachineProvider(DiagnosticProvider):
    def __init__(self):
        import os
        logger.info("Initializing Local Machine Provider")
        self.provider_name = "Local Machine"
        self.monitored_services = os.getenv("MONITORED_SERVICES", "")
        if self.monitored_services:
            self.monitored_services = [s.strip().lower() for s in self.monitored_services.split(",") if s.strip()]

    async def get_health_metrics(self) -> Dict[str, Any]:
        """Fetch local machine CPU and Memory metrics."""
        cpu_usage = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        
        return {
            "name": self.provider_name,
            "cpu_usage": round(cpu_usage),
            "memory_usage": round(mem.percent),
            "status": "online",
            "nodes_online": 1,
            "nodes_total": 1,
        }

    async def collect_diagnostics(self, context: str, alert_labels: Dict[str, str]) -> str:
        """Collect local system diagnostics (e.g., top processes)"""
        return "Local machine diagnostics requested. Top processes: ... (mocked)"

    async def list_resources(self, context: str = None) -> List[Dict[str, Any]]:
        """List local processes or resources."""
        processes = []
        try:
            # Get top 15 processes by CPU or Memory
            procs = [p.info for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'create_time', 'status']) if p.info.get('name')]
            
            # Filter by monitored services if configured
            if self.monitored_services:
                filtered_procs = []
                for p in procs:
                    proc_name = p['name'].lower()
                    if any(monitored in proc_name for monitored in self.monitored_services):
                        filtered_procs.append(p)
                procs = filtered_procs

            # Sort by CPU usage and limit to top 15
            procs = sorted(procs, key=lambda p: p.get('cpu_percent') or 0, reverse=True)[:15]
            
            import datetime
            now = datetime.datetime.now().timestamp()
            
            for p in procs:
                diff = now - p.get('create_time', now)
                age_str = "unknown"
                if diff > 0:
                    if diff > 86400:
                        age_str = f"{int(diff // 86400)}d"
                    else:
                        hours = int(diff // 3600)
                        mins = int((diff % 3600) // 60)
                        age_str = f"{hours}h {mins}m"
                        
                processes.append({
                    "name": f"{p['name']} (PID: {p['pid']})",
                    "namespace": "local-system",
                    "kind": "Process",
                    "node_ip": "127.0.0.1",
                    "status": str(p.get('status', 'running')).capitalize(),
                    "cpu_usage": f"{int((p.get('cpu_percent') or 0) * 10)}m",
                    "memory_usage": f"{int(p['memory_info'].rss / (1024 * 1024)) if p.get('memory_info') else 0}Mi",
                    "restarts": 0,
                    "age": age_str
                })
        except Exception as e:
            logger.error(f"Error fetching local processes: {e}")
            
        return processes
