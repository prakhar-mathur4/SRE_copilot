"""
Chaos Manager — Handles the registry and state of chaos simulation scenarios.
"""
import logging
from typing import Dict, Any, List
from pydantic import BaseModel

logger = logging.getLogger("sre_copilot")

class ChaosScenario(BaseModel):
    id: str
    name: str
    description: str
    is_active: bool = False

class ChaosManager:
    def __init__(self):
        # Initial set of supported chaos scenarios
        self.scenarios: Dict[str, ChaosScenario] = {
            "node_failure": ChaosScenario(
                id="node_failure",
                name="Node Outage",
                description="Simulates a complete loss of a cluster node."
            ),
            "cpu_spike": ChaosScenario(
                id="cpu_spike",
                name="CPU Saturation",
                description="Simulates 100% CPU usage across the cluster."
            ),
            "mem_leak": ChaosScenario(
                id="mem_leak",
                name="Memory Leak",
                description="Simulates rapidly climbing memory usage."
            )
        }

    def get_all_scenarios(self) -> List[ChaosScenario]:
        return list(self.scenarios.values())

    def toggle_scenario(self, scenario_id: str, active: bool) -> bool:
        if scenario_id in self.scenarios:
            self.scenarios[scenario_id].is_active = active
            logger.info(f"Chaos scenario '{scenario_id}' set to active={active}")
            return True
        return False

    def apply_chaos(self, real_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Intercepts real metrics and modifies them based on active chaos scenarios.
        """
        if not any(s.is_active for s in self.scenarios.values()):
            return real_metrics

        # Work on a copy to avoid mutating source data unexpectedly
        mocked_metrics = real_metrics.copy()
        mocked_metrics["simulation_mode"] = True

        # Scenario: Node Failure
        if self.scenarios["node_failure"].is_active:
            # Report 0 nodes online if we have at least 1 node
            if mocked_metrics.get("nodes_total", 0) > 0:
                mocked_metrics["nodes_online"] = 0
            mocked_metrics["status"] = "critical"

        # Scenario: CPU Spike
        if self.scenarios["cpu_spike"].is_active:
            mocked_metrics["cpu_usage"] = 99.9

        # Scenario: Memory Leak
        if self.scenarios["mem_leak"].is_active:
            mocked_metrics["memory_usage"] = 95.5

        return mocked_metrics

# Global singleton
chaos_manager = ChaosManager()
