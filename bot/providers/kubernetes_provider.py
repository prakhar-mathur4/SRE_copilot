import logging
from typing import Dict, Any, List
from bot.providers.base import DiagnosticProvider

try:
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    
    v1_api = client.CoreV1Api()
    custom_api = client.CustomObjectsApi()
    k8s_available = True
except Exception as e:
    k8s_available = False

logger = logging.getLogger("sre_copilot")

def _parse_quantity(quantity: str) -> float:
    if not quantity: return 0
    if quantity.endswith('m'):
        return float(quantity[:-1]) / 1000.0
    multipliers = {'Ki': 1024, 'Mi': 1024**2, 'Gi': 1024**3, 'k': 1000, 'm': 1000**2, 'g': 1000**3}
    for unit, mult in multipliers.items():
        if quantity.endswith(unit):
            return float(quantity[:-len(unit)]) * mult
    try:
        return float(quantity)
    except:
        return 0

class KubernetesProvider(DiagnosticProvider):
    
    async def get_health_metrics(self) -> Dict[str, Any]:
        if not k8s_available:
            return {
                "cpu_usage": 0,
                "memory_usage": 0,
                "error_rate": 0.0,
                "nodes_online": 0,
                "nodes_total": 0,
                "status": "offline",
                "name": "Kubernetes Cluster",
                "simulation_mode": False
            }

        try:
            nodes = v1_api.list_node()
            nodes_total = len(nodes.items)
            nodes_online = sum(1 for n in nodes.items if any(c.type == 'Ready' and c.status == 'True' for c in n.status.conditions))
            
            total_cpu_cap = 0
            total_mem_cap = 0
            for n in nodes.items:
                total_cpu_cap += _parse_quantity(n.status.capacity.get('cpu', '0'))
                total_mem_cap += _parse_quantity(n.status.capacity.get('memory', '0'))

            try:
                metrics = custom_api.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "nodes")
                used_cpu = 0
                used_mem = 0
                for m in metrics.get('items', []):
                    used_cpu += _parse_quantity(m['usage']['cpu'])
                    used_mem += _parse_quantity(m['usage']['memory'])
                
                cpu_pct = (used_cpu / total_cpu_cap * 100) if total_cpu_cap > 0 else 0
                mem_pct = (used_mem / total_mem_cap * 100) if total_mem_cap > 0 else 0
            except Exception as e:
                logger.debug(f"Metrics API not available or empty: {e}")
                cpu_pct = 0
                mem_pct = 0

            metrics = {
                "cpu_usage": round(cpu_pct, 1),
                "memory_usage": round(mem_pct, 1),
                "error_rate": 0.0,
                "nodes_online": nodes_online,
                "nodes_total": nodes_total,
                "status": "healthy" if nodes_online == nodes_total else "degraded",
                "name": "Kubernetes Cluster"
            }
            from bot.chaos_manager import chaos_manager
            return chaos_manager.apply_chaos(metrics)
        except Exception as e:
            logger.error(f"Error fetching cluster metrics: {e}")
            return {"error": str(e), "status": "unknown"}

    async def collect_diagnostics(self, context: str, alert_labels: Dict[str, str]) -> str:
        namespace = context or "default"
        logger.info(f"Collecting K8s diagnostics for namespace: {namespace}")
        
        if not k8s_available:
            return "Infrastructure Error: Kubernetes API is currently unreachable. Diagnostics cannot be collected."
            
        diagnostics = []
        pod_name = alert_labels.get("pod")
        deployment_name = alert_labels.get("deployment")
        
        try:
            if pod_name:
                diagnostics.append(f"Analyzing specific pod: {pod_name}")
                pod = v1_api.read_namespaced_pod(name=pod_name, namespace=namespace)
                diagnostics.append(f"Pod Status: {pod.status.phase}")
                
                events = v1_api.list_namespaced_event(
                    namespace=namespace,
                    field_selector=f"involvedObject.name={pod_name},involvedObject.kind=Pod"
                )
                for event in events.items[-3:]:
                    diagnostics.append(f"Event [{event.type}]: {event.reason} - {event.message}")
                    
                try:
                    logs = v1_api.read_namespaced_pod_log(name=pod_name, namespace=namespace, tail_lines=20)
                    diagnostics.append(f"\nRecent Logs:\n{logs}")
                except ApiException as e:
                    diagnostics.append(f"Could not retrieve pod logs: {e.reason}")
                    
            elif deployment_name:
                diagnostics.append(f"Analyzing deployment: {deployment_name}")
                pods = v1_api.list_namespaced_pod(namespace=namespace, label_selector=f"app={deployment_name}")
                for p in pods.items:
                    diagnostics.append(f"Pod {p.metadata.name} Status: {p.status.phase}")
                    if p.status.phase != "Running":
                        diagnostics.append(f"Warning: Pod {p.metadata.name} is not running normally.")
            else:
                diagnostics.append("No specific pod or deployment labels found. Collecting general namespace events.")
                events = v1_api.list_namespaced_event(namespace=namespace)
                for event in events.items[-5:]:
                    if event.type != "Normal":
                        diagnostics.append(f"Warning Event [{event.involved_object.kind}/{event.involved_object.name}]: {event.reason} - {event.message}")
        except ApiException as e:
            logger.error(f"Error communicating with Kubernetes API: {e}")
            diagnostics.append(f"Error retrieving Kubernetes state: {e.reason}")
        except Exception as e:
            logger.error(f"Unexpected error during diagnostics: {e}")
            diagnostics.append(f"Unexpected error: {str(e)}")
            
        return "\n".join(diagnostics)


    async def list_resources(self, context: str = None) -> List[Dict[str, Any]]:
        namespace = context
        if not k8s_available:
            return []

        try:
            if namespace:
                pods = v1_api.list_namespaced_pod(namespace)
            else:
                pods = v1_api.list_pod_for_all_namespaces()
            
            pod_metrics = {}
            try:
                if namespace:
                    metrics_resp = custom_api.list_namespaced_custom_object("metrics.k8s.io", "v1beta1", namespace, "pods")
                else:
                    metrics_resp = custom_api.list_cluster_custom_object("metrics.k8s.io", "v1beta1", "pods")
                
                for item in metrics_resp.get("items", []):
                    name = item["metadata"]["name"]
                    ns = item["metadata"]["namespace"]
                    cpu = sum(_parse_quantity(c["usage"]["cpu"]) for c in item["containers"])
                    mem = sum(_parse_quantity(c["usage"]["memory"]) for c in item["containers"])
                    pod_metrics[f"{ns}/{name}"] = {"cpu": cpu, "mem": mem}
            except Exception as e:
                logger.debug(f"Could not fetch pod metrics: {e}")

            result = []
            import datetime
            now = datetime.datetime.now(datetime.timezone.utc)

            for p in pods.items:
                ns = p.metadata.namespace
                name = p.metadata.name
                
                start_time = p.metadata.creation_timestamp
                age_str = "unknown"
                if start_time:
                    diff = now - start_time
                    if diff.days > 0:
                        age_str = f"{diff.days}d"
                    else:
                        hours = diff.seconds // 3600
                        mins = (diff.seconds % 3600) // 60
                        age_str = f"{hours}h {mins}m"

                restarts = sum(c.restart_count for c in p.status.container_statuses) if p.status.container_statuses else 0
                m = pod_metrics.get(f"{ns}/{name}", {"cpu": 0, "mem": 0})
                cpu_val = f"{int(m['cpu'] * 1000)}m" if m['cpu'] > 0 else "0m"
                mem_val = f"{int(m['mem'] / (1024*1024))}Mi" if m['mem'] > 0 else "0Mi"

                owner_kind = "Pod"
                if p.metadata.owner_references:
                    direct_owner = p.metadata.owner_references[0].kind
                    owner_kind = "Deployment" if direct_owner == "ReplicaSet" else direct_owner

                result.append({
                    "name": name,
                    "namespace": ns,
                    "kind": owner_kind,
                    "node_ip": p.status.host_ip or "N/A",
                    "cluster_name": "k8s-cluster",
                    "status": p.status.phase,
                    "cpu_usage": cpu_val,
                    "memory_usage": mem_val,
                    "restarts": restarts,
                    "age": age_str
                })
            return result
        except Exception as e:
            logger.error(f"Error listing pods: {e}")
            return []
