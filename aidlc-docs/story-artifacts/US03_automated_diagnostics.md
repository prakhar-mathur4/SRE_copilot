# User Story: Automated Diagnostics Collection

**As an** SRE On-Call Engineer
**I want** the bot to automatically gather relevant logs, events, and metrics when an alert fires
**So that** I have immediate context for troubleshooting without manually running `kubectl` commands.

## Acceptance Criteria
- Based on the alert labels (e.g., namespace, pod name), the bot must securely connect to the EKS cluster.
- The bot must fetch recent `kubectl events` for the affected namespace/resource.
- The bot must fetch recent logs (e.g., last 100 lines or last 5 minutes) for the affected Pod (if the alert relates to a Pod).
- The collected diagnostics must be formatted and temporarily stored (in memory or a lightweight DB/file) to be passed to the AI engine.
- A summary or link to these diagnostics should ideally be appended to the MS Teams alert.

## Notes/Questions for PM/Architect
- Should we define mapping between alert types and diagnostic commands (e.g., if `OOMKilled`, fetch memory metrics; if `CrashLoopBackOff`, fetch logs)?
    ANSWER: Yes
- Where will the bot run to ensure it has RBAC permissions to fetch this data from EKS?
    ANSWER: EKS a dedicated namespace
