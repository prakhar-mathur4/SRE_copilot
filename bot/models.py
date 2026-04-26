from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict, Optional

class AlertData(BaseModel):
    status: str
    labels: Dict[str, str]
    annotations: Dict[str, str]
    startsAt: str
    endsAt: str
    generatorURL: str
    fingerprint: str
    
class AlertmanagerPayload(BaseModel):
    version: str
    groupKey: str
    truncatedAlerts: Optional[int] = 0
    status: str
    receiver: str
    groupLabels: Dict[str, str]
    commonLabels: Dict[str, str]
    commonAnnotations: Dict[str, str]
    externalURL: str
    alerts: List[AlertData]

class FilterRule(BaseModel):
    name: str
    expression: str  # CEL expression
    action: str = "discard"  # "discard" or "allow"

class MaintenanceWindow(BaseModel):
    id: str
    start_time: datetime
    end_time: datetime
    query: str  # CEL expression to match alerts
