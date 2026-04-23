# Design Unit 6: Notification System

## Overview
This unit is responsible for all outbound communication to human operators, primarily via Microsoft Teams.

## Cohesion & Coupling
- **Cohesive:** Only handles message formatting (Adaptive Cards) and transmission via HTTP to Teams.
- **Loosely Coupled:** Exposes generic functions like `send_alert`, `send_rca`, `ask_for_runbook_approval`. It hides the complexity of the MS Graph API and Incoming Webhooks from the rest of the bot.
- **Rule:** Uses both Incoming Webhooks and MS Graph API (for active thread replies and auth).

## Components
1. **Teams Notifier Module (`teams_notifier.py`)**

## Related User Stories
- US02: Microsoft Teams Notification
