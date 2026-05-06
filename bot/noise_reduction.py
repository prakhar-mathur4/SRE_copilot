"""
Alert Noise Reduction & Deduplication Module.
Implements fingerprinting, CEL filtering, and maintenance windows.
"""
import hashlib
import logging
import json
from datetime import datetime, timedelta
from typing import List, Set, Dict, Optional, Deque
from collections import deque
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

        # --- Stats counters ---
        self.total_received: int = 0            # every alert that enters the pipeline
        # Rolling 24-hour window — stores UTC timestamps of every received alert
        self._received_timestamps: Deque[datetime] = deque()
        # Rolling 24-hour window — stores UTC timestamps of every suppressed alert
        self._dropped_timestamps: Deque[datetime] = deque()

        self.dedup_count: int = 0
        # fingerprint -> {alert_name, count, last_seen}
        self.dedup_details: Dict[str, dict] = {}

        self.filter_drop_count: int = 0
        self.filter_stats: Dict[str, int] = {}   # rule_name -> drop count

        self.maintenance_suppress_count: int = 0
        self.maintenance_stats: Dict[str, int] = {}  # window_id -> suppress count
        
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

    def is_suppressed_by_maintenance(self, alert: AlertData, window_id_hit: list = None) -> bool:
        """Checks if the alert falls into any active maintenance window."""
        now = datetime.utcnow()
        for window in self.maintenance_windows:
            # Compare as naive UTC regardless of input timezone
            start = window.start_time.replace(tzinfo=None) if window.start_time.tzinfo else window.start_time
            end   = window.end_time.replace(tzinfo=None)   if window.end_time.tzinfo   else window.end_time
            if start <= now <= end:
                if self.evaluate_cel(window.query, alert):
                    if window_id_hit is not None:
                        window_id_hit.append(window.id)
                    return True
        return False

    def should_drop_by_filter(self, alert: AlertData, rule_name_hit: list = None) -> bool:
        """Checks if the alert should be dropped based on filter rules."""
        for rule in self.filter_rules:
            if self.evaluate_cel(rule.expression, alert):
                if rule.action == "discard":
                    logger.info(f"Alert dropped by filter rule: {rule.name}")
                    if rule_name_hit is not None:
                        rule_name_hit.append(rule.name)
                    return True
        return False

    def get_stats(self) -> dict:
        total_dropped = self.dedup_count + self.filter_drop_count + self.maintenance_suppress_count
        noise_pct = round((total_dropped / self.total_received * 100), 1) if self.total_received > 0 else 0.0
        # Prune stale entries before counting
        cutoff = datetime.utcnow() - timedelta(hours=24)
        while self._received_timestamps and self._received_timestamps[0] < cutoff:
            self._received_timestamps.popleft()
        while self._dropped_timestamps and self._dropped_timestamps[0] < cutoff:
            self._dropped_timestamps.popleft()
        received_24h = len(self._received_timestamps)
        dropped_24h  = len(self._dropped_timestamps)
        return {
            "total_received": self.total_received,
            "received_last_24h": received_24h,
            "dropped_last_24h": dropped_24h,
            "processed_last_24h": received_24h - dropped_24h,
            "total_dropped": total_dropped,
            "noise_reduction_pct": noise_pct,
            "total_deduplicated": self.dedup_count,
            "total_filter_dropped": self.filter_drop_count,
            "total_maintenance_suppressed": self.maintenance_suppress_count,
            "dedup_details": [
                {
                    "fingerprint": fp[:16],
                    "alert_name": d["alert_name"],
                    "count": d["count"],
                    "last_seen": d["last_seen"],
                }
                for fp, d in self.dedup_details.items()
            ],
            "filter_stats": self.filter_stats,
            "maintenance_stats": self.maintenance_stats,
        }

    def _record_drop(self) -> None:
        """Stamp a suppression in the 24-hour rolling window."""
        now_ts = datetime.utcnow()
        self._dropped_timestamps.append(now_ts)
        cutoff = now_ts - timedelta(hours=24)
        while self._dropped_timestamps and self._dropped_timestamps[0] < cutoff:
            self._dropped_timestamps.popleft()

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
        alert_name = alert.labels.get('alertname', 'unknown')

        # Only count firing alerts — resolved events are closures, not new alerts
        if alert.status != "resolved":
            self.total_received += 1
            now_ts = datetime.utcnow()
            self._received_timestamps.append(now_ts)
            cutoff = now_ts - timedelta(hours=24)
            while self._received_timestamps and self._received_timestamps[0] < cutoff:
                self._received_timestamps.popleft()

        # 1. Maintenance Check
        window_id_hit: list = []
        if self.is_suppressed_by_maintenance(alert, window_id_hit):
            logger.info(f"Alert suppressed by maintenance window: {alert_name}")
            self.maintenance_suppress_count += 1
            self._record_drop()
            for wid in window_id_hit:
                self.maintenance_stats[wid] = self.maintenance_stats.get(wid, 0) + 1
            return None

        # 2. Filter Rules
        rule_name_hit: list = []
        if self.should_drop_by_filter(alert, rule_name_hit):
            self.filter_drop_count += 1
            self._record_drop()
            for rname in rule_name_hit:
                self.filter_stats[rname] = self.filter_stats.get(rname, 0) + 1
            return None

        # 3. Fingerprinting & Deduplication
        fingerprint = self.calculate_fingerprint(alert)

        if alert.status == "resolved":
            self.mark_resolved(fingerprint)
            return fingerprint  # Resolution always proceeds

        if self.is_duplicate(fingerprint):
            logger.info(f"Alert dropped as duplicate (Storm Protection): {alert_name}")
            self.dedup_count += 1
            self._record_drop()
            detail = self.dedup_details.setdefault(fingerprint, {"alert_name": alert_name, "count": 0, "last_seen": ""})
            detail["count"] += 1
            detail["last_seen"] = datetime.utcnow().isoformat()
            return None

        self.mark_active(fingerprint)
        return fingerprint

# Global singleton
noise_reducer = NoiseReducer()
