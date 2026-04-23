# User Story: Incident Timeline and Report

**As an** SRE Manager
**I want** the system to automatically generate a post-incident timeline and report
**So that** the team can conduct efficient post-mortems without spending hours compiling data.

## Acceptance Criteria
- The bot must log timestamps for: Alert Fired, Diagnostics Collected, AI RCA Generated, Runbook Executed, Alert Resolved.
- When an alert is marked 'resolved', the bot must compile these timestamps into a chronological timeline.
- The AI should summarize the entire event (initial alert -> automated actions -> resolution) into a Markdown report.
- The generated report must be saved to a specific directory (e.g., `sre-copilot/docs/reports/`) or sent out via email/Teams.

## Notes/Questions for PM/Architect
- Should the report only be generated for High/Critical severity alerts? 
    ANSWER: Yes
- How long should we keep state in memory for an active incident to track the timeline before considering it "stale"?
    ANSWER: 24 hours
