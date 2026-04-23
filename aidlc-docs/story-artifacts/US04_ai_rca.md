# User Story: AI Root Cause Analysis

**As an** SRE On-Call Engineer
**I want** an AI component to analyze the alert details and collected diagnostics
**So that** I can quickly get a summarized, human-readable hypothesis for the root cause of the incident.

## Acceptance Criteria
- The system must send the alert context (labels, annotations) and the collected diagnostics (logs, events) to an LLM provider (e.g., OpenAI, Anthropic, or local model).
- The prompt sent to the AI must enforce a structured response (e.g., "Summary", "Possible Root Causes", "Suggested Next Steps").
- The bot must receive the analysis and forward it to the MS Teams channel/thread associated with the alert.
- The AI analysis must be generated within a reasonable timeframe (e.g., < 30 seconds).

## Notes/Questions for PM/Architect
- Which LLM provider/model are we targeting for this?
- Are there data privacy concerns preventing us from sending raw pod logs to external cloud AI APIs?
