# Design Unit 5: Runbook Automation

## Overview
This unit manages the execution of predefined scripts (runbooks) based on alert characteristics or user approval.

## Cohesion & Coupling
- **Cohesive:** Manages a directory of scripts, validates their safety, maps alerts to specific scripts, and handles the subprocess execution and result reporting.
- **Loosely Coupled:** It receives an "execute command" and returns a "result". It assumes human approval has been obtained and verified externally (e.g., via the Notification System & Bot core).
- **Rule:** We require human approval for all runbooks.

## Components
1. **Runbook Executor Module (`runbook_executor.py`)**
2. **Runbooks Directory (`sre-copilot/runbooks/`)**

## Related User Stories
- US05: Runbook Suggestions and Automation
