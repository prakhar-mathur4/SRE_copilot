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
    if (!raw || raw === 'unknown') return '<span class="text-neutral-400 italic">unknown</span>';
    const idx = raw.indexOf(':');
    if (idx === -1) return `<span>${raw}</span>`;
    const key = raw.slice(0, idx);
    const val = raw.slice(idx + 1);
    return `<span class="text-[11px] font-mono text-neutral-400 uppercase">${key}:</span><span class="ml-1">${val}</span>`;
}

function severityBadgeClass(sev) {
    switch ((sev || '').toLowerCase()) {
        case 'critical': case 'page': return 'badge badge-sev1';
        case 'warning':  return 'badge badge-sev2';
        default:         return 'badge badge-sev3';
    }
}

function openQuickView(inc) {
    // Remove any existing modal first
    document.getElementById('quickview-modal')?.remove();

    const labels      = inc.labels      || {};
    const annotations = inc.annotations || {};

    const renderKV = (obj) => {
        const entries = Object.entries(obj);
        if (entries.length === 0) return '<span class="text-neutral-400 italic text-xs">none</span>';
        return entries.map(([k, v]) => `
            <div class="flex gap-3 py-1.5 border-b border-neutral-200 last:border-0 min-w-0">
                <span class="text-xs font-mono font-bold text-primary-600 shrink-0 w-36 truncate" title="${k}">${k}</span>
                <span class="text-[11px] text-text-light break-all">${v}</span>
            </div>`).join('');
    };

    const pipelineSteps = [
        { label: 'Diagnostics', done: inc.diagnostics_collected },
        { label: 'RCA',         done: inc.rca_completed },
        { label: 'Runbook',     done: inc.runbook_executed },
    ];

    const modal = document.createElement('div');
    modal.id = 'quickview-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center glass p-4';
    modal.innerHTML = `
        <div class="pane w-full max-w-2xl max-h-[85vh] flex flex-col" style="box-shadow:var(--shadow-400);">

            <!-- Header -->
            <div class="flex items-start justify-between gap-4 p-6 border-b border-neutral-200 shrink-0">
                <div class="flex flex-col gap-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="${severityBadgeClass(inc.severity)}">${inc.severity}</span>
                        <span class="text-[11px] font-mono text-muted">${inc.incident_id.slice(0, 16)}…</span>
                    </div>
                    <h2 class="text-lg font-bold text-text-light truncate">${inc.alert_name}</h2>
                    <div class="flex gap-4 text-xs text-muted mt-0.5 flex-wrap">
                        <span>Started: <span class="text-text-light">${relativeTime(resolveFireTime(inc))}</span></span>
                        <span>Updated: <span class="text-text-light">${relativeTime(inc.last_updated)}</span></span>
                        <span>Events: <span class="text-text-light">${inc.event_count}</span></span>
                        ${inc.dedup_count > 0
                            ? `<span class="flex items-center gap-1">Storm Protection: <span class="ml-1 px-1.5 py-0.5 bg-warning-50 text-warning-500 border border-warning-75 rounded text-[11px] font-bold">${inc.dedup_count} suppressed</span></span>`
                            : ''}
                    </div>
                </div>
                <button id="qv-close" class="shrink-0 modal-close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <!-- Pipeline status strip -->
            <div class="flex gap-0 shrink-0 border-b border-neutral-200">
                ${pipelineSteps.map(s => `
                    <div class="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-widest ${s.done ? 'text-success-500' : 'text-neutral-400'}">
                        <span class="w-1.5 h-1.5 rounded-full ${s.done ? 'bg-success-500' : 'bg-neutral-300'}"></span>
                        ${s.label}
                    </div>`).join('<div class="w-px bg-neutral-200"></div>')}
            </div>

            <!-- Scrollable body -->
            <div class="flex-grow overflow-y-auto p-6 flex flex-col gap-6">

                <!-- Labels -->
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Labels (${Object.keys(labels).length})</div>
                    <div class="bg-neutral-100 rounded p-4">
                        ${renderKV(labels)}
                    </div>
                </div>

                <!-- Annotations -->
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Annotations (${Object.keys(annotations).length})</div>
                    <div class="bg-neutral-100 rounded p-4">
                        ${renderKV(annotations)}
                    </div>
                </div>

            </div>

            <!-- Footer -->
            <div class="shrink-0 px-6 py-4 border-t border-neutral-200 flex justify-between items-center">
                <span class="text-xs text-muted">Click the row to open the full Control Room view</span>
                <button id="qv-open-cr" class="btn-primary">Open Control Room →</button>
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

    const uniqueContexts = [...new Set(active.map(i => i.context || 'unknown'))].sort();

    if (state.activeIncidentsFilter !== 'all') {
        active = active.filter(i => (i.context || 'unknown') === state.activeIncidentsFilter);
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
                <span>Firing Alerts <span class="text-text-light font-bold">${active.length}</span></span>
                <span class="flex items-center gap-1.5 ${active.length > 0 ? 'text-danger-500' : 'text-success-500'} text-[11px] font-bold">
                    <span class="w-1.5 h-1.5 rounded-full ${active.length > 0 ? 'bg-danger-500 animate-pulse' : 'bg-success-500'}"></span>
                    ${active.length > 0 ? 'LIVE' : 'HEALTHY'}
                </span>
            </div>
            <div class="flex-grow overflow-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="table-header">
                        <tr>
                            <th class="p-4">ID</th>
                            <th class="p-4 cursor-pointer select-none hover:text-text-light transition-colors" id="sort-sev">Severity${sortIcon('severity')}</th>
                            <th class="p-4 cursor-pointer select-none hover:text-text-light transition-colors" id="sort-name">Alert Name${sortIcon('name')}</th>
                            <th class="p-4">Context</th>
                            <th class="p-4 cursor-pointer select-none hover:text-text-light transition-colors" id="sort-time">Time${sortIcon('time')}</th>
                            <th class="p-4 text-center" title="Duplicate firings dropped by storm protection">Suppressed</th>
                            <th class="p-4 text-right normal-case font-normal">
                                <select id="incident-context-filter" class="bg-neutral-75 border border-neutral-200 rounded h-7 px-3 text-xs text-muted focus:ring-1 ring-primary-600">
                                    <option value="all">All Contexts</option>
                                    ${uniqueContexts.map(ctx => `<option value="${ctx}" ${state.activeIncidentsFilter === ctx ? 'selected' : ''}>${ctx}</option>`).join('')}
                                </select>
                            </th>
                        </tr>
                    </thead>
                    <tbody id="incidents-body">
                        ${active.length === 0 ? `<tr><td colspan="7" class="empty-state text-primary-600">All Clear — No Active Incidents</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const body = container.querySelector('#incidents-body');
    active.forEach(inc => {
        const row = document.createElement('tr');
        row.className = 'border-b border-neutral-200 hover:bg-neutral-75 cursor-pointer transition-colors text-[13px]';
        row.innerHTML = `
            <td class="p-4 font-mono text-[11px] text-muted">${inc.incident_id.slice(0, 8)}</td>
            <td class="p-4"><span class="${severityBadgeClass(inc.severity)}">${inc.severity}</span></td>
            <td class="p-4 font-bold text-text-light">${inc.alert_name}</td>
            <td class="p-4 font-medium text-muted">${renderContext(inc.context)}</td>
            <td class="p-4 text-muted text-[11px]" title="${new Date(resolveFireTime(inc).endsWith('Z') ? resolveFireTime(inc) : resolveFireTime(inc) + 'Z').toLocaleString()}">${relativeTime(resolveFireTime(inc))}</td>
            <td class="p-4 text-center">
                ${inc.dedup_count > 0
                    ? `<span class="px-2 py-0.5 bg-warning-50 text-warning-500 border border-warning-75 rounded-full text-[11px] font-bold">${inc.dedup_count}x</span>`
                    : '<span class="text-neutral-400 text-xs">—</span>'}
            </td>
            <td class="p-4 text-center">
                <button class="quickview-btn btn-outline" style="height:28px; padding:0 10px; font-size:11px;" data-id="${inc.incident_id}">View</button>
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
