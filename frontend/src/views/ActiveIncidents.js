import { state, updateState } from '../utils/state';

// Module-level sort state — survives re-renders within the same session
let sortCol = 'time';   // 'name' | 'time' | 'severity'
let sortDir = 'desc';   // 'asc'  | 'desc'

const SEV_WEIGHT = { critical: 4, page: 4, warning: 3, info: 2 };

function relativeTime(isoString) {
    if (!isoString) return '—';
    const norm = isoString.endsWith('Z') ? isoString : isoString + 'Z';
    const date = new Date(norm);
    if (isNaN(date.getTime())) return '—';
    const diffMs  = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60)  return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)  return `${diffMin}m ago`;
    const diffHr  = Math.floor(diffMin / 60);
    if (diffHr < 24)   return `${diffHr}h ${diffMin % 60}m ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ${diffHr % 24}h ago`;
}

// Returns the best available fire timestamp for an incident.
// Prefers alert_starts_at (original Alertmanager time) but falls back to
// start_time (pipeline arrival time) when startsAt is missing or is the
// Alertmanager zero-value ("0001-01-01...").
function resolveFireTime(inc) {
    const raw = inc.alert_starts_at;
    if (raw && !raw.startsWith('0001')) return raw;
    return inc.start_time;
}

function renderContext(raw) {
    if (!raw || raw === 'unknown') return '<span class="text-muted/50 italic">unknown</span>';
    const idx = raw.indexOf(':');
    if (idx === -1) return `<span>${raw}</span>`;
    const key = raw.slice(0, idx);
    const val = raw.slice(idx + 1);
    return `<span class="text-[9px] font-mono text-muted/60 uppercase">${key}:</span><span class="ml-1">${val}</span>`;
}

function severityColor(sev) {
    switch ((sev || '').toLowerCase()) {
        case 'critical': case 'page': return 'bg-red-500/10 text-red-400 border-red-500/30';
        case 'warning':  return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
        default:         return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
}

function openQuickView(inc) {
    // Remove any existing modal first
    document.getElementById('quickview-modal')?.remove();

    const labels      = inc.labels      || {};
    const annotations = inc.annotations || {};

    const renderKV = (obj) => {
        const entries = Object.entries(obj);
        if (entries.length === 0) return '<span class="text-muted/50 italic text-xs">none</span>';
        return entries.map(([k, v]) => `
            <div class="flex gap-3 py-1.5 border-b border-surface-hover-light/50 dark:border-surface-hover-dark/50 last:border-0 min-w-0">
                <span class="text-[10px] font-mono font-bold text-primary-light dark:text-primary-dark shrink-0 w-36 truncate" title="${k}">${k}</span>
                <span class="text-[11px] text-text-light dark:text-text-dark break-all">${v}</span>
            </div>`).join('');
    };

    const pipelineSteps = [
        { label: 'Diagnostics', done: inc.diagnostics_collected },
        { label: 'RCA',         done: inc.rca_completed },
        { label: 'Runbook',     done: inc.runbook_executed },
    ];

    const modal = document.createElement('div');
    modal.id = 'quickview-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';
    modal.innerHTML = `
        <div class="pane w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">

            <!-- Header -->
            <div class="flex items-start justify-between gap-4 p-6 border-b border-surface-hover-light dark:border-surface-hover-dark shrink-0">
                <div class="flex flex-col gap-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-widest ${severityColor(inc.severity)}">${inc.severity}</span>
                        <span class="text-[9px] font-mono text-muted">${inc.incident_id.slice(0, 16)}…</span>
                    </div>
                    <h2 class="text-lg font-bold text-text-light dark:text-text-dark truncate">${inc.alert_name}</h2>
                    <div class="flex gap-4 text-[10px] text-muted mt-0.5 flex-wrap">
                        <span>Started: <span class="text-text-light dark:text-text-dark">${relativeTime(resolveFireTime(inc))}</span></span>
                        <span>Updated: <span class="text-text-light dark:text-text-dark">${relativeTime(inc.last_updated)}</span></span>
                        <span>Events: <span class="text-text-light dark:text-text-dark">${inc.event_count}</span></span>
                        ${inc.dedup_count > 0
                            ? `<span class="flex items-center gap-1">Storm Protection: <span class="ml-1 px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full text-[9px] font-bold">${inc.dedup_count} suppressed</span></span>`
                            : ''}
                    </div>
                </div>
                <button id="qv-close" class="shrink-0 modal-close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <!-- Pipeline status strip -->
            <div class="flex gap-0 shrink-0 border-b border-surface-hover-light dark:border-surface-hover-dark">
                ${pipelineSteps.map(s => `
                    <div class="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-bold uppercase tracking-widest ${s.done ? 'text-alert-green' : 'text-muted/50'}">
                        <span class="w-1.5 h-1.5 rounded-full ${s.done ? 'bg-alert-green' : 'bg-muted/30'}"></span>
                        ${s.label}
                    </div>`).join('<div class="w-px bg-surface-hover-light dark:bg-surface-hover-dark"></div>')}
            </div>

            <!-- Scrollable body -->
            <div class="flex-grow overflow-y-auto p-6 flex flex-col gap-6">

                <!-- Labels -->
                <div>
                    <div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-3">Labels (${Object.keys(labels).length})</div>
                    <div class="bg-surface-hover-light/30 dark:bg-surface-hover-dark/30 rounded-lg p-4">
                        ${renderKV(labels)}
                    </div>
                </div>

                <!-- Annotations -->
                <div>
                    <div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-3">Annotations (${Object.keys(annotations).length})</div>
                    <div class="bg-surface-hover-light/30 dark:bg-surface-hover-dark/30 rounded-lg p-4">
                        ${renderKV(annotations)}
                    </div>
                </div>

            </div>

            <!-- Footer -->
            <div class="shrink-0 px-6 py-4 border-t border-surface-hover-light dark:border-surface-hover-dark flex justify-between items-center">
                <span class="text-[10px] text-muted">Click the row to open the full Control Room view</span>
                <button id="qv-open-cr" class="px-4 py-2 bg-primary-light dark:bg-primary-dark text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 transition-opacity">Open Control Room →</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('#qv-close').onclick = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onEsc); }
    });

    // Open Control Room
    modal.querySelector('#qv-open-cr').onclick = () => {
        modal.remove();
        updateState({ view: 'control', selectedIncidentId: inc.incident_id });
    };
}

function sortIcon(col) {
    if (sortCol !== col) return '<svg class="inline ml-1 opacity-20" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7-7 7 7"/></svg>';
    return sortDir === 'asc'
        ? '<svg class="inline ml-1" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
        : '<svg class="inline ml-1" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
}

export function renderActiveIncidentsView(container) {
    let active = state.incidents.filter(i => i.status !== 'resolved');

    const uniqueContexts = [...new Set(active.map(i => i.namespace || 'unknown'))].sort();

    if (state.activeIncidentsFilter !== 'all') {
        active = active.filter(i => (i.namespace || 'unknown') === state.activeIncidentsFilter);
    }

    // Apply sort
    active = [...active].sort((a, b) => {
        let cmp = 0;
        if (sortCol === 'name') {
            cmp = a.alert_name.localeCompare(b.alert_name);
        } else if (sortCol === 'severity') {
            const wa = SEV_WEIGHT[(a.severity || '').toLowerCase()] ?? 1;
            const wb = SEV_WEIGHT[(b.severity || '').toLowerCase()] ?? 1;
            cmp = wa - wb;
        } else {
            const ta = new Date(resolveFireTime(a)).getTime();
            const tb = new Date(resolveFireTime(b)).getTime();
            cmp = ta - tb;
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    container.innerHTML = `
        <div class="h-full min-h-0 pane flex flex-col">
            <div class="pane-header flex items-center justify-between">
                <span>Firing Alerts <span class="text-text-light dark:text-text-dark font-black">${active.length}</span></span>
                <span class="flex items-center gap-1.5 ${active.length > 0 ? 'text-alert-red' : 'text-alert-green'} text-[9px] font-black">
                    <span class="w-1.5 h-1.5 rounded-full ${active.length > 0 ? 'bg-alert-red animate-pulse' : 'bg-alert-green'}"></span>
                    ${active.length > 0 ? 'LIVE' : 'HEALTHY'}
                </span>
            </div>
            <div class="flex-grow overflow-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="table-header">
                        <tr>
                            <th class="p-4">ID</th>
                            <th class="p-4 cursor-pointer select-none hover:text-text-light dark:hover:text-text-dark transition-colors" id="sort-sev">Severity${sortIcon('severity')}</th>
                            <th class="p-4 cursor-pointer select-none hover:text-text-light dark:hover:text-text-dark transition-colors" id="sort-name">Alert Name${sortIcon('name')}</th>
                            <th class="p-4">Context</th>
                            <th class="p-4 cursor-pointer select-none hover:text-text-light dark:hover:text-text-dark transition-colors" id="sort-time">Time${sortIcon('time')}</th>
                            <th class="p-4 text-center" title="Duplicate firings dropped by storm protection">Suppressed</th>
                            <th class="p-4 text-right normal-case font-normal">
                                <select id="incident-context-filter" class="bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark rounded-md h-7 px-3 text-[10px] text-muted focus:ring-1 ring-primary-light">
                                    <option value="all">All Contexts</option>
                                    ${uniqueContexts.map(ctx => `<option value="${ctx}" ${state.activeIncidentsFilter === ctx ? 'selected' : ''}>${ctx}</option>`).join('')}
                                </select>
                            </th>
                        </tr>
                    </thead>
                    <tbody id="incidents-body">
                        ${active.length === 0 ? `<tr><td colspan="7" class="empty-state text-primary-light dark:text-primary-dark">All Clear — No Active Incidents</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const body = container.querySelector('#incidents-body');
    active.forEach(inc => {
        const row = document.createElement('tr');
        row.className = 'border-b border-surface-hover-light dark:border-surface-hover-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark/40 cursor-pointer transition-colors text-[13px]';
        row.innerHTML = `
            <td class="p-4 font-mono text-[11px] text-muted">${inc.incident_id.slice(0, 8)}</td>
            <td class="p-4"><span class="badge badge-sev${inc.severity.toLowerCase() === 'critical' ? '1' : inc.severity.toLowerCase() === 'warning' ? '2' : '3'}">${inc.severity}</span></td>
            <td class="p-4 font-bold text-text-light dark:text-text-dark">${inc.alert_name}</td>
            <td class="p-4 font-medium text-muted">${renderContext(inc.namespace)}</td>
            <td class="p-4 text-muted text-[11px]" title="${new Date(resolveFireTime(inc).endsWith('Z') ? resolveFireTime(inc) : resolveFireTime(inc) + 'Z').toLocaleString()}">${relativeTime(resolveFireTime(inc))}</td>
            <td class="p-4 text-center">
                ${inc.dedup_count > 0
                    ? `<span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full text-[9px] font-bold">${inc.dedup_count}x</span>`
                    : '<span class="text-muted/40 text-[10px]">—</span>'}
            </td>
            <td class="p-4 text-center">
                <button class="quickview-btn px-3 py-1 bg-surface-hover-light dark:bg-surface-hover-dark hover:bg-primary-light/10 dark:hover:bg-primary-dark/20 border border-surface-hover-light dark:border-surface-hover-dark text-text-light dark:text-text-dark text-[9px] font-bold uppercase rounded transition-colors" data-id="${inc.incident_id}">View</button>
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

    // Quick View modal logic
    container.querySelectorAll('.quickview-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const inc = state.incidents.find(i => i.incident_id === btn.dataset.id);
            if (inc) openQuickView(inc);
        };
    });

    const filter = container.querySelector('#incident-context-filter');
    if (filter) {
        filter.onchange = (e) => updateState({ activeIncidentsFilter: e.target.value });
    }

    container.querySelector('#sort-sev').onclick = () => {
        sortDir = (sortCol === 'severity' && sortDir === 'desc') ? 'asc' : 'desc';
        sortCol = 'severity';
        renderActiveIncidentsView(container);
    };

    container.querySelector('#sort-name').onclick = () => {
        sortDir = (sortCol === 'name' && sortDir === 'asc') ? 'desc' : 'asc';
        sortCol = 'name';
        renderActiveIncidentsView(container);
    };

    container.querySelector('#sort-time').onclick = () => {
        sortDir = (sortCol === 'time' && sortDir === 'desc') ? 'asc' : 'desc';
        sortCol = 'time';
        renderActiveIncidentsView(container);
    };

}
