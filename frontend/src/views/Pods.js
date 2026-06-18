/**
 * RESOURCE INVENTORY VIEW
 */
import { state, updateState } from '../utils/state';
import { apiFetch } from '../utils/api';

export async function renderPodsView(container) {
    // 1. Initial Layout Render (Static Skeleton)
    container.innerHTML = `
        <div class="flex flex-col gap-4 h-full min-h-0">

            <!-- Header -->
            <div class="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 class="text-lg font-bold">Cluster Resource Registry</h2>
                    <p id="pods-count-label" class="text-[11px] text-muted">Loading...</p>
                </div>
                <div class="flex items-center gap-3">
                    <span id="refresh-indicator" class="text-[11px] font-bold text-success-500 flex items-center gap-1 opacity-0 transition-opacity duration-500">
                        <span class="h-1.5 w-1.5 rounded-full bg-success-500 animate-ping"></span> LIVE
                    </span>
                    <select id="ns-filter" class="bg-neutral-75 border border-neutral-200 rounded px-2 font-bold text-primary-600 focus:outline-none"
                        style="height:26px; font-size:11px;">
                        <option value="all">Global (All)</option>
                        ${state.namespaces.map(ns => `<option value="${ns}" ${state.podFilters.namespace === ns ? 'selected' : ''}>${ns}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div class="pane flex-grow flex flex-col min-h-0 overflow-hidden">
                <div class="flex-grow overflow-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="table-header">
                            <tr>
                                <th class="p-5">Resource Name</th>
                                <th class="p-5">Context</th>
                                <th class="p-5">Cluster</th>
                                <th class="p-5">Kind</th>
                                <th class="p-5">Node IP</th>
                                <th class="p-5">Status</th>
                                <th class="p-5">Age</th>
                                <th class="p-5">CPU</th>
                                <th class="p-5">Mem</th>
                                <th class="p-5">Restarts</th>
                                <th class="p-5 text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody id="pods-body" class="divide-y divide-neutral-200">
                            <tr><td colspan="11" class="p-20 text-center" style="color:#666666; font-size:13px;">Loading resource registry...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const body = container.querySelector('#pods-body');
    const indicator = container.querySelector('#refresh-indicator');
    const nsFilter = container.querySelector('#ns-filter');

    // 2. Data Fetch & Row Rendering Function
    async function refreshData(isInitial = false) {
        // If the user has navigated away, stop the loop
        if (state.view !== 'pods') return false;

        if (!isInitial) indicator.style.opacity = '1';

        try {
            const nsParam = state.podFilters.namespace === 'all' ? '' : `?namespace=${state.podFilters.namespace}`;
            const res = await apiFetch(`/pods${nsParam}`);
            const pods = await res.json();

            const namespaces = [...new Set(pods.map(p => p.namespace))].sort();
            updateState({ pods, namespaces }, true);

            // Update Namespace dropdown if new ones appeared (and we aren't mid-selection)
            if (namespaces.length > state.namespaces.length) {
                const currentVal = nsFilter.value;
                nsFilter.innerHTML = `<option value="all">Global (All)</option>` +
                    namespaces.map(ns => `<option value="${ns}" ${currentVal === ns ? 'selected' : ''}>${ns}</option>`).join('');
            }

            // Clear and Rebuild Rows
            body.innerHTML = pods.length === 0 ? `<tr><td colspan="11" class="empty-state">Registry Empty for Current Context</td></tr>` : '';

            const countLabel = container.querySelector('#pods-count-label');
            if (countLabel) countLabel.textContent = `${pods.length} resource${pods.length !== 1 ? 's' : ''}`;

            pods.forEach(pod => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-neutral-75 transition-colors text-[12px] group';

                const statusColor =
                    pod.status === 'Running' ? 'text-success-500' :
                    pod.status === 'Pending' ? 'text-warning-500' : 'text-danger-500';

                const statusDot =
                    pod.status === 'Running' ? 'bg-success-500' : 'bg-danger-500';

                row.innerHTML = `
                    <td class="p-5 font-bold text-text-light">${pod.name}</td>
                    <td class="p-5 text-muted">${pod.namespace}</td>
                    <td class="p-5 text-muted text-xs uppercase font-bold">${pod.cluster_name || 'Production Cluster'}</td>
                    <td class="p-5"><span class="px-2 py-0.5 rounded bg-primary-50 text-primary-600 text-[11px] font-bold uppercase border border-primary-100">${pod.kind}</span></td>
                    <td class="p-5 font-mono text-xs text-muted">${pod.node_ip}</td>
                    <td class="p-5"><span class="${statusColor} font-bold flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full ${statusDot}"></span>${pod.status}</span></td>
                    <td class="p-5 text-muted font-medium">${pod.age || 'N/A'}</td>
                    <td class="p-5 text-muted font-medium">${pod.cpu_usage}</td>
                    <td class="p-5 text-muted font-medium">${pod.memory_usage}</td>
                    <td class="p-5"><span class="${pod.restarts > 0 ? 'text-warning-500' : 'text-muted'}">${pod.restarts}</span></td>
                    <td class="p-5 text-right flex justify-end gap-3">
                        <button class="view-yaml-btn p-2 rounded hover:bg-primary-600 hover:text-white transition-all text-muted" data-name="${pod.name}" data-ns="${pod.namespace}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </button>
                        <button class="delete-pod-btn p-2 rounded hover:bg-danger-500 hover:text-white transition-all text-muted" data-name="${pod.name}" data-ns="${pod.namespace}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </td>
                `;
                body.appendChild(row);
            });

            // Re-attach listeners
            body.querySelectorAll('.view-yaml-btn').forEach(btn => {
                btn.onclick = () => showYamlModal(btn.dataset.name, btn.dataset.ns);
            });
            body.querySelectorAll('.delete-pod-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (confirm(`INITIATE TERMINATION: ${btn.dataset.name}?`)) {
                        await apiFetch(`/pods/${btn.dataset.ns}/${btn.dataset.name}`, { method: 'DELETE' });
                        refreshData();
                    }
                };
            });

        } catch (e) {
            console.error("Refresh failed", e);
        } finally {
            setTimeout(() => { if (indicator) indicator.style.opacity = '0'; }, 1000);
        }
        return true;
    }

    // 3. Initial Load
    await refreshData(true);

    // 4. Setup Interval
    const interval = setInterval(async () => {
        const active = await refreshData();
        if (!active) clearInterval(interval);
    }, 5000);

    // 5. Filter Logic
    nsFilter.onchange = (e) => {
        updateState({ podFilters: { ...state.podFilters, namespace: e.target.value } }, true);
        refreshData();
    };
}

async function showYamlModal(name, ns) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 glass z-50 flex items-center justify-center p-8 md:p-24';
    overlay.innerHTML = `
        <div class="pane w-full max-w-5xl h-full flex flex-col" style="box-shadow:var(--shadow-400);">
            <div class="pane-header flex justify-between items-center h-14">
                <span>Spec: ${name}</span>
                <button id="close-modal" class="modal-close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="flex-grow overflow-auto p-0 terminal border-y border-neutral-200 shadow-inner rounded-none">
                <pre id="yaml-content" class="p-8 text-[11px] font-mono leading-relaxed" style="color:#a5f3fc;">DECODING MANIFEST...</pre>
            </div>
            <div class="p-6 flex justify-end bg-neutral-75">
                <button id="close-modal-btn" class="btn-primary h-11 px-10">Return to Registry</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-modal').onclick = close;
    overlay.querySelector('#close-modal-btn').onclick = close;

    try {
        const res = await apiFetch(`/pods/${ns}/${name}/yaml`);
        const data = await res.json();
        overlay.querySelector('#yaml-content').innerText = data.yaml;
    } catch (e) {
        overlay.querySelector('#yaml-content').innerText = "FATAL: SPECIFICATION DECODE FAILURE.";
    }
}
