/**
 * APPLICATION ENTRY POINT
 */
import './style.css';
import { state, subscribe, applyTheme, updateState } from './utils/state';
import {
    fetchIncidents, updateHealth, connectWebSocket,
    fetchMe, login, changePassword,
} from './utils/api';
import { renderAuthScreen, removeAuthScreen } from './views/Auth';

// Components
import { renderHeader } from './components/Header';
import { renderSidebar } from './components/Sidebar';

// Views
import { renderDashboardView } from './views/Dashboard';
import { renderActiveIncidentsView } from './views/ActiveIncidents';
import { renderControlRoomView } from './views/ControlRoom';
import { renderArchiveView } from './views/Archive';
import { renderRulesView } from './views/Rules';
import { renderChaosView } from './views/Chaos';
import { renderPodsView } from './views/Pods';
import { renderSettingsView } from './views/Settings';
import { renderRunbooksView } from './views/Runbooks';
import { renderSSLView } from './views/SSL';
import { renderUsersView } from './views/Users';

/**
 * AUTH GUARD — runs before the app boots. Routes to the login or
 * forced-password-change screen, then hands off to startApp().
 */
let _appStarted = false;

async function boot() {
    const me = await fetchMe();
    if (!me) { showLogin(); return; }
    updateState({ currentUser: me }, true);
    if (me.must_change_password) { showChange(); return; }
    removeAuthScreen();
    await startApp();
}

function showLogin() {
    renderAuthScreen('login', {
        onLogin: async (username, password) => {
            const r = await login(username, password);
            if (!r.ok) return r.data.detail || 'Login failed.';
            updateState({ currentUser: r.data }, true);
            if (r.data.must_change_password) { showChange(); return null; }
            removeAuthScreen();
            await startApp();
            return null;
        },
    });
}

function showChange() {
    renderAuthScreen('change', {
        onChange: async (newPassword) => {
            const r = await changePassword(null, newPassword);
            if (!r.ok) return r.data.detail || 'Could not update password.';
            updateState({ currentUser: r.data }, true);
            removeAuthScreen();
            await startApp();
            return null;
        },
    });
}

// Session expired or revoked mid-session → return to login (reload is the
// simplest clean teardown of timers/subscriptions/WS).
let _reloading = false;
document.addEventListener('auth:required', () => {
    if (_reloading) return;
    _reloading = true;
    window.location.reload();
});
document.addEventListener('auth:password-change', () => {
    if (_appStarted) showChange();
});

/**
 * APPLICATION STARTUP (post-authentication)
 */
async function startApp() {
    if (_appStarted) return;
    _appStarted = true;
    // Ensure URL has a hash on first load
    if (!window.location.hash) {
        window.history.replaceState(null, '', '#/dashboard');
    }

    // Initial UI Setup
    applyTheme();
    renderHeader();
    renderSidebar();

    // Data Fetching
    await fetchIncidents();
    await updateHealth();
    
    // Background Refresh with countdown
    let _countdown = 5;

    function _doRefresh() {
        updateHealth();
        _countdown = 5;
    }

    setInterval(() => {
        _countdown--;
        const el = document.querySelector('#refresh-countdown');
        if (el) el.textContent = `${_countdown}s`;
        if (_countdown <= 0) _doRefresh();
    }, 1000);

    document.addEventListener('manual-refresh', () => {
        _doRefresh();
        fetchIncidents();
    });

    // Fallback poll — only fires when WebSocket is down, self-heals stale state
    setInterval(() => { if (!state.wsConnected) fetchIncidents(); }, 30000);

    // Time column refresh — re-renders Active Incidents table every 60s so
    // relative timestamps ("5m ago") stay accurate without a full page reload
    setInterval(() => {
        if (state.view === 'active') {
            const container = document.getElementById('main-view');
            if (container) renderActiveIncidentsView(container);
        }
    }, 60000);

    // Real-time Updates
    connectWebSocket((data) => {
        // Push to activity log for Dashboard feed (silent — no full re-render)
        const entry = buildActivityEntry(data);
        if (entry) {
            updateState({ activityLog: [entry, ...state.activityLog].slice(0, 30) }, true);
        }

        // Patch local state directly from WS event — no HTTP round trip needed
        switch (data.type) {
            case 'INCIDENT_UPDATE': {
                const exists = state.incidents.some(i => i.incident_id === data.incident_id);
                if (exists) {
                    patchIncident(data.incident_id, {
                        status:       data.status,
                        severity:     data.severity,
                        last_updated: new Date().toISOString(),
                    });
                } else {
                    // Brand-new incident — full fetch needed to get the complete object.
                    // fetchIncidents() is debounced so 10 new alerts → one request.
                    fetchIncidents();
                }
                break;
            }
            case 'INCIDENT_DELETED': {
                const filtered = state.incidents.filter(i => i.incident_id !== data.incident_id);
                updateState({ incidents: filtered, incidentVersion: state.incidentVersion + 1 });
                break;
            }
            case 'RCA_COMPLETE':
                patchIncident(data.incident_id, { rca_completed: true, rca_report: data.rca });
                break;
            case 'RUNBOOK_EXECUTED':
                patchIncident(data.incident_id, { runbook_executed: true, runbook_action: data.action });
                break;
            case 'DEDUP_UPDATE':
                patchIncident(data.incident_id, { dedup_count: data.dedup_count });
                break;
            case 'EVENT_ADDED': {
                const inc = state.incidents.find(i => i.incident_id === data.incident_id);
                if (inc) patchIncident(data.incident_id, { event_count: (inc.event_count || 0) + 1 });
                break;
            }
        }
    });

    // Subscribe to state changes to trigger re-renders
    let currentView     = state.view;
    let incidentVersion = state.incidentVersion;
    let renderTimer     = null;

    subscribe((newState) => {
        renderHeader();
        renderSidebar();

        const viewChanged      = currentView     !== newState.view;
        const incidentsChanged = incidentVersion !== newState.incidentVersion;

        if (viewChanged) {
            // Navigation is immediate — no debounce
            clearTimeout(renderTimer);
            currentView     = newState.view;
            incidentVersion = newState.incidentVersion;
            renderView(newState.view);
        } else if ((newState.view === 'active' || newState.view === 'archive') && incidentsChanged) {
            // Data update on active/archive view — debounce to collapse burst of patches
            // into a single DOM rebuild after the last event settles
            clearTimeout(renderTimer);
            renderTimer = setTimeout(() => {
                incidentVersion = state.incidentVersion;
                renderView(newState.view);
            }, 150);
        }
    });

    // Initial Render
    renderView(state.view);
}

function renderView(view) {
    const container = document.getElementById('main-view');
    if (!container) return;

    switch (view) {
        case 'dashboard':
            renderDashboardView(container);
            break;
        case 'active':
            renderActiveIncidentsView(container);
            break;
        case 'control':
            renderControlRoomView(container);
            break;
        case 'archive':
            renderArchiveView(container);
            break;
        case 'rules':
            renderRulesView(container);
            break;
        case 'chaos':
            renderChaosView(container);
            break;
        case 'pods':
            renderPodsView(container);
            break;
        case 'settings':
            renderSettingsView(container);
            break;
        case 'runbooks':
            renderRunbooksView(container);
            break;
        case 'ssl':
            renderSSLView(container);
            break;
        case 'users':
            renderUsersView(container);
            break;
        default:
            renderDashboardView(container);
    }
}

function patchIncident(incident_id, patch) {
    const incidents = state.incidents.map(i =>
        i.incident_id === incident_id ? { ...i, ...patch } : i
    );
    updateState({ incidents, incidentVersion: state.incidentVersion + 1 });
}

function buildActivityEntry(data) {
    const ts = new Date().toLocaleTimeString();
    switch (data.type) {
        case 'INCIDENT_UPDATE':
            if (data.status === 'resolved')
                return { ts, color: 'text-alert-green',   msg: `Incident resolved: ${data.alert_name} (${data.incident_id?.slice(0,8)})` };
            return     { ts, color: 'text-alert-orange',  msg: `New incident firing: ${data.alert_name} (${data.incident_id?.slice(0,8)})` };
        case 'RCA_COMPLETE':
            return     { ts, color: 'text-primary-light dark:text-primary-dark', msg: `RCA complete for incident ${data.incident_id?.slice(0,8)}` };
        case 'RUNBOOK_EXECUTED':
            return     { ts, color: 'text-blue-400',      msg: `Runbook executed for ${data.incident_id?.slice(0,8)}: ${data.action || ''}` };
        case 'EVENT_ADDED':
            return     { ts, color: 'text-muted',         msg: data.message || 'Pipeline event' };
        default:
            return null;
    }
}

// Start the app (auth guard first)
boot();
