from typing import Dict, Any
import os

from bot.providers.base import DiagnosticProvider
from bot.providers.kubernetes_provider import KubernetesProvider
from bot.providers.prometheus_provider import PrometheusProvider
from bot.providers.local_machine_provider import LocalMachineProvider

_providers: Dict[str, DiagnosticProvider] = {}

def init_providers():
    """Initialize providers based on environment variables."""
    # Always try to init Kubernetes Provider
    _providers["kubernetes"] = KubernetesProvider()
    
    # Init Local Machine Provider
    _providers["local_machine"] = LocalMachineProvider()
    
    # Init Prometheus Provider if URL is set
    prom_url = os.getenv("PROMETHEUS_URL")
    if prom_url:
        _providers["prometheus"] = PrometheusProvider(prometheus_url=prom_url)
    # Even if not set, initialize a stub for testing
    else:
        _providers["prometheus"] = PrometheusProvider(prometheus_url="http://localhost:9090")

def get_provider(name: str = "kubernetes") -> DiagnosticProvider:
    """Get a diagnostic provider by name."""
    if not _providers:
        init_providers()
        
    return _providers.get(name, _providers.get("kubernetes"))

# Provide a default singleton-like access for backward compatibility
# We can dynamically select the provider based on the alert payload later.
default_provider = get_provider()
