/**
 * CENTRALIZED STATE MANAGEMENT
 */
export const state = {
    view: 'dashboard', // 'dashboard', 'active', 'control', 'archive', 'chaos', 'pods', 'settings'
    incidents: [],
    selectedIncidentId: null,
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
    theme: localStorage.getItem('theme') || 'light'
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
    if (!silent) notify();
}

export function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    applyTheme();
    notify();
}

export function applyTheme() {
    if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}
