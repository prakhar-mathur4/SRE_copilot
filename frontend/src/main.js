import './style.css'
import { marked } from 'marked'

/**
 * APPLICATION STATE
 */
const state = {
    view: 'active', // 'active', 'control', 'archive'
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
    }
}

const API_BASE = 'http://localhost:8000/api/v1'
const WS_URL = 'ws://localhost:8000/api/v1/ws/alerts'

/**
 * INITIALIZATION
 */
async function init() {
    setupEventListeners();
    await fetchIncidents();
    updateHealth();
    setInterval(updateHealth, 5000);
    connectWebSocket();
    render();
}

/**
 * DATA FETCHING
 */
async function fetchIncidents() {
    try {
        const res = await fetch(`${API_BASE}/incidents`);
        state.incidents = await res.json();
    } catch (e) {
        console.error("Failed to fetch incidents", e);
    }
}

async function updateHealth() {
    try {
        const res = await fetch(`${API_BASE}/health/cluster`);
        const data = await res.json();
        state.environments = data.environments || [];
        state.isSimulationMode = data.simulation_mode || false;
        renderHealthPane();
        renderHeader();
    } catch (e) {
        state.environments = [];
        renderHealthPane();
    }
}

/**
 * WEBSOCKET MANAGEMENT
 */
function connectWebSocket() {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        state.wsConnected = true;
        document.getElementById('connection-status').className = 'w-2 h-2 rounded-full bg-alert-green shadow-[0_0_8px_#00E676]';
        console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WS Message:", data);
        handleWSMessage(data);
    };

    ws.onclose = () => {
        state.wsConnected = false;
        document.getElementById('connection-status').className = 'w-2 h-2 rounded-full bg-alert-red shadow-[0_0_8px_#FF1744]';
        console.log("WebSocket disconnected, retrying...");
        setTimeout(connectWebSocket, 3000);
    };
}

function handleWSMessage(data) {
    if (data.type === 'INCIDENT_UPDATE' || data.type === 'EVENT_ADDED' || data.type === 'RCA_COMPLETE' || data.type === 'RUNBOOK_EXECUTED') {
        fetchIncidents().then(() => {
            render();
            // If the updated incident is currently being viewed, refresh its details
            if (state.view === 'control' && state.selectedIncidentId === data.incident_id) {
                // The main render() already handles switching views/data, 
                // but we might want specific "live" logs updates here.
            }
        });
    }
}

/**
 * EVENT LISTENERS
 */
function setupEventListeners() {
    document.getElementById('nav-active').onclick = () => switchView('active');
    document.getElementById('nav-archive').onclick = () => switchView('archive');
    document.getElementById('nav-chaos').onclick = () => switchView('chaos');
    document.getElementById('nav-pods').onclick = () => switchView('pods');
    
    document.getElementById('fire-test-btn').onclick = async () => {
        await fetch(`${API_BASE}/alerts/test`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                alertname: "CrashLoopBackOff",
                namespace: "production",
                severity: "critical",
                description: "Pod auth-service-v2 is failing to start"
            })
        });
    };
}

function switchView(view, incidentId = null) {
    state.view = view;
    state.selectedIncidentId = incidentId;
    
    // Update nav icons
    document.getElementById('nav-active').className = `p-2 transition-all ${view === 'active' || view === 'control' ? 'text-primary' : 'text-muted hover:text-primary'}`;
    document.getElementById('nav-archive').className = `p-2 transition-all ${view === 'archive' ? 'text-primary' : 'text-muted hover:text-primary'}`;
    document.getElementById('nav-chaos').className = `p-2 transition-all ${view === 'chaos' ? 'text-primary' : 'text-muted hover:text-primary'}`;
    document.getElementById('nav-pods').className = `p-2 transition-all ${view === 'pods' ? 'text-primary' : 'text-muted hover:text-primary'}`;
    
    document.getElementById('view-title').innerText = 
        view === 'active' ? 'Active Incidents' : 
        view === 'control' ? 'Incident Control Room' : 
        view === 'chaos' ? 'Chaos Engineering Engine' : 
        view === 'pods' ? 'Resource Inventory & Management' : 'Post-Mortem Archive';
    
    render();
}

/**
 * RENDERING LOGIC
 */
function render() {
    const container = document.getElementById('main-view');
    container.innerHTML = '';
    
    if (state.view === 'active') {
        renderActiveIncidentsView(container);
    } else if (state.view === 'control') {
        renderControlRoomView(container);
    } else if (state.view === 'archive') {
        renderArchiveView(container);
    } else if (state.view === 'chaos') {
        renderChaosView(container);
    } else if (state.view === 'pods') {
        renderPodsView(container);
    }
}

function renderHeader() {
    const header = document.querySelector('header');
    if (!header) return;

    // Check if warning already exists
    let warning = document.getElementById('simulation-warning');
    
    if (state.isSimulationMode) {
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'simulation-warning';
            warning.className = 'absolute top-0 left-1/2 -translate-x-1/2 bg-alert-orange text-background text-[10px] px-4 py-0.5 font-bold uppercase tracking-widest rounded-b-md shadow-lg animate-pulse';
            warning.innerText = '⚠️ Simulation Mode Active';
            header.appendChild(warning);
        }
    } else {
        if (warning) warning.remove();
    }
}

function renderHealthPane() {
    const pane = document.getElementById('health-pane');
    if (!pane) return;

    if (!state.environments || state.environments.length === 0) {
        pane.innerHTML = `
            <div class="pane h-full flex flex-col">
                <div class="pane-header">Global Infrastructure Health</div>
                <div class="p-4 flex-grow flex items-center justify-center text-muted italic text-sm">
                    No environments connected.
                </div>
            </div>
        `;
        return;
    }

    pane.innerHTML = `
        <div class="pane h-full flex flex-col">
            <div class="pane-header">Global Infrastructure Health</div>
            <div class="p-4 flex flex-col gap-6 overflow-y-auto">
                ${state.environments.map(env => `
                    <div class="border border-surface-hover rounded-sm p-3 bg-surface/50">
                        <div class="text-[11px] uppercase font-bold text-primary mb-3 flex items-center justify-between">
                            <span>${env.name || 'Unknown Environment'}</span>
                            <span class="flex items-center gap-1">
                                <span class="w-2 h-2 rounded-full ${env.status === 'healthy' || env.status === 'online' ? 'bg-alert-green' : env.status === 'degraded' ? 'bg-alert-orange' : 'bg-alert-red'}"></span>
                                <span class="text-muted text-[9px]">${env.status || 'unknown'}</span>
                            </span>
                        </div>
                        
                        <div class="flex flex-col gap-3">
                            <div>
                                <div class="flex justify-between text-[9px] mb-1 uppercase text-muted font-bold">
                                    <span>CPU Usage</span>
                                    <span class="text-text">${env.cpu_usage}%</span>
                                </div>
                                <div class="h-1 bg-surface-hover w-full rounded-full overflow-hidden">
                                    <div class="h-full bg-primary transition-all duration-500" style="width: ${env.cpu_usage}%"></div>
                                </div>
                            </div>
                            
                            <div>
                                <div class="flex justify-between text-[9px] mb-1 uppercase text-muted font-bold">
                                    <span>Memory Usage</span>
                                    <span class="text-text">${env.memory_usage}%</span>
                                </div>
                                <div class="h-1 bg-surface-hover w-full rounded-full overflow-hidden">
                                    <div class="h-full bg-primary transition-all duration-500" style="width: ${env.memory_usage}%"></div>
                                </div>
                            </div>
                            
                            ${env.nodes_total > 0 ? `
                                <div class="mt-2 flex items-center justify-between">
                                    <span class="text-[9px] text-muted font-bold uppercase">Nodes Online</span>
                                    <span class="text-[10px] font-mono">${env.nodes_online}/${env.nodes_total}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderActiveIncidentsView(container) {
    let active = state.incidents.filter(i => i.status !== 'resolved');
    
    // Get unique contexts for the filter dropdown
    const uniqueContexts = [...new Set(active.map(i => i.context || 'N/A'))].sort();
    
    // Apply filter
    if (state.activeIncidentsFilter !== 'all') {
        active = active.filter(i => (i.context || 'N/A') === state.activeIncidentsFilter);
    }
    
    const layout = document.createElement('div');
    layout.className = 'grid grid-cols-10 gap-4 h-full min-h-0';
    layout.innerHTML = `
        <div class="col-span-7 pane flex flex-col min-h-0">
            <div class="pane-header flex justify-between items-center">
                <span>Firing Alerts (${active.length})</span>
                <select id="incident-context-filter" class="bg-background border border-surface-hover rounded-sm h-6 px-2 text-[10px] text-muted">
                    <option value="all">All Contexts</option>
                    ${uniqueContexts.map(ctx => `<option value="${ctx}" ${state.activeIncidentsFilter === ctx ? 'selected' : ''}>${ctx}</option>`).join('')}
                </select>
            </div>
            <div class="flex-grow overflow-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-surface border-b border-surface-hover text-[10px] uppercase text-muted font-bold">
                        <tr>
                            <th class="p-3">ID</th>
                            <th class="p-3">Severity</th>
                            <th class="p-3">Alert Name</th>
                            <th class="p-3">Context</th>
                            <th class="p-3">Time</th>
                        </tr>
                    </thead>
                    <tbody id="incidents-body">
                        ${active.length === 0 ? `<tr><td colspan="5" class="p-10 text-center text-alert-green font-mono uppercase text-xs">No active incidents. Cluster healthy.</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        </div>
        <div class="col-span-3" id="health-pane"></div>
    `;
    container.appendChild(layout);
    
    // Fill table
    const body = layout.querySelector('#incidents-body');
    active.forEach(inc => {
        const row = document.createElement('tr');
        row.className = 'border-b border-surface-hover hover:bg-surface-hover cursor-pointer transition-colors text-[13px]';
        row.onclick = () => switchView('control', inc.incident_id);
        row.innerHTML = `
            <td class="p-3 font-mono text-[11px] text-muted">${inc.incident_id}</td>
            <td class="p-3"><span class="badge badge-sev${inc.severity.toLowerCase() === 'critical' ? '1' : inc.severity.toLowerCase() === 'warning' ? '2' : '3'}">${inc.severity}</span></td>
            <td class="p-3 font-bold">${inc.alert_name}</td>
            <td class="p-3 font-medium text-muted">${inc.context || 'N/A'}</td>
            <td class="p-3 text-muted">${new Date(inc.start_time).toLocaleTimeString()}</td>
        `;
        body.appendChild(row);
    });
    
    const filterDropdown = layout.querySelector('#incident-context-filter');
    if (filterDropdown) {
        filterDropdown.onchange = (e) => {
            state.activeIncidentsFilter = e.target.value;
            renderActiveIncidentsView(container);
        };
    }
    
    renderHealthPane();
}

async function renderControlRoomView(container) {
    if (!state.selectedIncidentId) {
        switchView('active');
        return;
    }

    const res = await fetch(`${API_BASE}/incidents/${state.selectedIncidentId}`);
    const inc = await res.json();

    const layout = document.createElement('div');
    layout.className = 'grid grid-cols-12 gap-4 h-full min-h-0';
    layout.innerHTML = `
        <!-- Timeline -->
        <div class="col-span-2 pane flex flex-col min-h-0">
            <div class="pane-header">Timeline</div>
            <div class="p-4 flex-grow overflow-auto">
                <div class="relative flex flex-col gap-8">
                    ${inc.events.map((e, i) => `
                        <div class="relative pl-6">
                            <div class="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-primary bg-background z-10 ${i === inc.events.length - 1 ? 'shadow-[0_0_8px_#00E5FF]' : ''}"></div>
                            ${i < inc.events.length - 1 ? `<div class="absolute left-1.5 top-4 w-[1px] h-full bg-surface-hover"></div>` : ''}
                            <div class="text-[10px] text-muted mb-1">${new Date(e.timestamp).toLocaleTimeString()}</div>
                            <div class="text-[12px] leading-tight font-medium">${e.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Analysis -->
        <div class="col-span-5 flex flex-col gap-4 min-h-0">
            <div class="pane flex-grow flex flex-col min-h-0">
                <div class="pane-header">AI Root Cause Analysis</div>
                <div class="p-6 flex-grow overflow-auto prose prose-invert prose-sm max-w-none">
                    ${inc.rca_report ? marked.parse(inc.rca_report) : (inc.rca_completed ? '<div class="text-muted italic">Collecting RCA data...</div>' : '<div class="animate-pulse flex items-center gap-2"><div class="w-1 h-4 bg-primary"></div> Analyzing incident context...</div>')}
                </div>
            </div>
        </div>

        <!-- Diagnostics & Runbook -->
        <div class="col-span-5 flex flex-col gap-4 min-h-0">
            <div class="pane flex-grow flex flex-col min-h-0 overflow-hidden">
                <div class="pane-header">Diagnostic Logs</div>
                <div class="terminal flex-grow inner-glow text-primary/80">
                    <div>[00:00:01] INITIALIZING K8S PROBE...</div>
                    <div>[00:00:02] FETCHING DIAGNOSTICS FOR CONTEXT ${inc.context}...</div>
                    ${inc.events.filter(e => e.source === 'Diagnostics').map(e => `<div>[${new Date(e.timestamp).toLocaleTimeString()}] ${e.description}</div>`).join('')}
                    <div class="animate-pulse">_</div>
                </div>
            </div>
            
            <div class="pane h-[200px] flex flex-col border-alert-orange/30">
                <div class="pane-header text-alert-orange">Runbook Execution</div>
                <div class="p-4 flex flex-col h-full bg-alert-orange/5">
                    ${!inc.runbook_executed ? `
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <div class="text-[10px] uppercase font-bold text-alert-orange mb-1">Recommended Action</div>
                                <div class="text-sm font-bold">${inc.recommended_runbook || 'restart_target_resource.sh'}</div>
                            </div>
                            <button class="btn-primary bg-alert-orange hover:brightness-110" id="approve-runbook-btn">Approve</button>
                        </div>
                        <div class="text-[10px] text-muted italic">Requires manual confirmation to proceed with destructive action.</div>
                    ` : `
                        <div class="text-alert-green flex items-center gap-2 font-bold mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             Action Successfully Executed
                        </div>
                        <div class="font-mono text-[10px] text-primary/60">
                            stdout: ${inc.runbook_action}
                            stderr: none
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    container.appendChild(layout);

    // Runbook Approval Logic
    const btn = layout.querySelector('#approve-runbook-btn');
    if (btn) {
        btn.onclick = async () => {
            const confirm = prompt('Type "CONFIRM" to execute the remediation runbook:');
            if (confirm === 'CONFIRM') {
                btn.disabled = true;
                btn.innerText = 'EXECUTING...';
                try {
                    const res = await fetch(`${API_BASE}/runbook/trigger`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            incident_id: inc.incident_id,
                            alert_name: inc.alert_name,
                            rca_summary: "Triggered from UI"
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        switchView('control', inc.incident_id); // Refresh
                    } else {
                        alert("Execution failed: " + data.detail);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        };
    }
}

function renderArchiveView(container) {
    let resolved = state.incidents.filter(i => i.status === 'resolved');

    // Apply Filters
    if (state.archiveFilters.search) {
        const q = state.archiveFilters.search.toLowerCase();
        resolved = resolved.filter(i => 
            i.alert_name.toLowerCase().includes(q) || 
            i.incident_id.toLowerCase().includes(q) ||
            (i.context || '').toLowerCase().includes(q)
        );
    }
    
    if (state.archiveFilters.severity !== 'all') {
        resolved = resolved.filter(i => i.severity.toLowerCase() === state.archiveFilters.severity.toLowerCase());
    }

    const layout = document.createElement('div');
    layout.className = 'flex flex-col gap-4 h-full min-h-0';
    layout.innerHTML = `
        <div class="pane flex flex-col min-h-0">
            <div class="pane-header">Resolved Incidents Ledger</div>
            <div class="p-4 border-b border-surface-hover flex gap-4">
                <input type="text" id="archive-search" placeholder="Search incidents..." value="${state.archiveFilters.search}" class="bg-background border border-surface-hover rounded-sm h-8 px-3 text-[12px] flex-grow focus:outline-none focus:border-primary">
                <select id="archive-sev-filter" class="bg-background border border-surface-hover rounded-sm h-8 px-3 text-[12px] text-muted">
                    <option value="all" ${state.archiveFilters.severity === 'all' ? 'selected' : ''}>All Severities</option>
                    <option value="critical" ${state.archiveFilters.severity === 'critical' ? 'selected' : ''}>Critical</option>
                    <option value="warning" ${state.archiveFilters.severity === 'warning' ? 'selected' : ''}>Warning</option>
                </select>
            </div>
            <div class="flex-grow overflow-auto p-4 flex flex-col gap-3">
                ${resolved.length === 0 ? '<div class="text-center p-10 text-muted italic">No resolved incidents found matching criteria.</div>' : ''}
                ${resolved.map(inc => `
                    <div class="pane hover:border-primary/50 transition-colors cursor-pointer group">
                        <div class="p-4 flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <span class="badge badge-sev${inc.severity.toLowerCase() === 'critical' ? '1' : inc.severity.toLowerCase() === 'warning' ? '2' : '3'}">${inc.severity}</span>
                                <div>
                                    <h3 class="font-bold text-sm">${inc.alert_name}</h3>
                                    <div class="text-[10px] text-muted uppercase font-bold mt-1">${inc.incident_id} • ${inc.context || 'N/A'} • RESOLVED ${new Date(inc.last_updated).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <button class="btn-outline group-hover:border-primary group-hover:text-primary view-report-btn" data-id="${inc.incident_id}">View Report</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    container.appendChild(layout);

    // Search Logic
    const searchInput = layout.querySelector('#archive-search');
    searchInput.oninput = (e) => {
        state.archiveFilters.search = e.target.value;
        // Debounce would be better, but for now direct re-render
        renderArchiveView(container);
    };
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);

    // Filter Logic
    layout.querySelector('#archive-sev-filter').onchange = (e) => {
        state.archiveFilters.severity = e.target.value;
        renderArchiveView(container);
    };

    // Report View Logic
    layout.querySelectorAll('.view-report-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            showReportModal(btn.dataset.id);
        };
    });
}

async function showReportModal(incidentId) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-8';
    overlay.innerHTML = `
        <div class="pane w-full max-w-4xl h-full flex flex-col shadow-2xl">
            <div class="pane-header flex justify-between items-center">
                <span>Incident Post-Mortem Report</span>
                <button id="close-report-modal" class="text-muted hover:text-text">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="flex-grow overflow-auto p-10 bg-surface">
                <div id="report-content" class="prose prose-invert prose-sm max-w-none">
                    <div class="animate-pulse text-muted italic">Retrieving post-mortem artifacts...</div>
                </div>
            </div>
            <div class="p-4 border-t border-surface-hover flex justify-end">
                <button id="close-report-btn" class="btn-outline">Close Ledger</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-report-modal').onclick = close;
    overlay.querySelector('#close-report-btn').onclick = close;
    
    // Fetch and render
    try {
        const res = await fetch(`${API_BASE}/incidents/${incidentId}`);
        const data = await res.json();
        if (data.report) {
            overlay.querySelector('#report-content').innerHTML = marked.parse(data.report);
        } else {
            overlay.querySelector('#report-content').innerHTML = `
                <div class="p-10 border border-surface-hover rounded-sm text-center">
                    <h3 class="text-lg font-bold mb-2">No Report Available</h3>
                    <p class="text-muted text-sm">Post-mortem reports are automatically generated only for resolved incidents with High or Critical severity.</p>
                </div>
            `;
        }
    } catch (e) {
        overlay.querySelector('#report-content').innerText = "Error loading report: " + e.message;
    }
}

async function renderChaosView(container) {
    const res = await fetch(`${API_BASE}/chaos/scenarios`);
    state.chaosScenarios = await res.json();

    const layout = document.createElement('div');
    layout.className = 'flex flex-col gap-6 h-full max-w-4xl mx-auto py-8';
    layout.innerHTML = `
        <div class="flex flex-col gap-2 mb-4">
            <h2 class="text-2xl font-heading font-bold text-primary">Simulation Control Registry</h2>
            <p class="text-muted text-sm">Inject controlled failures into the cluster to verify dashboard resilience and observability pipelines.</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
            ${state.chaosScenarios.map(s => `
                <div class="pane p-6 flex flex-col justify-between group transition-all ${s.is_active ? 'border-alert-orange bg-alert-orange/5' : 'hover:border-primary/50'}">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-lg ${s.is_active ? 'text-alert-orange' : 'text-text'}">${s.name}</h3>
                            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full ${s.is_active ? 'bg-alert-orange text-background' : 'bg-surface-hover text-muted'} uppercase font-bold">
                                ${s.is_active ? 'Active' : 'Standby'}
                            </span>
                        </div>
                        <p class="text-sm text-muted mb-6 leading-relaxed">${s.description}</p>
                    </div>
                    <button class="chaos-toggle-btn w-full py-2 rounded-sm font-bold uppercase tracking-wider text-[11px] transition-all
                        ${s.is_active ? 'bg-alert-orange text-background hover:brightness-110' : 'bg-surface-hover text-text hover:bg-primary/20 hover:text-primary border border-transparent'}
                    " data-id="${s.id}" data-active="${s.is_active}">
                        ${s.is_active ? 'Abort Simulation' : 'Trigger Scenario'}
                    </button>
                </div>
            `).join('')}
        </div>

        ${state.isSimulationMode ? `
            <div class="mt-8 p-4 bg-alert-orange/10 border border-alert-orange/30 rounded-sm flex items-center justify-between">
                <div class="flex items-center gap-3 text-alert-orange">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span class="text-xs font-bold uppercase tracking-wide">Emergency Bypass: Global restoration is available</span>
                </div>
                <button id="abort-all-btn" class="px-4 py-1.5 bg-alert-orange text-background text-[10px] font-bold uppercase rounded-sm hover:brightness-110 transition-all">Abort All Active Chaos</button>
            </div>
        ` : ''}
    `;

    container.appendChild(layout);

    // Event listeners for toggles
    layout.querySelectorAll('.chaos-toggle-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const active = btn.dataset.active === 'true';
            
            await fetch(`${API_BASE}/chaos/trigger`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id, active: !active })
            });
            
            renderChaosView(container); // Re-render this view
            updateHealth(); // Immediate health refresh
        };
    });

    const abortAll = layout.querySelector('#abort-all-btn');
    if (abortAll) {
        abortAll.onclick = async () => {
            for (const s of state.chaosScenarios.filter(sc => sc.is_active)) {
                await fetch(`${API_BASE}/chaos/trigger`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id: s.id, active: false })
                });
            }
            renderChaosView(container);
            updateHealth();
        };
    }
}

/**
 * POD INVENTORY VIEW
 */
async function fetchPods() {
    try {
        const nsParam = state.podFilters.namespace === 'all' ? '' : `?namespace=${state.podFilters.namespace}`;
        const res = await fetch(`${API_BASE}/pods${nsParam}`);
        state.pods = await res.json();
        
        // Update unique namespaces list if we haven't already or if we are in 'all' view
        if (state.podFilters.namespace === 'all') {
            state.namespaces = [...new Set(state.pods.map(p => p.namespace))].sort();
        }
    } catch (e) {
        console.error("Failed to fetch pods", e);
    }
}

async function renderPodsView(container) {
    container.innerHTML = '<div class="p-10 text-center animate-pulse text-primary font-mono">Fetching Pod Registry...</div>';
    await fetchPods();
    container.innerHTML = '';

    const layout = document.createElement('div');
    layout.className = 'flex flex-col gap-4 h-full min-h-0';
    layout.innerHTML = `
        <div class="pane flex flex-col min-h-0">
            <div class="pane-header flex justify-between items-center">
                <span>Resource Registry</span>
                <div class="flex gap-2">
                    <select id="ns-filter" class="bg-background border border-surface-hover rounded-sm h-6 px-2 text-[10px] text-muted">
                        <option value="all">All Contexts</option>
                        ${state.namespaces.map(ns => `<option value="${ns}" ${state.podFilters.namespace === ns ? 'selected' : ''}>${ns}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="flex-grow overflow-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-surface border-b border-surface-hover text-[10px] uppercase text-muted font-bold">
                        <tr>
                            <th class="p-3">Resource Name</th>
                            <th class="p-3">Context</th>
                            <th class="p-3">Kind</th>
                            <th class="p-3">Node IP</th>
                            <th class="p-3">Status</th>
                            <th class="p-3">CPU</th>
                            <th class="p-3">Mem</th>
                            <th class="p-3">Restarts</th>
                            <th class="p-3">Age</th>
                            <th class="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="pods-body">
                        ${state.pods.length === 0 ? `<tr><td colspan="9" class="p-10 text-center text-muted italic">No pods found matching criteria.</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    container.appendChild(layout);

    const body = layout.querySelector('#pods-body');
    state.pods.forEach(pod => {
        const row = document.createElement('tr');
        row.className = 'border-b border-surface-hover hover:bg-surface-hover transition-colors text-[12px] group';
        
        // Status color mapping
        const statusColor = 
            pod.status === 'Running' ? 'text-alert-green' : 
            pod.status === 'Pending' ? 'text-alert-orange' : 'text-alert-red';

        row.innerHTML = `
            <td class="p-3 font-bold">${pod.name}</td>
            <td class="p-3 text-muted">${pod.namespace}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full bg-surface-hover text-muted text-[10px] font-bold uppercase">${pod.kind}</span></td>
            <td class="p-3 font-mono text-[10px] text-muted">${pod.node_ip}</td>
            <td class="p-3"><span class="${statusColor} font-bold">${pod.status}</span></td>
            <td class="p-3 text-muted">${pod.cpu_usage}</td>
            <td class="p-3 text-muted">${pod.memory_usage}</td>
            <td class="p-3"><span class="${pod.restarts > 0 ? 'text-alert-orange' : 'text-muted'}">${pod.restarts}</span></td>
            <td class="p-3 text-muted">${pod.age}</td>
            <td class="p-3 text-right flex justify-end gap-2">
                <button class="view-yaml-btn p-1.5 hover:text-primary transition-colors" data-name="${pod.name}" data-ns="${pod.namespace}" title="View YAML">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </button>
                <button class="delete-pod-btn p-1.5 hover:text-alert-red transition-colors" data-name="${pod.name}" data-ns="${pod.namespace}" title="Delete Pod">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;
        body.appendChild(row);
    });

    // Event Listeners
    layout.querySelector('#ns-filter').onchange = (e) => {
        state.podFilters.namespace = e.target.value;
        renderPodsView(container);
    };

    layout.querySelectorAll('.view-yaml-btn').forEach(btn => {
        btn.onclick = async () => {
            const { name, ns } = btn.dataset;
            showYamlModal(name, ns);
        };
    });

    layout.querySelectorAll('.delete-pod-btn').forEach(btn => {
        btn.onclick = async () => {
            const { name, ns } = btn.dataset;
            if (confirm(`Are you sure you want to delete resource ${name} in context ${ns}?`)) {
                btn.disabled = true;
                const res = await fetch(`${API_BASE}/pods/${ns}/${name}`, { method: 'DELETE' });
                if (res.ok) {
                    renderPodsView(container);
                } else {
                    alert("Failed to delete pod");
                    btn.disabled = false;
                }
            }
        };
    });
}

async function showYamlModal(name, ns) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-8';
    overlay.innerHTML = `
        <div class="pane w-full max-w-4xl h-full flex flex-col shadow-2xl">
            <div class="pane-header flex justify-between items-center">
                <span>Resource Definition: ${name}</span>
                <button id="close-modal" class="text-muted hover:text-text">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="flex-grow overflow-auto p-0 bg-[#0d1117]">
                <pre id="yaml-content" class="p-6 text-[11px] font-mono leading-relaxed text-primary/90">Loading YAML...</pre>
            </div>
            <div class="p-4 border-t border-surface-hover flex justify-end">
                <button id="close-modal-btn" class="btn-outline">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-modal').onclick = close;
    overlay.querySelector('#close-modal-btn').onclick = close;
    
    // Fetch YAML
    try {
        const res = await fetch(`${API_BASE}/pods/${ns}/${name}/yaml`);
        const data = await res.json();
        overlay.querySelector('#yaml-content').innerText = data.yaml;
    } catch (e) {
        overlay.querySelector('#yaml-content').innerText = "Error loading YAML: " + e.message;
    }
}

// Start the app
init();
