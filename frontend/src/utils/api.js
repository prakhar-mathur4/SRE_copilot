/**
 * API & WEBSOCKET UTILITIES
 */
import { state, updateState, notify } from './state';

export const API_BASE = 'http://localhost:8000/api/v1';
export const WS_URL = 'ws://localhost:8000/api/v1/ws/alerts';

export async function fetchIncidents() {
    try {
        const res = await fetch(`${API_BASE}/incidents`);
        const incidents = await res.json();
        updateState({ incidents });
    } catch (e) {
        console.error("Failed to fetch incidents", e);
    }
}

export async function updateHealth() {
    try {
        const res = await fetch(`${API_BASE}/health/cluster`);
        const data = await res.json();
        updateState({ 
            environments: data.environments || [],
            isSimulationMode: data.simulation_mode || false
        });
    } catch (e) {
        updateState({ environments: [] });
    }
}

export async function fetchTimeSeries(providerId) {
    try {
        const res = await fetch(`${API_BASE}/health/timeseries/${providerId}`);
        return await res.json();
    } catch (e) {
        console.error(`Failed to fetch timeseries for ${providerId}`, e);
        return { error: 'Network failure' };
    }
}

export function connectWebSocket(onMessage) {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        updateState({ wsConnected: true });
        console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WS Message:", data);
        if (onMessage) onMessage(data);
    };

    ws.onclose = () => {
        updateState({ wsConnected: false });
        console.log("WebSocket disconnected, retrying...");
        setTimeout(() => connectWebSocket(onMessage), 3000);
    };

    return ws;
}

export async function triggerAlert(alertData) {
    // Ensure every test alert has a unique fingerprint to prevent ID collisions
    const uniqueAlert = {
        ...alertData,
        fingerprint: alertData.fingerprint || `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };
    return fetch(`${API_BASE}/alerts/test`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(uniqueAlert)
    });
}

export async function resolveIncident(incidentId) {
    return fetch(`${API_BASE}/incidents/${incidentId}/resolve`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    });
}

// Filter Rules
export async function fetchFilters() {
    const res = await fetch(`${API_BASE}/filters`);
    return await res.json();
}

export async function addFilter(rule) {
    return fetch(`${API_BASE}/filters`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(rule)
    });
}

export async function deleteFilter(name) {
    return fetch(`${API_BASE}/filters/${name}`, { method: 'DELETE' });
}

// Maintenance Windows
export async function fetchMaintenance() {
    const res = await fetch(`${API_BASE}/maintenance`);
    return await res.json();
}

export async function addMaintenance(window) {
    return fetch(`${API_BASE}/maintenance`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(window)
    });
}

export async function deleteMaintenance(id) {
    return fetch(`${API_BASE}/maintenance/${id}`, { method: 'DELETE' });
}

// Noise Reduction Stats
export async function fetchNoiseStats() {
    const res = await fetch(`${API_BASE}/noise/stats`);
    return await res.json();
}

// CEL Evaluation
export async function evaluateCel(expression, alert) {
    const res = await fetch(`${API_BASE}/cel/evaluate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ expression, alert })
    });
    return await res.json();
}

// Settings
export async function fetchSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    return await res.json();
}

export async function updateSettings(settings) {
    return fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(settings)
    });
}

// Multi-Connector API
export async function updateEnvSettings(env) {
    return fetch(`${API_BASE}/settings/env`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(env)
    });
}

export async function addConnector(connector) {
    return fetch(`${API_BASE}/connectors`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(connector)
    });
}

export async function deleteConnector(id) {
    return fetch(`${API_BASE}/connectors/${id}`, {
        method: 'DELETE'
    });
}
