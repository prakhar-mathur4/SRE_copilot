"""
Facade for automated diagnostics collection using the Provider architecture.
"""
import logging
from typing import Dict, Any, List
from bot.providers import registry

logger = logging.getLogger("sre_copilot")

async def get_cluster_health_metrics() -> List[Dict[str, Any]]:
    if not registry._providers:
        registry.load_connectors()
    health_reports = []
    for provider_id, provider in registry._providers.items():
        try:
            health = await provider.get_health_metrics()
            # Inject connector metadata for the UI
            health["id"] = provider_id
            health_reports.append(health)
        except Exception as e:
            logger.error(f"Error fetching health from {provider_id}: {e}")
            health_reports.append({
                "id": provider_id,
                "name": provider.provider_name if hasattr(provider, 'provider_name') else provider_id,
                "status": "offline",
                "cpu_usage": 0,
                "memory_usage": 0,
                "nodes_online": 0,
                "nodes_total": 0
            })
    return health_reports

async def collect_diagnostics(namespace: str, alert_labels: Dict[str, str]) -> str:
    """Collect diagnostic telemetry for an alert.

    Returns a markdown string (may be empty if no data is available).
    Never raises — callers should treat an empty return as "telemetry unavailable".
    """
    if not registry._providers:
        registry.load_connectors()

    provider = registry.find_best_provider(alert_labels)

    if provider is not None:
        logger.info(f"Routing diagnostics to matched provider: {provider.provider_name}")
        try:
            return await provider.collect_diagnostics(namespace, alert_labels)
        except Exception as e:
            logger.warning(f"Diagnostics failed on matched provider ({provider.provider_name}): {e}")
            return ""

    # No heuristic match — fan out to all Prometheus providers
    from bot.providers.prometheus_provider import PrometheusProvider
    parts: List[str] = []
    for p_id, p in registry._providers.items():
        if isinstance(p, PrometheusProvider) and p.prometheus_url:
            try:
                data = await p.collect_diagnostics(namespace, alert_labels)
                if data:
                    parts.append(data)
            except Exception as e:
                logger.warning(f"Prometheus provider {p_id} diagnostic failed: {e}")

    return "\n\n".join(parts)

async def list_all_pods(namespace: str = None) -> list:
    if not registry._providers:
        registry.load_connectors()
    all_resources = []
    for provider_id, provider in registry._providers.items():
        try:
            resources = await provider.list_resources(namespace)
            # Annotate resource with provider source
            for res in resources:
                res["provider_id"] = provider_id
            all_resources.extend(resources)
        except Exception as e:
            logger.error(f"Error fetching resources from {provider_id}: {e}")
            
    return all_resources

async def get_pod_yaml(pod_name: str, namespace: str) -> str:
    # For now, we assume K8s pods are in a K8s provider
    for p_id, p in registry._providers.items():
        if p.provider_type == "kubernetes":
            try:
                # If the provider has a native way to get YAML
                if hasattr(p, 'get_resource_yaml'):
                    return await p.get_resource_yaml(pod_name, namespace)
            except:
                pass
    
    # Fallback to existing logic or mock
    return "apiVersion: v1\nkind: Pod\nmetadata:\n  name: " + pod_name

async def delete_pod(pod_name: str, namespace: str) -> bool:
    # Try all K8s providers
    for p_id, p in registry._providers.items():
        if p.provider_type == "kubernetes":
            try:
                # If provider supports delete
                if hasattr(p, 'delete_resource'):
                    success = await p.delete_resource(pod_name, namespace)
                    if success: return True
            except:
                continue
    return False
