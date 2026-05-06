/**
 * APPLICATION ENTRY POINT
 */
import './style.css';
import { state, subscribe, applyTheme, updateState } from './utils/state';
import { fetchIncidents, updateHealth, connectWebSocket } from './utils/api';

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

/**
 * INITIALIZATION
 */
async function init() {
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
    
    // Background Refresh
    setInterval(updateHealth, 5000);

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
            case 'RCA_COMPLETE':
                patchIncident(data.incident_id, { rca_completed: true, rca_report: data.rca });
                break;
            case 'RUNBOOK_EXECUTED':
                patchIncident(data.incident_id, { runbook_executed: true, runbook_action: data.action });
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
        } else if (newState.view === 'active' && incidentsChanged) {
            // Data update on active view — debounce to collapse burst of patches
            // into a single DOM rebuild after the last event settles
            clearTimeout(renderTimer);
            renderTimer = setTimeout(() => {
                incidentVersion = state.incidentVersion;
                renderView('active');
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

// Start the app
init();
