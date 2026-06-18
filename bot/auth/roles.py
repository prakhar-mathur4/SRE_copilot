"""
Role ladder + the centralized access policy.

Rather than decorate ~35 routes individually, authorization is enforced in one
place (middleware.py) against this policy table. Routes are matched by
(method, path-template-regex); first match wins, so order specific-before-generic.
Any /api/v1 route NOT matched here fails closed (requires ADMIN) — new routes
are locked down by default until an explicit policy is added.
"""
import re
from enum import Enum


class Role(str, Enum):
    VIEWER = "viewer"
    RESPONDER = "responder"
    MAINTAINER = "maintainer"
    ADMIN = "admin"
    OWNER = "owner"


_RANK = {
    Role.VIEWER: 0,
    Role.RESPONDER: 1,
    Role.MAINTAINER: 2,
    Role.ADMIN: 3,
    Role.OWNER: 4,
}


def rank(role) -> int:
    """Numeric rank for a Role or role string. Unknown roles rank below
    everything (-1) so they satisfy no requirement."""
    if isinstance(role, Role):
        return _RANK[role]
    try:
        return _RANK[Role(role)]
    except (ValueError, KeyError):
        return -1


def has_at_least(user_role, required_role) -> bool:
    return rank(user_role) >= rank(required_role)


def _to_regex(path_template: str) -> "re.Pattern":
    # {param:path} matches across slashes; {param} matches a single segment.
    pat = re.sub(r"\{[^}/]+:path\}", r".+", path_template)
    pat = re.sub(r"\{[^}/]+\}", r"[^/]+", pat)
    return re.compile("^" + pat + "$")


# (METHOD, path-template, minimum role). Order matters — specific first.
_POLICY_RAW = [
    # --- read-only dashboards (Viewer) ---
    ("GET", "/api/v1/health/cluster", Role.VIEWER),
    ("GET", "/api/v1/health/timeseries/{provider_id}", Role.VIEWER),
    ("GET", "/api/v1/chaos/scenarios", Role.VIEWER),
    ("GET", "/api/v1/noise/stats", Role.VIEWER),
    ("GET", "/api/v1/filters", Role.VIEWER),
    ("GET", "/api/v1/maintenance", Role.VIEWER),
    ("GET", "/api/v1/incidents", Role.VIEWER),
    ("GET", "/api/v1/incidents/{incident_id}", Role.VIEWER),
    ("GET", "/api/v1/pods", Role.VIEWER),
    ("GET", "/api/v1/runbooks", Role.VIEWER),
    ("GET", "/api/v1/ssl/domains", Role.VIEWER),

    # --- responder (incident response + read-deeper + trigger reads) ---
    ("POST", "/api/v1/incidents/{incident_id}/resolve", Role.RESPONDER),
    ("POST", "/api/v1/alerts/test", Role.RESPONDER),
    ("POST", "/api/v1/cel/evaluate", Role.RESPONDER),
    ("GET", "/api/v1/pods/{namespace}/{pod_name}/yaml", Role.RESPONDER),
    ("GET", "/api/v1/runbooks/suggest", Role.RESPONDER),
    ("GET", "/api/v1/runbooks/{page_id}", Role.RESPONDER),
    ("POST", "/api/v1/ssl/check", Role.RESPONDER),
    ("GET", "/api/v1/ssl/check/{domain}", Role.RESPONDER),

    # --- maintainer (operational config + execute/delete incidents) ---
    ("POST", "/api/v1/chaos/trigger", Role.MAINTAINER),
    ("POST", "/api/v1/filters", Role.MAINTAINER),
    ("DELETE", "/api/v1/filters/{name}", Role.MAINTAINER),
    ("POST", "/api/v1/maintenance", Role.MAINTAINER),
    ("DELETE", "/api/v1/maintenance/{id}", Role.MAINTAINER),
    ("DELETE", "/api/v1/incidents/{incident_id}", Role.MAINTAINER),
    ("POST", "/api/v1/runbook/trigger", Role.MAINTAINER),
    ("POST", "/api/v1/runbooks/ping", Role.MAINTAINER),
    ("POST", "/api/v1/connectors", Role.MAINTAINER),
    ("DELETE", "/api/v1/connectors/{connector_id}", Role.MAINTAINER),
    ("POST", "/api/v1/ssl/domains", Role.MAINTAINER),
    ("DELETE", "/api/v1/ssl/domains/{domain:path}", Role.MAINTAINER),

    # --- admin / privileged (secrets + destructive infra) ---
    ("GET", "/api/v1/settings", Role.ADMIN),
    ("POST", "/api/v1/settings/env", Role.ADMIN),
    ("DELETE", "/api/v1/pods/{namespace}/{pod_name}", Role.ADMIN),
]

ACCESS_POLICY = [(m, _to_regex(p), r) for (m, p, r) in _POLICY_RAW]

# Paths whose successful mutation should always be written to the audit log.
_PRIVILEGED_RAW = [
    ("DELETE", "/api/v1/pods/{namespace}/{pod_name}", "pod_deleted"),
    ("POST", "/api/v1/settings/env", "secret_written"),
]
PRIVILEGED_AUDIT = [(m, _to_regex(p), action) for (m, p, action) in _PRIVILEGED_RAW]

# Ops that require a recent password re-prompt (step-up) in addition to role.
_STEP_UP_RAW = [
    ("DELETE", "/api/v1/pods/{namespace}/{pod_name}"),
    ("POST", "/api/v1/settings/env"),
]
STEP_UP_REQUIRED = [(m, _to_regex(p)) for (m, p) in _STEP_UP_RAW]


def required_role(method: str, path: str):
    """Return the minimum Role for (method, path), or None if no policy matches."""
    for m, rx, role in ACCESS_POLICY:
        if m == method and rx.match(path):
            return role
    return None


def privileged_action(method: str, path: str):
    """Return an audit action name if (method, path) is a privileged op, else None."""
    for m, rx, action in PRIVILEGED_AUDIT:
        if m == method and rx.match(path):
            return action
    return None


def requires_step_up(method: str, path: str) -> bool:
    for m, rx in STEP_UP_REQUIRED:
        if m == method and rx.match(path):
            return True
    return False
