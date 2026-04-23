"""
Facade for automated diagnostics collection using the Provider architecture.
"""
from typing import Dict, Any, List
from bot.providers import get_provider

async def get_cluster_health_metrics() -> List[Dict[str, Any]]:
    from bot.providers import _providers, init_providers
    if not _providers:
        init_providers()
        
    health_reports = []
    for provider_name, provider in _providers.items():
        try:
            health = await provider.get_health_metrics()
            health_reports.append(health)
        except Exception as e:
            # Fallback if a provider fails
            health_reports.append({
                "name": provider.provider_name if hasattr(provider, 'provider_name') else provider_name,
                "status": "offline",
                "cpu_usage": 0,
                "memory_usage": 0,
                "nodes_online": 0,
                "nodes_total": 0
            })
    return health_reports

async def collect_diagnostics(namespace: str, alert_labels: Dict[str, str]) -> str:
    # Example logic to decide provider based on alert labels
    # If instance label exists, it might be prometheus VM
    if "instance" in alert_labels and "pod" not in alert_labels:
        provider = get_provider("prometheus")
    else:
        provider = get_provider("kubernetes")
        
    return await provider.collect_diagnostics(namespace, alert_labels)

async def list_all_pods(namespace: str = None) -> list:
    from bot.providers import _providers, init_providers
    if not _providers:
        init_providers()
        
    all_resources = []
    for provider_name, provider in _providers.items():
        try:
            resources = await provider.list_resources(namespace)
            all_resources.extend(resources)
        except Exception as e:
            import logging
            logging.getLogger("sre_copilot").error(f"Error fetching resources from {provider_name}: {e}")
            
    return all_resources

# These K8s-specific methods will eventually be refactored into the provider interface
# if they apply to VMs (e.g. get_instance_yaml, delete_instance) or moved entirely
async def get_pod_yaml(pod_name: str, namespace: str) -> str:
    from bot.providers.kubernetes_provider import k8s_available, v1_api, client
    import logging
    logger = logging.getLogger("sre_copilot")
    
    if not k8s_available:
        return f"apiVersion: v1\nkind: Pod\nmetadata:\n  name: {pod_name}\n  namespace: {namespace}\nspec:\n  containers:\n  - name: app\n    image: nginx"

    try:
        pod = v1_api.read_namespaced_pod(name=pod_name, namespace=namespace)
        import yaml
        pod_dict = client.ApiClient().sanitize_for_serialization(pod)
        return yaml.dump(pod_dict)
    except Exception as e:
        logger.error(f"Error reading pod YAML: {e}")
        return f"Error: {str(e)}"

async def delete_pod(pod_name: str, namespace: str) -> bool:
    from bot.providers.kubernetes_provider import k8s_available, v1_api
    import logging
    logger = logging.getLogger("sre_copilot")
    
    if not k8s_available:
        logger.info(f"Mock delete pod: {pod_name} in {namespace}")
        return True

    try:
        v1_api.delete_namespaced_pod(name=pod_name, namespace=namespace)
        return True
    except Exception as e:
        logger.error(f"Error deleting pod: {e}")
        return False

