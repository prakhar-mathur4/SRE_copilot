# Plan: Chaos Engineering Engine (Phase 1)

This plan outlines the development of a "Chaos Engine" for the SRE Copilot. This feature allows SREs to simulate cluster failures to verify the dashboard's responsiveness and the AI's alerting capabilities.

## 📝 Phase 1: Requirements & Design
- [x] Create User Stories for Chaos Engine (`aidlc-docs/story-artifacts/chaos_engine_stories.md`)
- [x] Create Design Document for the Chaos API and state management (`aidlc-docs/design-artifacts/chaos_engine_design.md`)
- [x] Define the initial list of chaos scenarios (Node Failure, API Latency, Mock Alert Spike)

## 🛠️ Phase 2: Backend Implementation
- [x] Implement `ChaosManager` class in `bot/chaos_manager.py` to handle state.
- [x] Add `/api/v1/chaos/scenarios` (GET) and `/api/v1/chaos/trigger` (POST) endpoints to `dashboard_router.py`.
- [x] Integrate `ChaosManager` with `get_cluster_health_metrics` in `diagnostics.py`.

## 🎨 Phase 3: Frontend Integration
- [x] Create a "Chaos Control" tab in the dashboard.
- [x] Implement UI to toggle specific scenarios.
- [x] Add visual feedback when the dashboard is in "Simulation Mode".

## 🧪 Phase 4: Verification
- [ ] Trigger a "Node Outage" simulation and verify the Red Box status in the UI.
- [ ] Verify that disabling chaos restores real metrics immediately.

---
**Approval Required**: Please review this plan. Once approved, I will begin creating the User Stories and Design artifacts.
