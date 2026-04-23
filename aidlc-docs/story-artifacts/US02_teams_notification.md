# User Story: Microsoft Teams Notification

**As an** SRE On-Call Engineer
**I want** to receive formatted alerts in Microsoft Teams
**So that** I can immediately be aware of Kubernetes incidents on my phone or desktop.

## Acceptance Criteria
- The bot must send a message to a configured MS Teams channel using a Webhook URL or Graph API.
- The message must be formatted using an Adaptive Card or similar rich text format.
- The message must include clear visual indicators of severity (e.g., Red for Critical, Yellow for Warning).
- The message must contain key incident details: Alert Name, Severity, Summary, Description, and the affected Kubernetes resource (Namespace/Pod).
- When an alert is resolved, a follow-up "Resolved" notification should be sent to the same thread or channel.

## Notes/Questions for PM/Architect
- Will we use incoming Webhooks (simpler) or MS Graph API (allows thread replying and bot interactions) for Teams?
    ANSWER: Incoming Webhooks and MS Graph API 
