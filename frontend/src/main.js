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
    
    // Real-time Updates
    connectWebSocket((data) => {
        if (data.type === 'INCIDENT_UPDATE' || data.type === 'EVENT_ADDED' || data.type === 'RCA_COMPLETE' || data.type === 'RUNBOOK_EXECUTED') {
            fetchIncidents();
        }
    });

    // Subscribe to state changes to trigger re-renders
    let currentView = state.view;
    let incidentCount = state.incidents.length;
    
    subscribe((newState) => {
        renderHeader();
        renderSidebar();
        
        // Re-render the view if navigation changed OR if we got new incidents while on the active view
        const viewChanged = currentView !== newState.view;
        const incidentsChanged = incidentCount !== newState.incidents.length;
        
        if (viewChanged || (newState.view === 'active' && incidentsChanged)) {
            currentView = newState.view;
            incidentCount = newState.incidents.length;
            renderView(newState.view);
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

// Start the app
init();
