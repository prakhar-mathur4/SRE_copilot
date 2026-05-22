/**
 * RESOLVED INCIDENTS ARCHIVE
 */
import { state, updateState } from '../utils/state';
import { API_BASE, deleteIncident } from '../utils/api';
import { marked } from 'marked';

// Severities that generate a post-mortem report on the backend
const REPORT_SEVERITIES = new Set(['critical', 'page', 'warning', 'high']);

const SORT_OPTIONS = [
    { value: 'date_desc', label: 'Newest First' },
    { value: 'date_asc',  label: 'Oldest First' },
    { value: 'sev_desc',  label: 'Severity ↓' },
    { value: 'dur_desc',  label: 'Duration ↓' },
];

const SEV_RANK = { critical: 0, page: 1, warning: 2, info: 3, none: 4 };

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString('en-CA'); // YYYY-MM-DD everywhere
}

// Renders "key: value" context string with dim key label.
// Mirrors the same helper in ActiveIncidents.js.
function renderContext(raw) {
    if (!raw || raw === 'unknown') return '<span class="opacity-40 italic">unknown</span>';
    const idx = raw.indexOf(':');
    if (idx === -1) return `<span>${escapeHtml(raw)}</span>`;
    const key = raw.slice(0, idx);
    const val = raw.slice(idx + 1);
    return `<span class="opacity-40 text-[9px] uppercase">${escapeHtml(key)}:</span><span class="ml-1">${escapeHtml(val)}</span>`;
}

function sortIncidents(incidents, sortBy) {
    return [...incidents].sort((a, b) => {
        switch (sortBy) {
            case 'date_asc':
                return new Date(a.last_updated) - new Date(b.last_updated);
            case 'sev_desc': {
                const rankA = SEV_RANK[a.severity.toLowerCase()] ?? 5;
                const rankB = SEV_RANK[b.severity.toLowerCase()] ?? 5;
                if (rankA !== rankB) return rankA - rankB;
                // secondary: newest first
                return new Date(b.last_updated) - new Date(a.last_updated);
            }
            case 'dur_desc': {
                const durA = new Date(a.last_updated) - new Date(a.start_time);
                const durB = new Date(b.last_updated) - new Date(b.start_time);
                return durB - durA;
            }
            case 'date_desc':
            default:
                return new Date(b.last_updated) - new Date(a.last_updated);
        }
    });
}

export function renderArchiveView(container) {
    const filters = state.archiveFilters;
    const allResolved = state.incidents.filter(i => i.status === 'resolved');
    let resolved = allResolved;

    if (filters.search) {
        const q = filters.search.toLowerCase();
        resolved = resolved.filter(i =>
            i.alert_name.toLowerCase().includes(q) ||
            i.incident_id.toLowerCase().includes(q) ||
            (i.context || '').toLowerCase().includes(q)
        );
    }

    if (filters.severity !== 'all') {
        resolved = resolved.filter(i => i.severity.toLowerCase() === filters.severity.toLowerCase());
    }

    resolved = sortIncidents(resolved, filters.sortBy);

    const isFiltered = filters.search || filters.severity !== 'all';
    const countLabel = isFiltered
        ? `<span class="text-primary-light dark:text-primary-dark font-black">${resolved.length}</span> <span class="opacity-40 font-normal text-[9px]">of ${allResolved.length}</span>`
        : `<span class="text-primary-light dark:text-primary-dark font-black">${resolved.length}</span>`;

    const selectClass = 'bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark rounded-lg h-10 px-4 text-sm focus:outline-none focus:ring-2 ring-primary-light/50 text-text-light dark:text-text-dark';

    container.innerHTML = `
        <div class="flex flex-col gap-6 h-full min-h-0">
            <div class="pane flex flex-col flex-grow min-h-0 shadow-xl">
                <div class="pane-header flex items-center justify-between">
                    <span>Resolved Incidents ${countLabel}</span>
                    ${isFiltered ? `<button id="archive-clear-filters" class="text-[9px] font-bold uppercase tracking-widest text-primary-light dark:text-primary-dark hover:opacity-70 transition-opacity">Clear Filters ✕</button>` : ''}
                </div>
                <div class="p-4 border-b border-surface-hover-light dark:border-surface-hover-dark flex flex-wrap gap-3">
                    <div class="relative flex-grow min-w-[180px]">
                        <input type="text" id="archive-search" placeholder="Search by name, ID, or context..."
                            value="${escapeHtml(filters.search)}"
                            class="w-full bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark rounded-lg h-10 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 ring-primary-light/50 transition-all text-text-light dark:text-text-dark">
                        <svg class="absolute left-3 top-2.5 opacity-40" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <select id="archive-sev-filter" class="${selectClass}">
                        <option value="all"      ${filters.severity === 'all'      ? 'selected' : ''}>All Severities</option>
                        <option value="critical" ${filters.severity === 'critical' ? 'selected' : ''}>Critical</option>
                        <option value="page"     ${filters.severity === 'page'     ? 'selected' : ''}>Page</option>
                        <option value="warning"  ${filters.severity === 'warning'  ? 'selected' : ''}>Warning</option>
                        <option value="info"     ${filters.severity === 'info'     ? 'selected' : ''}>Info</option>
                        <option value="none"     ${filters.severity === 'none'     ? 'selected' : ''}>None</option>
                    </select>
                    <select id="archive-sort" class="${selectClass}">
                        ${SORT_OPTIONS.map(o => `<option value="${o.value}" ${filters.sortBy === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="flex-grow overflow-auto p-4 flex flex-col gap-3">
                    ${resolved.length === 0 ? `
                        <div class="empty-state flex flex-col items-center gap-3 mt-12">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-25"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="11"/><line x1="11" y1="14" x2="11.01" y2="14"/></svg>
                            <p>${isFiltered ? 'No resolved incidents match your filters' : 'No resolved incidents yet'}</p>
                        </div>` : ''}
                    ${resolved.map(inc => {
                        const sev = inc.severity.toLowerCase();
                        const sevBadge = (sev === 'critical' || sev === 'page') ? '1' : sev === 'warning' ? '2' : '3';
                        const resolvedAt = new Date(inc.last_updated);
                        const startedAt  = new Date(inc.start_time);
                        const durationMs = Math.max(0, resolvedAt - startedAt);
                        const durationStr = durationMs >= 60000
                            ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
                            : durationMs >= 1000 ? `${Math.floor(durationMs / 1000)}s` : '< 1s';
                        const hasReport = REPORT_SEVERITIES.has(sev);
                        return `
                        <div class="archive-card border border-surface-hover-light dark:border-surface-hover-dark rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark hover:border-primary-light dark:hover:border-primary-dark cursor-pointer group transition-all duration-200 hover:translate-x-1 hover:shadow-md" data-id="${inc.incident_id}">
                            <div class="p-4 flex items-center justify-between gap-4">
                                <div class="flex items-center gap-4 min-w-0">
                                    <span class="badge badge-sev${sevBadge} shrink-0">${escapeHtml(inc.severity)}</span>
                                    <div class="min-w-0">
                                        <h3 class="font-bold text-sm text-text-light dark:text-text-dark truncate">${escapeHtml(inc.alert_name)}</h3>
                                        <div class="text-[10px] text-text-light dark:text-text-dark opacity-50 uppercase font-bold mt-1 tracking-wider flex items-center gap-2 flex-wrap">
                                            <span class="font-mono">${inc.incident_id.slice(0, 12)}</span>
                                            <span>•</span>
                                            <span>${renderContext(inc.context)}</span>
                                            <span>•</span>
                                            <span>${formatDate(inc.last_updated)}</span>
                                            <span>•</span>
                                            <span class="text-primary-light dark:text-primary-dark opacity-100">⏱ ${durationStr}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    ${hasReport
                                        ? `<span class="text-[9px] font-bold px-2 py-0.5 bg-alert-green/10 text-alert-green border border-alert-green/20 rounded-full hidden sm:inline">Report</span>`
                                        : `<span class="text-[9px] font-bold px-2 py-0.5 bg-surface-hover-light dark:bg-surface-dark text-text-light dark:text-text-dark opacity-30 border border-surface-hover-light dark:border-surface-hover-dark rounded-full hidden sm:inline">No Report</span>`}
                                    <span class="btn-outline h-8 px-3 text-[10px] flex items-center whitespace-nowrap group-hover:border-primary-light dark:group-hover:border-primary-dark transition-colors view-report-btn" data-id="${inc.incident_id}">View →</span>
                                    <button class="delete-incident-btn h-8 w-8 flex items-center justify-center rounded-lg border border-surface-hover-light dark:border-surface-hover-dark hover:border-alert-red hover:bg-alert-red/10 hover:text-alert-red text-text-light dark:text-text-dark opacity-40 hover:opacity-100 transition-all" data-id="${inc.incident_id}" title="Delete incident">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Search
    const search = container.querySelector('#archive-search');
    search.oninput = (e) => {
        updateState({ archiveFilters: { ...state.archiveFilters, search: e.target.value } }, true);
        renderArchiveView(container);
    };
    if (filters.search) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
    }

    // Severity filter
    container.querySelector('#archive-sev-filter').onchange = (e) => {
        updateState({ archiveFilters: { ...state.archiveFilters, severity: e.target.value } }, true);
        renderArchiveView(container);
    };

    // Sort
    container.querySelector('#archive-sort').onchange = (e) => {
        updateState({ archiveFilters: { ...state.archiveFilters, sortBy: e.target.value } }, true);
        renderArchiveView(container);
    };

    // Clear all filters
    container.querySelector('#archive-clear-filters')?.addEventListener('click', () => {
        updateState({ archiveFilters: { search: '', severity: 'all', sortBy: filters.sortBy } }, true);
        renderArchiveView(container);
    });

    // Whole-card click → report modal (but not when delete button is clicked)
    container.querySelectorAll('.archive-card').forEach(card => {
        card.onclick = (e) => {
            if (!e.target.closest('.delete-incident-btn')) {
                showReportModal(card.dataset.id);
            }
        };
    });

    // View button → report modal
    container.querySelectorAll('.view-report-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            showReportModal(btn.dataset.id);
        };
    });

    // Delete button → confirm + delete
    container.querySelectorAll('.delete-incident-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const name = state.incidents.find(i => i.incident_id === btn.dataset.id)?.alert_name || btn.dataset.id;
            if (!confirm(`Delete "${name}"?\n\nThis removes the incident from memory and cannot be undone.`)) return;

            btn.disabled = true;
            btn.innerHTML = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

            try {
                const res = await deleteIncident(btn.dataset.id);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const updated = state.incidents.filter(i => i.incident_id !== btn.dataset.id);
                updateState({ incidents: updated, incidentVersion: state.incidentVersion + 1 }, true);
                renderArchiveView(container);
            } catch (err) {
                btn.disabled = false;
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
                alert(`Failed to delete: ${err.message}`);
            }
        };
    });
}

async function showReportModal(incidentId) {
    // Look up the incident from local state for instant metadata display
    const inc = state.incidents.find(i => i.incident_id === incidentId);
    const sev = inc?.severity?.toLowerCase() || '';
    const sevBadge = (sev === 'critical' || sev === 'page') ? '1' : sev === 'warning' ? '2' : '3';
    const durationMs = inc ? Math.max(0, new Date(inc.last_updated) - new Date(inc.start_time)) : 0;
    const durationStr = durationMs >= 60000
        ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
        : durationMs >= 1000 ? `${Math.floor(durationMs / 1000)}s` : '< 1s';

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 glass z-50 flex items-center justify-center p-4 md:p-12';
    overlay.innerHTML = `
        <div class="pane w-full max-w-5xl h-full flex flex-col shadow-2xl border-primary-light/20">
            <div class="pane-header flex justify-between items-center gap-4">
                <div class="flex items-center gap-3 min-w-0">
                    ${inc ? `<span class="badge badge-sev${sevBadge} shrink-0">${escapeHtml(inc.severity)}</span>` : ''}
                    <span class="truncate">${inc ? escapeHtml(inc.alert_name) : 'Post-Mortem Report'}</span>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    ${inc ? `<span class="text-[9px] font-mono opacity-40 hidden md:inline">${formatDate(inc.last_updated)} · ⏱ ${durationStr}</span>` : ''}
                    <button id="open-control-room-btn" class="text-[9px] font-bold uppercase tracking-widest text-primary-light dark:text-primary-dark hover:opacity-70 transition-opacity hidden md:inline">Control Room →</button>
                    <button id="close-report-modal" class="modal-close-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
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
            <div class="p-4 border-t border-surface-hover-light dark:border-surface-hover-dark flex justify-between items-center bg-surface-hover-light/5">
                <button id="open-control-room-btn-footer" class="btn-outline h-10 px-5 text-[10px] md:hidden">Control Room →</button>
                <div class="flex-grow"></div>
                <button id="close-report-btn" class="btn-primary h-10 px-8">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onEscape);
    };
    const onEscape = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEscape);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#close-report-modal').onclick = close;
    overlay.querySelector('#close-report-btn').onclick = close;

    // Open in Control Room (header + footer buttons)
    const openCR = () => {
        close();
        updateState({ view: 'control', selectedIncidentId: incidentId });
    };
    overlay.querySelector('#open-control-room-btn')?.addEventListener('click', openCR);
    overlay.querySelector('#open-control-room-btn-footer')?.addEventListener('click', openCR);

    try {
        const res = await fetch(`${API_BASE}/incidents/${incidentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        overlay.querySelector('#report-content').innerHTML = data.report
            ? marked.parse(data.report)
            : `<div class="p-16 text-center border-2 border-dashed border-surface-hover-light dark:border-surface-hover-dark rounded-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 opacity-20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <h3 class="text-lg font-bold mb-2">No Post-Mortem Report</h3>
                <p class="opacity-60 text-sm">Reports are generated only for resolved Critical, Page, and Warning incidents.</p>
               </div>`;
    } catch (e) {
        overlay.querySelector('#report-content').innerHTML = `
            <div class="p-16 text-center border-2 border-dashed border-surface-hover-light dark:border-surface-hover-dark rounded-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 opacity-20 text-alert-red"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h3 class="text-lg font-bold mb-2">Unable to Load Report</h3>
                <p class="opacity-60 text-sm">Could not reach the backend. Check your connection and try again.</p>
            </div>`;
    }
}
