import os
import json
import logging
from typing import Dict, List, Optional, Any

from bot.providers.base import DiagnosticProvider
from bot.providers.kubernetes_provider import KubernetesProvider
from bot.providers.prometheus_provider import PrometheusProvider
from bot.providers.local_machine_provider import LocalMachineProvider
from bot.providers.alertmanager_provider import AlertmanagerProvider

logger = logging.getLogger("sre_copilot")

class ProviderRegistry:
    def __init__(self):
        self._providers: Dict[str, DiagnosticProvider] = {}
        self._configs: List[Dict[str, Any]] = []
        self.config_path = os.path.join(os.getcwd(), "connectors.json")

    def load_connectors(self):
        """Load and initialize all connectors from JSON."""
        if not os.path.exists(self.config_path):
            logger.warning(f"No connectors.json found at {self.config_path}. Initializing empty.")
            return

        try:
            with open(self.config_path, "r") as f:
                self._configs = json.load(f)
            
            # Clear existing instances
            self._providers = {}
            
            for cfg in self._configs:
                try:
                    p_id = cfg["id"]
                    p_type = cfg["type"]
                    p_url = cfg.get("url")
                    
                    if p_type == "kubernetes":
                        # Use url field as context name for K8s if provided
                        self._providers[p_id] = KubernetesProvider(context=cfg.get("url"))
                    elif p_type == "prometheus":
                        self._providers[p_id] = PrometheusProvider(prometheus_url=p_url)
                    elif p_type == "local_machine":
                        self._providers[p_id] = LocalMachineProvider()
                    elif p_type == "alertmanager":
                        self._providers[p_id] = AlertmanagerProvider(url=p_url, name=cfg.get("name", "Alertmanager"))
                    
                    logger.info(f"Initialized provider: {p_id} ({p_type})")
                except Exception as e:
                    logger.error(f"Failed to initialize provider {cfg.get('id')}: {e}")
        except Exception as e:
            logger.error(f"Error loading connectors.json: {e}")

    def get_provider(self, provider_id: str) -> Optional[DiagnosticProvider]:
        return self._providers.get(provider_id)

    async def list_providers(self) -> List[Dict[str, Any]]:
        if not self._configs:
            self.load_connectors()
            
        # Update status in configs based on live health
        for cfg in self._configs:
            p = self.get_provider(cfg["id"])
            if p:
                try:
                    # Quick status check
                    if p.provider_type == "local_machine":
                        cfg["status"] = "online"
                    elif p.provider_type in ("prometheus", "alertmanager"):
                        health = await p.get_health_metrics()
                        cfg["status"] = health["status"]
                    elif p.provider_type == "kubernetes":
                        cfg["status"] = "online" if p.k8s_available else "offline"
                except:
                    cfg["status"] = "error"
        return self._configs

    def find_best_provider(self, alert_labels: Dict[str, str]) -> DiagnosticProvider:
        """Heuristic to find the best provider for an alert."""
        if not self._providers:
            self.load_connectors()
            
        logger.info(f"Finding best provider for labels: {alert_labels}")
        # 1. If provider_id is explicitly in labels
        if "provider_id" in alert_labels:
            p = self.get_provider(alert_labels["provider_id"])
            if p: return p

        # 2. Local Machine checks
        instance = alert_labels.get("instance", "")
        namespace = alert_labels.get("namespace", "")
        if instance == "local" or namespace == "local-system":
            # Find first local provider
            for p_id, p in self._providers.items():
                if isinstance(p, LocalMachineProvider): return p

        # 3. K8s checks (if pod or namespace is present)
        if "pod" in alert_labels or "namespace" in alert_labels:
            for p_id, p in self._providers.items():
                if isinstance(p, KubernetesProvider): return p

        # 4. Fallback to Prometheus if instance is present
        if instance:
            for p_id, p in self._providers.items():
                if isinstance(p, PrometheusProvider): return p

        # Default to first available or Kubernetes
        return next(iter(self._providers.values())) if self._providers else KubernetesProvider()

# Global Registry Instance
registry = ProviderRegistry()

def init_providers():
    registry.load_connectors()

def get_provider(name: str = None) -> DiagnosticProvider:
    if not name:
        # Backward compatibility: return first available or default
        return next(iter(registry._providers.values())) if registry._providers else KubernetesProvider()
    return registry.get_provider(name)

# Backward compatibility singleton
default_provider = get_provider()
