# Design Document: Chaos Engineering Engine

## 🏗️ Architecture Overiview
The Chaos Engine will act as a **Middleware/Intercept Layer** between the raw Kubernetes diagnostics and the Dashboard API.

### 1. `ChaosManager` (The Registry)
*   A singleton class in the backend that maintains the state of active simulations.
*   **State**: `Dict[scenario_id, is_active]`
*   **Methods**:
    *   `activate_scenario(id)`
    *   `deactivate_scenario(id)`
    *   `apply_chaos(data)`: Intercepts a real metrics payload and modifies it based on active scenarios.

### 2. API Endpoints
*   `GET /api/v1/chaos/scenarios`: Returns a list of available chaos types and their status.
*   `POST /api/v1/chaos/trigger`: Accepts a JSON payload like `{"id": "node_failure", "action": "activate"}`.

### 3. Integration Point
The `get_cluster_health_metrics` function in `diagnostics.py` will be updated to:
1. Fetch real metrics.
2. Call `chaos_manager.apply_chaos(real_metrics)`.
3. Return the result.

## 📁 File Structure
*   `bot/chaos_manager.py`: Core logic and registry.
*   `bot/dashboard_router.py`: API endpoints.
*   `bot/diagnostics.py`: Interception hook.
*   `frontend/src/main.js`: UI toggles.
