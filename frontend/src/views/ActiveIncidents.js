import { state, updateState, notify } from '../utils/state';
import { resolveIncident, fetchIncidents } from '../utils/api';

export function renderActiveIncidentsView(container) {
    let active = state.incidents.filter(i => i.status !== 'resolved');
    
    const uniqueContexts = [...new Set(active.map(i => i.context || 'N/A'))].sort();
    
    if (state.activeIncidentsFilter !== 'all') {
        active = active.filter(i => (i.context || 'N/A') === state.activeIncidentsFilter);
    }
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 h-full min-h-0">
            <div class="md:col-span-8 pane flex flex-col min-h-0">
                <div class="pane-header flex justify-between items-center">
                    <span>Firing Alerts (${active.length})</span>
                    <select id="incident-context-filter" class="bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark rounded-md h-7 px-3 text-[10px] text-muted focus:ring-1 ring-primary-light">
                        <option value="all">All Contexts</option>
                        ${uniqueContexts.map(ctx => `<option value="${ctx}" ${state.activeIncidentsFilter === ctx ? 'selected' : ''}>${ctx}</option>`).join('')}
                    </select>
                </div>
                <div class="flex-grow overflow-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="sticky top-0 bg-surface-light dark:bg-surface-dark border-b border-surface-hover-light dark:border-surface-hover-dark text-[10px] uppercase text-muted font-bold">
                            <tr>
                                <th class="p-4">ID</th>
                                <th class="p-4">Severity</th>
                                <th class="p-4">Alert Name</th>
                                <th class="p-4">Context</th>
                                <th class="p-4">Time</th>
                                <th class="p-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody id="incidents-body">
                            ${active.length === 0 ? `<tr><td colspan="6" class="p-16 text-center text-primary-light dark:text-primary-dark font-mono uppercase text-xs tracking-widest">No active incidents. Cluster healthy.</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="md:col-span-4 flex flex-col gap-6" id="health-pane-container">
                <div class="pane flex-grow flex flex-col min-h-0">
                    <div class="pane-header">Infrastucture Health</div>
                    <div class="p-6 flex flex-col gap-6 overflow-y-auto">
                        ${state.environments.length === 0 ? `<div class="text-center p-10 text-muted-light italic text-xs">No environments connected.</div>` : ''}
                        ${state.environments.map(env => `
                            <div class="p-4 rounded-lg bg-surface-hover-light/20 dark:bg-surface-hover-dark/10 border border-surface-hover-light dark:border-surface-hover-dark">
                                <div class="text-[11px] uppercase font-bold text-primary-light dark:text-primary-dark mb-4 flex items-center justify-between">
                                    <span>${env.name}</span>
                                    <span class="flex items-center gap-1.5">
                                        <span class="w-2 h-2 rounded-full ${env.status === 'healthy' || env.status === 'online' ? 'bg-alert-green' : env.status === 'degraded' ? 'bg-alert-orange' : 'bg-alert-red'}"></span>
                                        <span class="text-muted text-[9px]">${env.status}</span>
                                    </span>
                                </div>
                                
                                <div class="space-y-4">
                                    <div>
                                        <div class="flex justify-between text-[9px] mb-1.5 uppercase text-muted font-bold">
                                            <span>CPU Usage</span>
                                            <span class="text-text-light dark:text-text-dark" id="incidents-cpu-text-${env.id}">${env.cpu_usage}%</span>
                                        </div>
                                        <div class="h-1.5 bg-surface-hover-light dark:bg-surface-hover-dark w-full rounded-full overflow-hidden">
                                            <div class="h-full bg-primary-light dark:bg-primary-dark transition-all duration-700" id="incidents-cpu-bar-${env.id}" style="width: ${env.cpu_usage}%"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[9px] mb-1.5 uppercase text-muted font-bold">
                                            <span>Memory</span>
                                            <span class="text-text-light dark:text-text-dark" id="incidents-mem-text-${env.id}">${env.memory_usage}%</span>
                                        </div>
                                        <div class="h-1.5 bg-surface-hover-light dark:bg-surface-hover-dark w-full rounded-full overflow-hidden">
                                            <div class="h-full bg-primary-light dark:bg-primary-dark transition-all duration-700" id="incidents-mem-bar-${env.id}" style="width: ${env.memory_usage}%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    const body = container.querySelector('#incidents-body');
    active.forEach(inc => {
        const row = document.createElement('tr');
        row.className = 'border-b border-surface-hover-light dark:border-surface-hover-dark hover:bg-surface-hover-light/40 dark:hover:bg-surface-hover-dark/20 cursor-pointer transition-colors text-[13px]';
        row.innerHTML = `
            <td class="p-4 font-mono text-[11px] text-muted">${inc.incident_id.slice(0, 8)}</td>
            <td class="p-4"><span class="badge badge-sev${inc.severity.toLowerCase() === 'critical' ? '1' : inc.severity.toLowerCase() === 'warning' ? '2' : '3'}">${inc.severity}</span></td>
            <td class="p-4 font-bold text-text-light dark:text-text-dark">${inc.alert_name}</td>
            <td class="p-4 font-medium text-muted">${inc.context || 'N/A'}</td>
            <td class="p-4 text-muted text-[11px]">${new Date(inc.start_time).toLocaleTimeString()}</td>
            <td class="p-4 text-center">
                <button class="resolve-btn px-3 py-1 bg-alert-green hover:bg-green-600 text-white text-[9px] font-bold uppercase rounded transition-colors" data-id="${inc.incident_id}">Resolve</button>
            </td>
        `;
        
        // Navigation logic for the row (excluding the resolve button)
        row.onclick = (e) => {
            if (!e.target.closest('.resolve-btn')) {
                updateState({ view: 'control', selectedIncidentId: inc.incident_id });
            }
        };
        
        body.appendChild(row);
    });

    // Resolve button logic
    container.querySelectorAll('.resolve-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            btn.disabled = true;
            btn.innerText = '...';
            
            try {
                const res = await resolveIncident(id);
                if (res.ok) {
                    notify('Incident marked as resolved', 'success');
                    await fetchIncidents();
                } else {
                    notify('Failed to resolve incident', 'error');
                }
            } catch (err) {
                console.error(err);
                notify('Network error during resolution', 'error');
            }
        };
    });

    const filter = container.querySelector('#incident-context-filter');
    if (filter) {
        filter.onchange = (e) => updateState({ activeIncidentsFilter: e.target.value });
    }

    // Subscribe to state updates for live health bars
    import('../utils/state.js').then(({ subscribe }) => {
        const unsub = subscribe((newState) => {
            if (newState.view !== 'active') {
                unsub(); // Cleanup subscription when navigating away
                return;
            }
            // Update CPU and Memory bars smoothly
            for (const env of newState.environments) {
                const cpuText = document.getElementById(`incidents-cpu-text-${env.id}`);
                const cpuBar = document.getElementById(`incidents-cpu-bar-${env.id}`);
                const memText = document.getElementById(`incidents-mem-text-${env.id}`);
                const memBar = document.getElementById(`incidents-mem-bar-${env.id}`);
                
                if (cpuText) cpuText.textContent = `${env.cpu_usage ?? 0}%`;
                if (cpuBar) cpuBar.style.width = `${env.cpu_usage ?? 0}%`;
                if (memText) memText.textContent = `${env.memory_usage ?? 0}%`;
                if (memBar) memBar.style.width = `${env.memory_usage ?? 0}%`;
            }
        });
    });
}
