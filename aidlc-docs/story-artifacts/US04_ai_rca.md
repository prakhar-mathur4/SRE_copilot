# US04 — AI Root Cause Analysis

| Field | Value |
|---|---|
| **Epic** | Core Incident Pipeline |
| **Priority** | P0 — Critical Path |
| **Status** | ✅ Delivered |
| **Last Updated** | 2026-05-11 |

---

## Story

**As an** SRE on-call engineer,  
**I want** the system to automatically analyse the alert context and collected diagnostics using an AI model and produce a structured root cause hypothesis,  
**So that** I can understand what went wrong and what to do next within seconds, without reading raw logs myself.

---

## Background

Even with diagnostic data collected, an engineer still has to read and interpret logs, correlate events, and form a hypothesis — this takes 10–20 minutes for a complex incident. This story replaces that interpretation work with an AI-generated analysis that is structured, human-readable, and available before the engineer opens the incident. The analysis is the foundation for runbook selection (US05) and the post-mortem report (US06).

---

## Features in Scope

### Feature 1 — GPT-4 Powered Root Cause Analysis
The system sends alert context and collected diagnostics to OpenAI GPT-4 and produces a structured Markdown RCA report.

### Feature 2 — Mock Fallback Mode
When no OpenAI API key is configured, the system produces a realistic mock RCA so the product remains demonstrable in environments without external API access.

---

## Acceptance Criteria

### Feature 1: GPT-4 Powered Root Cause Analysis

**AC1.1** — After successful diagnostic collection, the system calls the OpenAI API (`gpt-4` model) asynchronously with a prompt that includes:
- Alert name, severity, and namespace
- Full alert labels and annotations
- Collected diagnostic output (`raw_diagnostics`)

**AC1.2** — The prompt instructs the model to return a structured Markdown response containing:
- **Root Cause Hypothesis** — what the model believes caused the alert
- **Suggested Mitigation** — specific, actionable next steps

**AC1.3** — Model parameters are fixed for determinism and cost control:
- `temperature: 0.2`
- `max_tokens: 600`

**AC1.4** — The RCA report is stored on the incident (`incident.rca_report`) and made available to:
- The Control Room UI "AI RCA" tab (rendered as Markdown)
- The Teams notification (truncated to 1000 characters — see US02)
- The runbook selection engine (US05)
- The post-mortem report generator (US06)

**AC1.5** — On successful completion:
- `incident.rca_completed` is set to `true`
- A timeline event `"AI Analysis completed"` (source: `AI Engine`) is added
- A `RCA_COMPLETE` WebSocket event is broadcast to all clients:
  ```json
  { "type": "RCA_COMPLETE", "incident_id": "...", "rca": "<markdown_string>" }
  ```

**AC1.6** — If the OpenAI API call fails (network error, rate limit, invalid key), the error is logged and the pipeline continues to the runbook stage with an empty RCA. The incident is not left in a broken state.

---

### Feature 2: Mock Fallback Mode

**AC2.1** — If `OPENAI_API_KEY` is not set in the environment, the system automatically uses a mock RCA generator instead of calling the OpenAI API. No configuration change is required — the fallback is automatic.

**AC2.2** — The mock RCA generator produces a realistic, incident-specific response using the alert name and diagnostic summary. The output follows the same Markdown structure as the real model response (Root Cause Hypothesis + Suggested Mitigation).

**AC2.3** — The mock response is clearly realistic enough for product demonstrations but does not fabricate specific metric values or log lines that do not exist. It contextualises its output using the `alert_name` and `context` fields available on the incident.

**AC2.4** — The Control Room UI, Teams notification, and post-mortem report treat mock RCA output identically to real output — no special labelling or visual differentiation is applied.

---

## Definition of Done

- [ ] AI RCA triggered automatically after successful diagnostic collection
- [ ] OpenAI GPT-4 called with alert context + raw diagnostics in the prompt
- [ ] Response stored as Markdown on `incident.rca_report`
- [ ] `rca_completed: true` set on success
- [ ] `RCA_COMPLETE` WebSocket event broadcast on completion
- [ ] Teams card updated with RCA (truncated to 1000 chars)
- [ ] Pipeline continues gracefully if OpenAI call fails
- [ ] Mock RCA activates automatically when `OPENAI_API_KEY` is absent
- [ ] Mock output uses alert name and context to produce a relevant (not generic) response

---

## Out of Scope

- Anthropic Claude or local LLM (Llama/Ollama) as alternative providers
- Citation enforcement (linking specific log lines or events to the RCA claim)
- Token usage tracking or cost reporting
- Streaming the RCA response to the UI in real time
- Storing historical RCA outputs for model evaluation or fine-tuning
