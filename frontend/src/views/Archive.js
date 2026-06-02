/**
 * RESOLVED INCIDENTS ARCHIVE
 */
import { state, updateState } from '../utils/state';
import { API_BASE, deleteIncident } from '../utils/api';
import { marked } from 'marked';

// Severities that generate a post-mortem report on the backend
const REPORT_SEVERITIES = new Set(['critical', 'page', 'warning', 'high']);

const PAGE_SIZE = 20;

// Report cache: incident_id → { report: string|null }
// Avoids re-fetching on every modal open. Cleared on delete.
const reportCache = new Map();

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

function renderContext(raw) {
    if (!raw || raw === 'unknown') return '<span class="opacity-40 italic">unknown</span>';
    const idx = raw.indexOf(':');
    if (idx === -1) return `<span>${escapeHtml(raw)}</span>`;
    const key = raw.slice(0, idx);
    const val = raw.slice(idx + 1);
    return `<span class="opacity-40 text-[11px] uppercase">${escapeHtml(key)}:</span><span class="ml-1">${escapeHtml(val)}</span>`;
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
    const totalFiltered = resolved.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    const page = Math.min(filters.page || 0, totalPages - 1);
    const paginated = resolved.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const countLabel = isFiltered
        ? `<span class="text-primary-600 font-bold">${totalFiltered}</span> <span class="opacity-40 font-normal text-[11px]">of ${allResolved.length}</span>`
        : `<span class="text-primary-600 font-bold">${allResolved.length}</span>`;

    const selectClass = 'bg-neutral-75 border border-neutral-200 rounded px-3 text-xs text-text-light focus:outline-none focus:border-primary-300';

    container.innerHTML = `
        <div class="flex flex-col gap-4 h-full min-h-0">

            <!-- Header -->
            <div class="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 class="text-lg font-bold">Resolved Incidents</h2>
                    <p class="text-[11px] text-muted">
                        ${isFiltered
                            ? `${totalFiltered} of ${allResolved.length} incident${allResolved.length !== 1 ? 's' : ''}`
                            : `${allResolved.length} incident${allResolved.length !== 1 ? 's' : ''} resolved`}
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    <div class="relative">
                        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40"
                            xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" id="archive-search" placeholder="Search by name, ID, or context..."
                            value="${escapeHtml(filters.search)}"
                            class="bg-neutral-75 border border-neutral-200 rounded text-xs text-text-light focus:outline-none focus:border-primary-300"
                            style="height:30px; width:260px; padding-left:32px; padding-right:10px;" />
                    </div>
                    <select id="archive-sev-filter" class="${selectClass}" style="height:30px;">
                        <option value="all"      ${filters.severity === 'all'      ? 'selected' : ''}>All Severities</option>
                        <option value="critical" ${filters.severity === 'critical' ? 'selected' : ''}>Critical</option>
                        <option value="page"     ${filters.severity === 'page'     ? 'selected' : ''}>Page</option>
                        <option value="warning"  ${filters.severity === 'warning'  ? 'selected' : ''}>Warning</option>
                        <option value="info"     ${filters.severity === 'info'     ? 'selected' : ''}>Info</option>
                        <option value="none"     ${filters.severity === 'none'     ? 'selected' : ''}>None</option>
                    </select>
                    <select id="archive-sort" class="${selectClass}" style="height:30px;">
                        ${SORT_OPTIONS.map(o => `<option value="${o.value}" ${filters.sortBy === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                    ${isFiltered ? `<button id="archive-clear-filters" class="text-[11px] font-bold text-primary-600 hover:opacity-70 transition-opacity whitespace-nowrap">Clear ✕</button>` : ''}
                </div>
            </div>

            <!-- Cards -->
            <div class="pane flex-grow flex flex-col min-h-0 overflow-hidden">
                <div class="flex-grow overflow-auto p-4 flex flex-col gap-3">
                    ${totalFiltered === 0 ? `
                        <div class="empty-state flex flex-col items-center gap-3 mt-12">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-25"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="11"/><line x1="11" y1="14" x2="11.01" y2="14"/></svg>
                            <p>${isFiltered ? 'No resolved incidents match your filters' : 'No resolved incidents yet'}</p>
                        </div>` : ''}
                    ${paginated.map(inc => {
                        const sev = inc.severity.toLowerCase();
                        const sevBadge = (sev === 'critical' || sev === 'page') ? '1' : sev === 'warning' ? '2' : '3';
                        const resolvedAt = new Date(inc.last_updated);
                        const fireTime   = inc.alert_starts_at && !inc.alert_starts_at.startsWith('0001')
                            ? inc.alert_starts_at : inc.start_time;
                        const startedAt  = new Date(fireTime);
                        const durationMs = Math.max(0, resolvedAt - startedAt);
                        const durationStr = durationMs >= 60000
                            ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
                            : durationMs >= 1000 ? `${Math.floor(durationMs / 1000)}s` : '< 1s';
                        const hasReport = REPORT_SEVERITIES.has(sev);
                        return `
                        <div class="archive-card border border-neutral-200 rounded bg-neutral-75 hover:border-primary-600 cursor-pointer group transition-all duration-200 hover:translate-x-1" data-id="${inc.incident_id}">
                            <div class="p-4 flex items-center justify-between gap-4">
                                <div class="flex items-center gap-4 min-w-0">
                                    <span class="badge badge-sev${sevBadge} shrink-0">${escapeHtml(inc.severity)}</span>
                                    <div class="min-w-0">
                                        <h3 class="font-bold text-sm text-text-light truncate">${escapeHtml(inc.alert_name)}</h3>
                                        <div class="text-xs text-text-light opacity-50 uppercase font-bold mt-1 tracking-wider flex items-center gap-2 flex-wrap">
                                            <span class="font-mono">${inc.incident_id.slice(0, 12)}</span>
                                            <span>•</span>
                                            <span>${renderContext(inc.context)}</span>
                                            <span>•</span>
                                            <span>${formatDate(inc.last_updated)}</span>
                                            <span>•</span>
                                            <span class="text-primary-600 opacity-100">⏱ ${durationStr}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    ${hasReport
                                        ? `<span class="text-[11px] font-bold px-2 py-0.5 bg-success-50 text-success-500 border border-success-75 rounded hidden sm:inline">Report</span>`
                                        : `<span class="text-[11px] font-bold px-2 py-0.5 bg-neutral-100 text-muted border border-neutral-200 rounded hidden sm:inline opacity-60">No Report</span>`}
                                    <span class="btn-outline h-8 px-3 text-xs flex items-center whitespace-nowrap group-hover:border-primary-600 transition-colors view-report-btn" data-id="${inc.incident_id}">View →</span>
                                    <button class="delete-incident-btn h-8 w-8 flex items-center justify-center rounded border border-neutral-200 hover:border-danger-500 hover:bg-danger-50 hover:text-danger-500 text-text-light opacity-40 hover:opacity-100 transition-all" data-id="${inc.incident_id}" title="Delete incident">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                ${totalPages > 1 ? `
                <div class="flex items-center justify-between px-4 py-3 border-t border-neutral-200 flex-shrink-0">
                    <button id="archive-prev" class="btn-outline h-8 px-4 text-xs ${page === 0 ? 'opacity-30 pointer-events-none' : ''}">← Prev</button>
                    <span class="text-xs text-muted">Page <span class="text-text-light font-bold">${page + 1}</span> of ${totalPages}</span>
                    <button id="archive-next" class="btn-outline h-8 px-4 text-xs ${page >= totalPages - 1 ? 'opacity-30 pointer-events-none' : ''}">Next →</button>
                </div>` : ''}
            </div>
        </div>
    `;

    // Search — reset page on new query
    const search = container.querySelector('#archive-search');
    search.oninput = (e) => {
        updateState({ archiveFilters: { ...state.archiveFilters, search: e.target.value, page: 0 } }, true);
        renderArchiveView(container);
    };
    if (filters.search) {
        search.focus();
        search.setSelectionRange(search.value.length, search.value.length);
    }

    // Severity filter — reset page
    container.querySelector('#archive-sev-filter').onchange = (e) => {
        updateState({ archiveFilters: { ...state.archiveFilters, severity: e.target.value, page: 0 } }, true);
        renderArchiveView(container);
    };

    // Sort — reset page
    container.querySelector('#archive-sort').onchange = (e) => {
        updateState({ archiveFilters: { ...state.archiveFilters, sortBy: e.target.value, page: 0 } }, true);
        renderArchiveView(container);
    };

    // Clear all filters — reset page
    container.querySelector('#archive-clear-filters')?.addEventListener('click', () => {
        updateState({ archiveFilters: { search: '', severity: 'all', sortBy: filters.sortBy, page: 0 } }, true);
        renderArchiveView(container);
    });

    // Pagination
    container.querySelector('#archive-prev')?.addEventListener('click', () => {
        updateState({ archiveFilters: { ...state.archiveFilters, page: Math.max(0, page - 1) } }, true);
        renderArchiveView(container);
    });
    container.querySelector('#archive-next')?.addEventListener('click', () => {
        updateState({ archiveFilters: { ...state.archiveFilters, page: Math.min(totalPages - 1, page + 1) } }, true);
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
                reportCache.delete(btn.dataset.id);
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
        <div class="pane w-full max-w-5xl h-full flex flex-col" style="box-shadow:var(--shadow-400);">
            <div class="pane-header flex justify-between items-center gap-4">
                <div class="flex items-center gap-3 min-w-0">
                    ${inc ? `<span class="badge badge-sev${sevBadge} shrink-0">${escapeHtml(inc.severity)}</span>` : ''}
                    <span class="truncate">${inc ? escapeHtml(inc.alert_name) : 'Post-Mortem Report'}</span>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    ${inc ? `<span class="text-[11px] font-mono opacity-40 hidden md:inline">${formatDate(inc.last_updated)} · ⏱ ${durationStr}</span>` : ''}
                    <button id="open-control-room-btn" class="text-[11px] font-bold uppercase tracking-widest text-primary-600 hover:opacity-70 transition-opacity hidden md:inline">Control Room →</button>
                    <button id="close-report-modal" class="modal-close-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            <div class="flex-grow overflow-auto p-8 md:p-16 bg-neutral-0">
                <div id="report-content" class="prose prose-slate max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-p:text-base prose-p:leading-relaxed">
                    <div class="animate-pulse flex flex-col gap-4">
                        <div class="h-8 bg-neutral-200 w-1/3 rounded"></div>
                        <div class="h-4 bg-neutral-200 w-full rounded"></div>
                        <div class="h-4 bg-neutral-200 w-5/6 rounded"></div>
                        <div class="h-64 bg-neutral-200 w-full rounded mt-8"></div>
                    </div>
                </div>
            </div>
            <div class="p-4 border-t border-neutral-200 flex justify-between items-center">
                <button id="open-control-room-btn-footer" class="btn-outline h-10 px-5 text-xs md:hidden">Control Room →</button>
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

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#close-report-modal').onclick = close;
    overlay.querySelector('#close-report-btn').onclick = close;

    const openCR = () => {
        close();
        updateState({ view: 'control', selectedIncidentId: incidentId });
    };
    overlay.querySelector('#open-control-room-btn')?.addEventListener('click', openCR);
    overlay.querySelector('#open-control-room-btn-footer')?.addEventListener('click', openCR);

    const renderReport = (report) => {
        overlay.querySelector('#report-content').innerHTML = report
            ? marked.parse(report)
            : `<div class="p-16 text-center border-2 border-dashed border-neutral-200 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 opacity-20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <h3 class="text-lg font-bold mb-2">No Post-Mortem Report</h3>
                <p class="opacity-60 text-sm">Reports are generated only for resolved Critical, Page, and Warning incidents.</p>
               </div>`;
    };

    if (reportCache.has(incidentId)) {
        renderReport(reportCache.get(incidentId));
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/incidents/${incidentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        reportCache.set(incidentId, data.report ?? null);
        renderReport(data.report);
    } catch (e) {
        overlay.querySelector('#report-content').innerHTML = `
            <div class="p-16 text-center border-2 border-dashed border-neutral-200 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 opacity-20 text-danger-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h3 class="text-lg font-bold mb-2">Unable to Load Report</h3>
                <p class="opacity-60 text-sm">Could not reach the backend. Check your connection and try again.</p>
            </div>`;
    }
}
