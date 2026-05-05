from typing import Dict, Any, List
import logging
import psutil

from bot.providers.base import DiagnosticProvider

logger = logging.getLogger("sre_copilot")

class LocalMachineProvider(DiagnosticProvider):
    def __init__(self):
        import os
        from collections import deque
        logger.info("Initializing Local Machine Provider")
        self.provider_name = "Local Machine"
        self.provider_type = "local_machine"
        self.monitored_services = os.getenv("MONITORED_SERVICES", "")
        if self.monitored_services:
            self.monitored_services = [s.strip().lower() for s in self.monitored_services.split(",") if s.strip()]
        
        # Store up to 2 hours of data at 5s polling intervals (1440 points)
        self.cpu_history = deque(maxlen=1440)
        self.mem_history = deque(maxlen=1440)

    async def get_health_metrics(self) -> Dict[str, Any]:
        """Fetch local machine CPU and Memory metrics."""
        cpu_usage = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        
        import time
        now = int(time.time())
        self.cpu_history.append((now, round(cpu_usage)))
        self.mem_history.append((now, round(mem.percent)))
        
        return {
            "name": self.provider_name,
            "cpu_usage": round(cpu_usage),
            "memory_usage": round(mem.percent),
            "status": "online",
            "nodes_online": 1,
            "nodes_total": 1,
        }

    async def get_time_series(self) -> Dict[str, Any]:
        """Return the stored 2-hour rolling history."""
        return {
            "cpu": list(self.cpu_history),
            "memory": list(self.mem_history)
        }

    async def collect_diagnostics(self, context: str, alert_labels: Dict[str, str]) -> str:
        """Collect real local system diagnostics (e.g., top processes, load, disk)"""
        diagnostics = []
        diagnostics.append("### 💻 Local Machine Diagnostics")
        
        # 1. System Load
        load1, load5, load15 = psutil.getloadavg()
        diagnostics.append(f"**System Load (1m, 5m, 15m)**: {load1:.2f}, {load5:.2f}, {load15:.2f}")
        
        # 2. CPU usage per core
        cpu_per_core = psutil.cpu_percent(percpu=True)
        diagnostics.append(f"**CPU Usage per Core**: {', '.join([f'{x}%' for x in cpu_per_core])}")
        
        # 3. Disk Usage
        disk = psutil.disk_usage('/')
        diagnostics.append(f"**Disk Usage (/)**: {disk.percent}% used ({disk.free // (1024**3)}GB free of {disk.total // (1024**3)}GB)")
        
        # 4. Top 5 CPU Processes
        diagnostics.append("\n**Top 5 CPU-consuming Processes**:")
        try:
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent']):
                procs.append(p.info)
            # Sort by CPU
            top_procs = sorted(procs, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:5]
            for p in top_procs:
                diagnostics.append(f"- {p['name']} (PID: {p['pid']}): {p['cpu_percent']}% CPU")
        except Exception as e:
            diagnostics.append(f"Error fetching processes: {str(e)}")
            
        return "\n".join(diagnostics)

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
                    "cluster_name": self.provider_name,
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
