from abc import ABC, abstractmethod
from typing import Dict, Any, List

class DiagnosticProvider(ABC):
    """
    Base interface for all infrastructure diagnostic providers.
    """

    @abstractmethod
    async def get_health_metrics(self) -> Dict[str, Any]:
        """Fetch general health metrics for the infrastructure."""
        pass

    @abstractmethod
    async def collect_diagnostics(self, context: str, alert_labels: Dict[str, str]) -> str:
        """
        Collect contextual information based on alert labels.
        For K8s: Fetch pod logs and events.
        For VM: Fetch node_exporter metrics, systemd status.
        """
        pass

    @abstractmethod
    async def list_resources(self, context: str = None) -> List[Dict[str, Any]]:
        """
        List resources available in this infrastructure.
        For K8s: List Pods.
        For VM: List instances/services.
        """
        pass
