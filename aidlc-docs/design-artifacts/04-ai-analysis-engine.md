# Design Unit 4: AI Analysis Engine

## Overview
This unit receives the sanitized alert metadata and the output from the Diagnostics Engine and prompts an LLM to generate a Root Cause Analysis (RCA).

## Cohesion & Coupling
- **Cohesive:** Solely responsible for constructing prompts, handling LLM API interactions, and parsing the LLM response into a structured format.
- **Loosely Coupled:** It does not know where the diagnostics came from or where the output is going. It is a pure data transformation engine (Context -> Prompt -> RCA).

## Components
1. **AI Request Module (`ai_analysis.py`)**
2. **Prompt Templates (e.g., in a separate config or constant file)**

## Related User Stories
- US04: AI Root Cause Analysis
