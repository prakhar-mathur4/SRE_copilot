# Design Unit 7: Incident Timeline System

## Overview
This unit tracks the state of an incident over time, compiling timestamps of major automated events, and generating a final Markdown report when the alert resolves.

## Cohesion & Coupling
- **Cohesive:** Focuses on state management (in-memory or simple DB), event recording, and report formatting.
- **Loosely Coupled:** The Bot core pings this system whenever a milestone occurs (e.g., "AI RCA completed at X time"). It tracks state for 24 hours before considering an incident "stale".
- **Rule:** Reports are only generated for High/Critical severity alerts.

## Components
1. **Timeline Manager / Reporter module**

## Related User Stories
- US06: Incident Timeline and Report
