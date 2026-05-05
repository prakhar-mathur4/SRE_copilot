/**
 * RESOLVED INCIDENTS ARCHIVE
 */
import { state, updateState } from '../utils/state';
import { API_BASE } from '../utils/api';
import { marked } from 'marked';

export function renderArchiveView(container) {
    let resolved = state.incidents.filter(i => i.status === 'resolved');

    if (state.archiveFilters.search) {
        const q = state.archiveFilters.search.toLowerCase();
        resolved = resolved.filter(i => 
            i.alert_name.toLowerCase().includes(q) || 
            i.incident_id.toLowerCase().includes(q)
        );
    }
    
    if (state.archiveFilters.severity !== 'all') {
        resolved = resolved.filter(i => i.severity.toLowerCase() === state.archiveFilters.severity.toLowerCase());
    }

    container.innerHTML = `
        <div class="flex flex-col gap-6 h-full min-h-0">
            <div class="pane flex flex-col min-h-0 shadow-xl border-surface-hover-light/50">
                <div class="pane-header">Resolved Incidents Ledger</div>
                <div class="p-6 border-b border-surface-hover-light dark:border-surface-hover-dark flex flex-wrap gap-4 bg-surface-hover-light/10">
                    <div class="relative flex-grow">
                        <input type="text" id="archive-search" placeholder="Search by name, ID, or context..." value="${state.archiveFilters.search}" class="w-full bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark rounded-lg h-10 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 ring-primary-light/50 transition-all">
                        <svg class="absolute left-3 top-2.5 text-muted-light" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <select id="archive-sev-filter" class="bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark rounded-lg h-10 px-4 text-sm focus:outline-none focus:ring-2 ring-primary-light/50">
                        <option value="all" ${state.archiveFilters.severity === 'all' ? 'selected' : ''}>All Severities</option>
                        <option value="critical" ${state.archiveFilters.severity === 'critical' ? 'selected' : ''}>Critical</option>
                        <option value="warning" ${state.archiveFilters.severity === 'warning' ? 'selected' : ''}>Warning</option>
                    </select>
                </div>
                <div class="flex-grow overflow-auto p-6 flex flex-col gap-4">
                    ${resolved.length === 0 ? '<div class="text-center p-20 text-muted-light italic">No historical records match the current filter criteria.</div>' : ''}
                    ${resolved.map(inc => `
                        <div class="pane hover:border-primary-light dark:hover:border-primary-dark transition-all cursor-pointer group hover:translate-x-1 duration-300 shadow-sm hover:shadow-md">
                            <div class="p-5 flex items-center justify-between">
                                <div class="flex items-center gap-6">
                                    <span class="badge badge-sev${inc.severity.toLowerCase() === 'critical' ? '1' : inc.severity.toLowerCase() === 'warning' ? '2' : '3'} scale-110">${inc.severity}</span>
                                    <div>
                                        <h3 class="font-bold text-base text-text-light dark:text-text-dark">${inc.alert_name}</h3>
                                        <div class="text-[10px] text-muted uppercase font-bold mt-1 tracking-wider">
                                            ${inc.incident_id.slice(0,12)} • ${inc.context || 'N/A'} • RESOLVED ${new Date(inc.last_updated).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <button class="btn-outline h-9 px-4 text-[10px] view-report-btn" data-id="${inc.incident_id}">Analyze Report</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Events
    const search = container.querySelector('#archive-search');
    search.oninput = (e) => {
        state.archiveFilters.search = e.target.value;
        renderArchiveView(container);
    };
    if (state.archiveFilters.search) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
    }

    container.querySelector('#archive-sev-filter').onchange = (e) => {
        updateState({ archiveFilters: { ...state.archiveFilters, severity: e.target.value } });
    };

    container.querySelectorAll('.view-report-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            showReportModal(btn.dataset.id);
        };
    });
}

async function showReportModal(incidentId) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 glass z-50 flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300';
    overlay.innerHTML = `
        <div class="pane w-full max-w-5xl h-full flex flex-col shadow-2xl scale-in-95 animate-in zoom-in duration-300 border-primary-light/20">
            <div class="pane-header flex justify-between items-center h-14">
                <span class="text-sm font-bold tracking-widest uppercase">Incident Post-Mortem Report</span>
                <button id="close-report-modal" class="p-2 rounded-full hover:bg-alert-red hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="flex-grow overflow-auto p-8 md:p-16 bg-surface-light dark:bg-surface-dark">
                <div id="report-content" class="prose dark:prose-invert prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-p:text-base prose-p:leading-relaxed">
                    <div class="animate-pulse flex flex-col gap-4">
                        <div class="h-8 bg-surface-hover-light dark:bg-surface-hover-dark w-1/3 rounded"></div>
                        <div class="h-4 bg-surface-hover-light dark:bg-surface-hover-dark w-full rounded"></div>
                        <div class="h-4 bg-surface-hover-light dark:bg-surface-hover-dark w-5/6 rounded"></div>
                        <div class="h-64 bg-surface-hover-light dark:bg-surface-hover-dark w-full rounded mt-8"></div>
                    </div>
                </div>
            </div>
            <div class="p-6 border-t border-surface-hover-light dark:border-surface-hover-dark flex justify-end bg-surface-hover-light/5">
                <button id="close-report-btn" class="btn-primary h-12 px-8">Close Ledger</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 200);
    };
    overlay.querySelector('#close-report-modal').onclick = close;
    overlay.querySelector('#close-report-btn').onclick = close;
    
    try {
        const res = await fetch(`${API_BASE}/incidents/${incidentId}`);
        const data = await res.json();
        overlay.querySelector('#report-content').innerHTML = data.report 
            ? marked.parse(data.report) 
            : `<div class="p-20 text-center border-2 border-dashed border-surface-hover-light rounded-2xl">
                <h3 class="text-xl font-bold mb-3">No Post-Mortem Artifacts</h3>
                <p class="text-muted-light">Detailed reports are only indexed for resolved High-Severity incidents.</p>
               </div>`;
    } catch (e) {
        overlay.querySelector('#report-content').innerText = "FATAL: FAILED TO RETRIEVE ARCHIVE DATA.";
    }
}
