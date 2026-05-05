"""
Alert Noise Reduction & Deduplication Module.
Implements fingerprinting, CEL filtering, and maintenance windows.
"""
import hashlib
import logging
import json
from datetime import datetime
from typing import List, Set, Dict, Optional
import celpy
from bot.models import AlertData, FilterRule, MaintenanceWindow

logger = logging.getLogger("sre_copilot")

class NoiseReducer:
    def __init__(self):
        # Active alert fingerprints (storm protection)
        self.active_fingerprints: Set[str] = set()
        
        # Filtering rules
        self.filter_rules: List[FilterRule] = []
        
        # Maintenance windows
        self.maintenance_windows: List[MaintenanceWindow] = []
        
        # CEL Environment
        self.env = celpy.Environment()
        
    def add_filter_rule(self, rule: FilterRule):
        self.filter_rules.append(rule)
        
    def remove_filter_rule(self, name: str) -> bool:
        initial_len = len(self.filter_rules)
        self.filter_rules = [r for r in self.filter_rules if r.name != name]
        return len(self.filter_rules) < initial_len

    def add_maintenance_window(self, window: MaintenanceWindow):
        self.maintenance_windows.append(window)

    def remove_maintenance_window(self, window_id: str) -> bool:
        initial_len = len(self.maintenance_windows)
        self.maintenance_windows = [w for w in self.maintenance_windows if w.id != window_id]
        return len(self.maintenance_windows) < initial_len

    def calculate_fingerprint(self, alert: AlertData, ignore_fields: List[str] = None) -> str:
        """
        Generates a deterministic hash for an alert based on its labels.
        Optionally strips ephemeral 'ignore_fields'.
        """
        if ignore_fields is None:
            ignore_fields = ["timestamp", "request_id", "trace_id"]
            
        # Extract and sort labels to ensure deterministic hashing
        relevant_labels = {k: v for k, v in alert.labels.items() if k not in ignore_fields}
        
        # Fallback logic: if no relevant labels, use alertname
        if not relevant_labels:
            relevant_labels = {"alertname": alert.labels.get("alertname", "unknown")}
            
        label_string = json.dumps(relevant_labels, sort_keys=True)
        return hashlib.sha256(label_string.encode()).hexdigest()

    def evaluate_cel(self, expression: str, alert: AlertData) -> bool:
        """Evaluates a CEL expression against an alert."""
        try:
            # Prepare the activation (context) for CEL
            # We map labels and annotations for easy access
            activation = {
                "alertname": alert.labels.get("alertname", ""),
                "severity": alert.labels.get("severity", ""),
                "status": alert.status,
                "labels": alert.labels,
                "annotations": alert.annotations,
                "source": alert.labels.get("source", "")
            }
            
            ast = self.env.compile(expression)
            program = self.env.program(ast)
            result = program.evaluate(activation)
            return bool(result)
        except Exception as e:
            logger.error(f"Error evaluating CEL expression '{expression}': {e}")
            return False

    def is_suppressed_by_maintenance(self, alert: AlertData) -> bool:
        """Checks if the alert falls into any active maintenance window."""
        now = datetime.utcnow()
        for window in self.maintenance_windows:
            if window.start_time <= now <= window.end_time:
                if self.evaluate_cel(window.query, alert):
                    return True
        return False

    def should_drop_by_filter(self, alert: AlertData) -> bool:
        """Checks if the alert should be dropped based on filter rules."""
        for rule in self.filter_rules:
            if self.evaluate_cel(rule.expression, alert):
                if rule.action == "discard":
                    logger.info(f"Alert dropped by filter rule: {rule.name}")
                    return True
        return False

    def is_duplicate(self, fingerprint: str) -> bool:
        """Check if this is an exact match of an active alert (Storm Protection)."""
        return fingerprint in self.active_fingerprints

    def mark_active(self, fingerprint: str):
        self.active_fingerprints.add(fingerprint)

    def mark_resolved(self, fingerprint: str):
        if fingerprint in self.active_fingerprints:
            self.active_fingerprints.remove(fingerprint)

    def process_incoming_alert(self, alert: AlertData) -> Optional[str]:
        """
        Processes an incoming alert through the noise reduction pipeline.
        Returns the fingerprint if the alert should proceed, None otherwise.
        """
        # 1. Maintenance Check
        if self.is_suppressed_by_maintenance(alert):
            logger.info(f"Alert suppressed by maintenance window: {alert.labels.get('alertname')}")
            return None
            
        # 2. Filter Rules
        if self.should_drop_by_filter(alert):
            return None
            
        # 3. Fingerprinting & Deduplication
        fingerprint = self.calculate_fingerprint(alert)
        
        if alert.status == "resolved":
            self.mark_resolved(fingerprint)
            return fingerprint # Resolution always proceeds
            
        if self.is_duplicate(fingerprint):
            logger.info(f"Alert dropped as duplicate (Storm Protection): {alert.labels.get('alertname')}")
            return None
            
        self.mark_active(fingerprint)
        return fingerprint

# Global singleton
noise_reducer = NoiseReducer()
