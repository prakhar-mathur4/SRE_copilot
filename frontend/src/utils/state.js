/**
 * CENTRALIZED STATE MANAGEMENT
 */

// ---------------------------------------------------------------------------
// URL Hash Router
// Route format:  #/<view>  or  #/control/<incidentId>
// ---------------------------------------------------------------------------

const VALID_VIEWS = ['dashboard', 'active', 'control', 'archive', 'rules', 'chaos', 'pods', 'settings'];

function parseHash() {
    const hash = window.location.hash.replace(/^#\/?/, ''); // strip leading #/ or #
    if (!hash) return { view: 'dashboard', selectedIncidentId: null };

    const parts = hash.split('/');
    const view = VALID_VIEWS.includes(parts[0]) ? parts[0] : 'dashboard';
    const selectedIncidentId = (view === 'control' && parts[1]) ? parts[1] : null;
    return { view, selectedIncidentId };
}

export function pushRoute(view, incidentId = null) {
    const path = incidentId ? `${view}/${incidentId}` : view;
    window.history.pushState(null, '', `#/${path}`);
}

// Sync state.view + state.selectedIncidentId → URL (called inside updateState)
function syncToUrl(newState) {
    if ('view' in newState || 'selectedIncidentId' in newState) {
        const view = state.view;
        const id   = state.selectedIncidentId;
        const path = (view === 'control' && id) ? `control/${id}` : view;
        const current = window.location.hash.replace(/^#\/?/, '');
        if (current !== path) {
            window.history.pushState(null, '', `#/${path}`);
        }
    }
}

// Read initial view from URL hash on page load
const _initial = parseHash();

export const state = {
    view: _initial.view,
    selectedIncidentId: _initial.selectedIncidentId,
    incidents: [],
    environments: [],
    wsConnected: false,
    chaosScenarios: [],
    isSimulationMode: false,
    pods: [],
    namespaces: [],
    podFilters: {
        namespace: 'all',
        cluster: 'minikube'
    },
    activeIncidentsFilter: 'all',
    archiveFilters: {
        search: '',
        severity: 'all'
    },
    activityLog: [],      // rolling buffer of last 30 WS events for Dashboard feed
    incidentVersion: 0,   // increments on any incident data change, triggers re-render
    theme: 'dark'
}

// Simple event listener pattern for state changes
const listeners = [];

export function subscribe(callback) {
    listeners.push(callback);
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
    };
}

export function notify() {
    listeners.forEach(cb => cb(state));
}

export function updateState(newState, silent = false) {
    Object.assign(state, newState);
    syncToUrl(newState);
    if (!silent) notify();
}

// Handle browser back / forward buttons
window.addEventListener('popstate', () => {
    const { view, selectedIncidentId } = parseHash();
    Object.assign(state, { view, selectedIncidentId });
    notify();
});

export function applyTheme() {
    document.documentElement.classList.add('dark');
}
