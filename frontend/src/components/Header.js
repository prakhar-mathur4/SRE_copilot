/**
 * HEADER COMPONENT
 */
import { state } from '../utils/state';
import { triggerAlert } from '../utils/api';

export function renderHeader() {
    const header = document.querySelector('header');
    if (!header) return;

    const connectionColor = state.wsConnected ? 'bg-alert-green shadow-[0_0_8px_#10B981]' : 'bg-alert-red shadow-[0_0_8px_#EF4444]';
    
    header.innerHTML = `
        <div class="flex items-center gap-4">
            <h1 class="font-heading text-lg font-bold tracking-tight uppercase flex items-center gap-3">
                <span id="view-title">${getViewTitle(state.view)}</span>
                <span id="connection-status" class="w-2 h-2 rounded-full ${connectionColor}"></span>
            </h1>
            ${state.isSimulationMode ? `
                <div id="simulation-warning" class="bg-alert-orange text-white text-[9px] px-3 py-1 font-bold uppercase tracking-widest rounded-full animate-pulse shadow-lg">
                    ⚠️ Simulation Mode
                </div>
            ` : ''}
        </div>
        
        <div class="flex items-center gap-6">
            <div class="hidden md:flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-primary-light/60 dark:text-muted">
                <button class="px-3 py-1 border border-surface-hover-light dark:border-surface-hover-dark rounded hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors" id="fire-test-btn">Fire Alert</button>
            </div>

        </div>
    `;

    // Events
    const testBtn = header.querySelector('#fire-test-btn');
    if (testBtn) {
        testBtn.onclick = () => showDiagnosticModal();
    }
}

async function showDiagnosticModal() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 glass z-[100] flex items-center justify-center p-6 animate-fade-in';
    overlay.innerHTML = `
        <div class="pane w-full max-w-md shadow-2xl border-primary-light/20 bg-surface-light dark:bg-background-dark/90 backdrop-blur-xl">
            <div class="pane-header flex justify-between items-center h-12">
                <span class="text-[10px] font-black tracking-widest uppercase text-primary-light">Diagnostic Signal Center</span>
                <button id="close-diag" class="modal-close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="p-8 flex flex-col gap-6">
                <div class="text-center">
                    <div class="text-xs text-muted mb-2">Select Target Infrastructure to verify connectivity and diagnostic pipeline health.</div>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    <button id="probe-k8s" class="flex flex-col items-start p-4 rounded-xl border border-surface-hover-light dark:border-surface-hover-dark hover:border-primary-light/40 hover:bg-primary-light/5 transition-all group text-left">
                        <div class="flex items-center gap-3 mb-1">
                            <div class="w-8 h-8 rounded-lg bg-primary-light/10 flex items-center justify-center text-primary-light">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                            </div>
                            <span class="font-bold text-sm">Kubernetes Cluster Probe</span>
                        </div>
                        <span class="text-[10px] text-muted ml-11">Verifies API connectivity, Pod listings, and Manifest retrieval.</span>
                    </button>

                    <button id="probe-local" class="flex flex-col items-start p-4 rounded-xl border border-surface-hover-light dark:border-surface-hover-dark hover:border-accent-success/40 hover:bg-accent-success/5 transition-all group text-left">
                        <div class="flex items-center gap-3 mb-1">
                            <div class="w-8 h-8 rounded-lg bg-accent-success/10 flex items-center justify-center text-accent-success">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                            </div>
                            <span class="font-bold text-sm">VM / Local Node Probe</span>
                        </div>
                        <span class="text-[10px] text-muted ml-11">Verifies OS-level telemetry, Process mapping, and Hardware health.</span>
                    </button>

                    <button id="trigger-sim" class="flex flex-col items-start p-4 rounded-xl border border-alert-red/20 hover:border-alert-red/40 hover:bg-alert-red/5 transition-all group text-left">
                        <div class="flex items-center gap-3 mb-1">
                            <div class="w-8 h-8 rounded-lg bg-alert-red/10 flex items-center justify-center text-alert-red">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>
                            <span class="font-bold text-sm">Simulated Critical Incident</span>
                        </div>
                        <span class="text-[10px] text-muted ml-11">Triggers a full-pipeline simulation (Diagnostics -> AI RCA -> Remediation).</span>
                    </button>
                </div>
                
                <div class="p-3 bg-surface-hover-light dark:bg-surface-hover-dark rounded-lg border border-surface-hover-light dark:border-surface-hover-dark font-mono text-[9px] text-muted">
                    <span class="text-primary-light dark:text-primary-dark">></span> READY_FOR_SIGNAL_INJECTION
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-diag').onclick = close;

    overlay.querySelector('#probe-k8s').onclick = async () => {
        await triggerAlert({
            alertname: "ConnectivityProbe_K8s",
            namespace: "production",
            severity: "info",
            description: "System-generated probe to verify Kubernetes monitoring pipeline connectivity."
        });
        close();
    };

    overlay.querySelector('#probe-local').onclick = async () => {
        await triggerAlert({
            alertname: "ConnectivityProbe_VM",
            namespace: "local-system",
            instance: "local",
            severity: "info",
            description: "System-generated probe to verify VM/Node telemetry and diagnostic routing."
        });
        close();
    };

    overlay.querySelector('#trigger-sim').onclick = async () => {
        await triggerAlert({
            alertname: "SIMULATED_INCIDENT: Database Connection Leak",
            namespace: "local-system",
            instance: "local",
            severity: "critical",
            description: "HIGH_LOAD detected. Potential connection leak in auth-service."
        });
        close();
    };
}

function getViewTitle(view) {
    switch(view) {
        case 'dashboard': return 'Global Dashboard';
        case 'active': return 'Active Incidents';
        case 'control': return 'Incident Control';
        case 'archive': return 'Post-Mortem Ledger';
        case 'chaos': return 'Chaos Control';
        case 'pods': return 'Resource Registry';
        case 'settings': return 'Settings';
        default: return 'Global Dashboard';
    }
}

