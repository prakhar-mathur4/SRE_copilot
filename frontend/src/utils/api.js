/**
 * API & WEBSOCKET UTILITIES
 *
 * All backend calls go through apiFetch(), which:
 *   - resolves the API origin from build-time env (VITE_API_ORIGIN)
 *   - sends the session cookie (credentials: 'include')
 *   - attaches the CSRF token on mutating requests
 *   - surfaces auth failures as DOM events the app guard listens for
 */
import { state, updateState } from './state';
import { promptPassword } from '../views/Auth';
import { toast } from './toast';

// Build-time configurable origin; falls back to local dev. WS scheme is derived
// from the origin so https deployments get wss automatically.
const API_ORIGIN = (import.meta.env && import.meta.env.VITE_API_ORIGIN) || 'http://localhost:8000';
export const API_BASE = `${API_ORIGIN}/api/v1`;
export const WS_URL = `${API_ORIGIN.replace(/^http/, 'ws')}/api/v1/ws/alerts`;

const _MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let _csrfToken = null;

export function setCsrfToken(token) { _csrfToken = token; }
export function getCsrfToken() { return _csrfToken; }

/**
 * Central fetch wrapper. Returns the raw Response (callers can check res.ok /
 * parse json). Dispatches auth events on 401 / forced-change so main.js can
 * route to the login or change-password screen.
 */
function _doFetch(path, options) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (_MUTATING.has(method) && _csrfToken) headers['X-CSRF-Token'] = _csrfToken;
    return fetch(`${API_BASE}${path}`, { ...options, method, headers, credentials: 'include' });
}

export async function apiFetch(path, options = {}) {
    let res;
    try {
        res = await _doFetch(path, options);
    } catch (e) {
        // Network/CORS failure — synthesize a response so callers never crash
        // on `.ok` / `.json()`. apiJson maps this to a friendly toast.
        return new Response(
            JSON.stringify({ detail: 'Cannot reach the server.', code: 'network_error' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
    }

    if (res.status === 401) {
        document.dispatchEvent(new CustomEvent('auth:required'));
        return res;
    }
    if (res.status === 403) {
        let data = {};
        try { data = await res.clone().json(); } catch (_) { /* non-JSON */ }
        if (data.code === 'password_change_required') {
            document.dispatchEvent(new CustomEvent('auth:password-change'));
        } else if (data.code === 'step_up_required') {
            // Prompt for the password, elevate the session, then retry once.
            if (await _handleStepUp()) {
                res = await _doFetch(path, options);
            }
        }
    }
    return res;
}

async function _handleStepUp() {
    const pw = await promptPassword({
        title: 'Confirm your password',
        message: 'This action requires you to re-enter your password.',
    });
    if (!pw) return false;
    return await stepUp(pw);
}

export async function stepUp(password) {
    // Use _doFetch directly so a non-step-up response can't re-trigger the prompt.
    try {
        const res = await _doFetch('/auth/step-up', { method: 'POST', body: JSON.stringify({ password }) });
        return res.ok;
    } catch (e) {
        return false;
    }
}

/** Typed error thrown by apiJson on a non-OK response. */
export class ApiError extends Error {
    constructor(status, code, detail) {
        super(detail || code || `HTTP ${status}`);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.detail = detail;
    }
}

function _friendlyError(status, code, detail) {
    if (code === 'forbidden' || status === 403) return detail || "You don't have permission to do that.";
    if (code === 'token_forbidden') return detail || 'Service-account tokens cannot perform this action.';
    if (status === 404) return detail || 'Not found.';
    if (code === 'network_error' || status === 503) return 'Cannot reach the server. Check your connection.';
    if (status >= 500) return 'Something went wrong on the server. Please try again.';
    return detail || `Request failed (${status}).`;
}

/**
 * apiFetch + res.ok check + JSON parse. Returns parsed body (null for 204), or
 * throws ApiError after surfacing a friendly toast. Use for user-initiated
 * loads/mutations where failures should be visible; background polls that must
 * stay silent keep using apiFetch directly.
 */
export async function apiJson(path, options = {}) {
    const res = await apiFetch(path, options);
    if (res.status === 204) return null;

    let body = null;
    try { body = await res.json(); } catch (_) { /* empty / non-JSON */ }

    if (!res.ok) {
        const code = body && body.code;
        // 401 (redirect) and forced-change / step-up are handled in apiFetch —
        // don't double-surface those.
        if (res.status !== 401 && code !== 'password_change_required' && code !== 'step_up_required') {
            toast(_friendlyError(res.status, code, body && body.detail), 'error');
        }
        throw new ApiError(res.status, code, body && body.detail);
    }
    return body;
}

// --------------------------------------------------------------------------- //
// Authentication
// --------------------------------------------------------------------------- //

export async function login(username, password) {
    // Plain fetch (no csrf yet; must not trigger the 401 auth-required redirect).
    let res;
    try {
        res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });
    } catch (e) {
        return { ok: false, status: 0, data: { detail: 'Cannot reach the server. Is the backend running?' } };
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.csrf_token) setCsrfToken(data.csrf_token);
    return { ok: res.ok, status: res.status, data };
}

export async function fetchMe() {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.csrf_token) setCsrfToken(data.csrf_token);
    return data;
}

export async function changePassword(currentPassword, newPassword) {
    let res;
    try {
        res = await apiFetch('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
    } catch (e) {
        return { ok: false, status: 0, data: { detail: 'Cannot reach the server. Is the backend running?' } };
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.csrf_token) setCsrfToken(data.csrf_token);
    return { ok: res.ok, status: res.status, data };
}

export async function logout() {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
    setCsrfToken(null);
}

// --------------------------------------------------------------------------- //
// User management (admin)
// --------------------------------------------------------------------------- //

export async function listUsers() {
    const res = await apiFetch('/users');
    return res.ok ? res.json() : { users: [] };
}

export async function createUser(payload) {
    const res = await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function updateUser(id, payload) {
    const res = await apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function resetUserPassword(id) {
    const res = await apiFetch(`/users/${id}/reset-password`, { method: 'POST' });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function deleteUser(id) {
    const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

// --------------------------------------------------------------------------- //
// API tokens / service accounts (admin)
// --------------------------------------------------------------------------- //

export async function listTokens() {
    const res = await apiFetch('/tokens');
    return res.ok ? res.json() : { tokens: [] };
}

export async function createToken(payload) {
    const res = await apiFetch('/tokens', { method: 'POST', body: JSON.stringify(payload) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function revokeToken(id) {
    const res = await apiFetch(`/tokens/${id}`, { method: 'DELETE' });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

// --------------------------------------------------------------------------- //
// Incidents & dashboards
// --------------------------------------------------------------------------- //

// Debounced fetch — collapses rapid bursts (e.g. 10 alerts at once) into one request.
let _fetchIncidentsTimer = null;
let _fetchIncidentsVersion = 0;

export async function fetchIncidents() {
    clearTimeout(_fetchIncidentsTimer);
    _fetchIncidentsTimer = setTimeout(async () => {
        const version = ++_fetchIncidentsVersion;
        try {
            const res = await apiFetch('/incidents');
            if (!res.ok) return;
            const incidents = await res.json();
            if (version === _fetchIncidentsVersion) {
                updateState({ incidents, incidentVersion: state.incidentVersion + 1 });
            }
        } catch (e) {
            console.error('Failed to fetch incidents', e);
        }
    }, 200);
}

export async function updateHealth() {
    try {
        const res = await apiFetch('/health/cluster');
        if (!res.ok) return;
        const data = await res.json();
        updateState({
            environments: data.environments || [],
            isSimulationMode: data.simulation_mode || false,
        });
    } catch (e) {
        updateState({ environments: [] });
    }
}

export async function fetchTimeSeries(providerId) {
    try {
        const res = await apiFetch(`/health/timeseries/${providerId}`);
        return await res.json();
    } catch (e) {
        console.error(`Failed to fetch timeseries for ${providerId}`, e);
        return { error: 'Network failure' };
    }
}

// --------------------------------------------------------------------------- //
// WebSocket (open in Phase 0; cookie is sent on the same-site handshake)
// --------------------------------------------------------------------------- //

let _wsRetryDelay = 1000;
const WS_MAX_RETRY_MS = 60000;

export function connectWebSocket(onMessage) {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        _wsRetryDelay = 1000;
        updateState({ wsConnected: true });
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (onMessage) onMessage(data);
        } catch (e) {
            console.error('WS message parse error', e);
        }
    };

    ws.onclose = () => {
        updateState({ wsConnected: false });
        const jitter = Math.random() * 1000;
        const delay = _wsRetryDelay + jitter;
        _wsRetryDelay = Math.min(_wsRetryDelay * 2, WS_MAX_RETRY_MS);
        console.warn(`WS disconnected. Retrying in ${Math.round(delay / 1000)}s…`);
        setTimeout(() => connectWebSocket(onMessage), delay);
    };

    ws.onerror = () => ws.close();
    return ws;
}

// --------------------------------------------------------------------------- //
// Mutations & reads (all routed through apiFetch for credentials + CSRF)
// --------------------------------------------------------------------------- //

export async function triggerAlert(alertData) {
    const uniqueAlert = {
        ...alertData,
        fingerprint: alertData.fingerprint || `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    return apiFetch('/alerts/test', { method: 'POST', body: JSON.stringify(uniqueAlert) });
}

export async function resolveIncident(incidentId) {
    return apiFetch(`/incidents/${incidentId}/resolve`, { method: 'POST' });
}

export async function deleteIncident(incidentId) {
    return apiFetch(`/incidents/${incidentId}`, { method: 'DELETE' });
}

// Filter Rules
export async function fetchFilters() {
    const res = await apiFetch('/filters');
    return await res.json();
}

export async function addFilter(rule) {
    return apiFetch('/filters', { method: 'POST', body: JSON.stringify(rule) });
}

export async function deleteFilter(name) {
    return apiFetch(`/filters/${name}`, { method: 'DELETE' });
}

// Maintenance Windows
export async function fetchMaintenance() {
    const res = await apiFetch('/maintenance');
    return await res.json();
}

export async function addMaintenance(window) {
    return apiFetch('/maintenance', { method: 'POST', body: JSON.stringify(window) });
}

export async function deleteMaintenance(id) {
    return apiFetch(`/maintenance/${id}`, { method: 'DELETE' });
}

// Noise Reduction Stats
export async function fetchNoiseStats() {
    const res = await apiFetch('/noise/stats');
    return await res.json();
}

// CEL Evaluation
export async function evaluateCel(expression, alert) {
    const res = await apiFetch('/cel/evaluate', {
        method: 'POST',
        body: JSON.stringify({ expression, alert }),
    });
    return await res.json();
}

// Settings
export async function fetchSettings() {
    const res = await apiFetch('/settings');
    return await res.json();
}

export async function updateEnvSettings(env) {
    return apiFetch('/settings/env', { method: 'POST', body: JSON.stringify(env) });
}

export async function addConnector(connector) {
    return apiFetch('/connectors', { method: 'POST', body: JSON.stringify(connector) });
}

export async function deleteConnector(id) {
    return apiFetch(`/connectors/${id}`, { method: 'DELETE' });
}

// Confluence Runbooks
export async function fetchRunbooks() {
    const res = await apiFetch('/runbooks');
    return await res.json();
}

export async function fetchRunbookSuggestion(incidentId) {
    const res = await apiFetch(`/runbooks/suggest?incident_id=${encodeURIComponent(incidentId)}`);
    return await res.json();
}

export async function fetchRunbookPage(pageId) {
    const res = await apiFetch(`/runbooks/${encodeURIComponent(pageId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

// SSL Certificate Monitor
export async function fetchSSLDomains() {
    const res = await apiFetch('/ssl/domains');
    return await res.json();
}

export async function addSSLDomain(domain, port = 443) {
    return apiFetch('/ssl/domains', { method: 'POST', body: JSON.stringify({ domain, port }) });
}

export async function deleteSSLDomain(domain, port = 443) {
    return apiFetch(`/ssl/domains/${encodeURIComponent(domain)}?port=${port}`, { method: 'DELETE' });
}

export async function checkAllSSL() {
    return apiFetch('/ssl/check', { method: 'POST' });
}

export async function pingConfluence(payload) {
    const res = await apiFetch('/runbooks/ping', { method: 'POST', body: JSON.stringify(payload) });
    return await res.json();
}
