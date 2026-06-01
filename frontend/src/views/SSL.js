/**
 * SSL CERTIFICATE MONITOR — compact table view
 */
import { API_BASE } from '../utils/api';

// Persist sort state across refreshes
let _sortCol = null;   // 'status' | 'days' | 'expires'
let _sortDir = 1;      // 1 = asc, -1 = desc

const STATUS_ORDER = { expired: 0, critical: 1, warning: 2, error: 3, unknown: 4, valid: 5 };

function sortDomains(domains) {
    if (!_sortCol) return domains;
    return [...domains].sort((a, b) => {
        let av, bv;
        if (_sortCol === 'status') {
            av = STATUS_ORDER[a.status] ?? 6;
            bv = STATUS_ORDER[b.status] ?? 6;
        } else if (_sortCol === 'days') {
            av = a.days_remaining ?? Infinity;
            bv = b.days_remaining ?? Infinity;
        } else if (_sortCol === 'expires') {
            av = a.expiry ? new Date(a.expiry).getTime() : Infinity;
            bv = b.expiry ? new Date(b.expiry).getTime() : Infinity;
        }
        return av === bv ? 0 : (av < bv ? -1 : 1) * _sortDir;
    });
}

function sortIcon(col) {
    if (_sortCol !== col) return `<span class="opacity-30 ml-1">⇅</span>`;
    return _sortDir === 1
        ? `<span class="ml-1 text-primary-600">▲</span>`
        : `<span class="ml-1 text-primary-600">▼</span>`;
}

function handleSort(col, container, domains) {
    if (_sortCol === col) {
        _sortDir *= -1;
    } else {
        _sortCol = col;
        _sortDir = 1;
    }
    renderDashboard(container, domains);
}

export async function renderSSLView(container) {
    container.innerHTML = loadingHtml();
    try {
        const res    = await fetch(`${API_BASE}/ssl/domains`);
        const data   = await res.json();
        const domains = data.domains || [];
        renderDashboard(container, domains);

        // Auto-check on first visit if nothing has been checked yet
        if (domains.length > 0 && domains.every(d => d.status === 'unknown')) {
            _triggerCheck(container);
        }
    } catch (e) {
        container.innerHTML = `<div class="flex items-center justify-center h-full">
            <div class="text-danger-500 font-bold text-sm">Failed to load: ${escHtml(e.message)}</div>
        </div>`;
    }
}

async function _triggerCheck(container) {
    try {
        const res  = await fetch(`${API_BASE}/ssl/check`, { method: 'POST' });
        const data = await res.json();
        renderDashboard(container, data.results || []);
    } catch (_) {}
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

function renderDashboard(container, domains) {
    const lastChecked = domains
        .map(d => d.checked_at ? new Date(d.checked_at) : null)
        .filter(Boolean).sort((a, b) => b - a)[0];

    const counts = {};
    domains.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });

    const sorted = sortDomains(domains);

    container.innerHTML = `
        <div class="flex flex-col gap-4 max-w-5xl mx-auto w-full">

            <!-- Header -->
            <div class="flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-3 flex-wrap">
                    <div>
                        <h2 class="text-lg font-bold">SSL Monitor</h2>
                        <p class="text-[11px] text-muted">
                            ${domains.length} domains
                            ${lastChecked ? `· Checked ${relativeTime(lastChecked)}` : ''}
                        </p>
                    </div>
                    ${summaryBadges(counts)}
                </div>
                <div class="flex items-center gap-2">
                    ${(counts.critical || 0) + (counts.expired || 0) > 0 ? `
                    <button id="ssl-copy-btn"
                        class="flex items-center gap-1.5 px-3 h-8 rounded
                               bg-danger-50 text-danger-500 border border-danger-75
                               text-xs font-bold uppercase tracking-widest
                               hover:bg-danger-75 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                            <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                        </svg>
                        Copy Alert
                    </button>` : ''}
                    <button id="ssl-add-btn" class="btn-primary flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="3">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Add
                    </button>
                    <button id="ssl-refresh-btn" class="btn-outline flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Table -->
            ${domains.length === 0 ? emptyState() : `
            <div class="pane overflow-hidden">
                <table class="w-full text-[11px]">
                    <thead>
                        <tr class="border-b border-neutral-200 text-[11px] font-bold uppercase tracking-widest text-muted">
                            <th class="text-left px-4 py-2.5 w-8">#</th>
                            <th class="text-left px-4 py-2.5">Domain</th>
                            <th class="text-left px-4 py-2.5 cursor-pointer hover:text-text-light select-none" id="sort-status">
                                Status${sortIcon('status')}
                            </th>
                            <th class="text-left px-4 py-2.5 cursor-pointer hover:text-text-light select-none" id="sort-days">
                                Days Left${sortIcon('days')}
                            </th>
                            <th class="text-left px-4 py-2.5 cursor-pointer hover:text-text-light select-none" id="sort-expires">
                                Expires${sortIcon('expires')}
                            </th>
                            <th class="text-left px-4 py-2.5">Issuer</th>
                            <th class="px-4 py-2.5 w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map((d, i) => tableRow(d, i)).join('')}
                    </tbody>
                </table>
            </div>`}
        </div>`;

    // Sort headers
    container.querySelector('#sort-status')?.addEventListener('click', () => handleSort('status',  container, domains));
    container.querySelector('#sort-days')?.addEventListener('click',   () => handleSort('days',    container, domains));
    container.querySelector('#sort-expires')?.addEventListener('click', () => handleSort('expires', container, domains));

    // Copy alert
    container.querySelector('#ssl-copy-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const urgentDomains = domains.filter(d => d.status === 'critical' || d.status === 'expired');
        const lines = urgentDomains.map(d => {
            const portStr = d.port !== 443 ? `:${d.port}` : '';
            const expiry  = d.expiry
                ? new Date(d.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'unknown';
            const daysStr = d.days_remaining === null ? ''
                : d.days_remaining < 0 ? ` — ${Math.abs(d.days_remaining)}d overdue`
                : ` — ${d.days_remaining}d left`;
            return `• ${d.domain}${portStr}  [${d.status.toUpperCase()}]${daysStr}  (expires ${expiry})`;
        });
        const checkedStr = lastChecked
            ? lastChecked.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'unknown';
        const msg = [
            `🔴 SSL Alert — ${urgentDomains.length} domain${urgentDomains.length > 1 ? 's' : ''} need attention`,
            `Checked: ${checkedStr}`,
            '',
            ...lines,
        ].join('\n');

        const orig = btn.innerHTML;
        try {
            await navigator.clipboard.writeText(msg);
            btn.textContent = '✓ Copied!';
        } catch (_) {
            btn.textContent = 'Copy failed';
        } finally {
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
        }
    });

    // Add
    container.querySelector('#ssl-add-btn')?.addEventListener('click', () => showAddModal(container));

    // Refresh
    container.querySelector('#ssl-refresh-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#ssl-refresh-btn');
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Checking…';
        try {
            await _triggerCheck(container);
        } catch (_) {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });

    // Delete
    container.querySelectorAll('.ssl-delete-btn').forEach(btn =>
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const { domain, port } = btn.dataset;
            await fetch(`${API_BASE}/ssl/domains/${encodeURIComponent(domain)}?port=${port}`, { method: 'DELETE' });
            renderSSLView(container);
        })
    );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_CFG = {
    valid:   { label: 'Valid',    color: 'text-success-500', bg: 'bg-success-50'  },
    warning: { label: 'Expiring', color: 'text-warning-500', bg: 'bg-warning-50'  },
    critical:{ label: 'Critical', color: 'text-danger-500',  bg: 'bg-danger-50'   },
    expired: { label: 'Expired',  color: 'text-danger-500',  bg: 'bg-danger-50'   },
    error:   { label: 'Error',    color: 'text-muted',       bg: 'bg-neutral-100' },
    unknown: { label: 'Pending',  color: 'text-muted',       bg: 'bg-neutral-100' },
};

function tableRow(d, i) {
    const cfg      = STATUS_CFG[d.status] || STATUS_CFG.unknown;
    const portStr  = d.port !== 443 ? `:${d.port}` : '';
    const expiryStr = d.expiry
        ? new Date(d.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';

    let daysCell;
    if (d.days_remaining === null) {
        daysCell = '<span class="text-muted">—</span>';
    } else if (d.days_remaining < 0) {
        daysCell = `<span class="font-bold text-danger-500">${Math.abs(d.days_remaining)}d overdue</span>`;
    } else {
        daysCell = `<span class="font-bold font-mono ${cfg.color}">${d.days_remaining}d</span>`;
    }

    const rowBg = i % 2 === 0 ? '' : 'bg-neutral-75';

    return `
        <tr class="border-b border-neutral-200 hover:bg-primary-50 transition-colors ${rowBg}">
            <td class="px-4 py-2 text-muted font-mono text-[11px]">${i + 1}</td>
            <td class="px-4 py-2">
                <span class="font-mono font-medium">${escHtml(d.domain)}${escHtml(portStr)}</span>
                ${d.error ? `<div class="text-[11px] text-danger-500 mt-0.5 truncate max-w-[220px]">${escHtml(d.error)}</div>` : ''}
            </td>
            <td class="px-4 py-2">
                <span class="px-1.5 py-0.5 rounded text-[11px] font-bold ${cfg.bg} ${cfg.color}">
                    ${cfg.label}
                </span>
            </td>
            <td class="px-4 py-2">${daysCell}</td>
            <td class="px-4 py-2 text-muted font-mono">${expiryStr}</td>
            <td class="px-4 py-2 text-muted max-w-[140px] truncate">${escHtml(d.issuer || '—')}</td>
            <td class="px-4 py-2 text-right">
                <button class="ssl-delete-btn p-1 rounded text-neutral-400
                               hover:text-danger-500 hover:bg-danger-50 transition-all"
                    data-domain="${escAttr(d.domain)}" data-port="${d.port}" title="Remove">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </td>
        </tr>`;
}

function summaryBadges(counts) {
    const items = [
        { key: 'valid',    label: 'Valid',    cls: 'bg-success-50 text-success-500'   },
        { key: 'warning',  label: 'Expiring', cls: 'bg-warning-50 text-warning-500'   },
        { key: 'critical', label: 'Critical', cls: 'bg-danger-50  text-danger-500'    },
        { key: 'expired',  label: 'Expired',  cls: 'bg-danger-50  text-danger-500'    },
        { key: 'error',    label: 'Error',    cls: 'bg-neutral-100 text-muted'        },
        { key: 'unknown',  label: 'Pending',  cls: 'bg-neutral-100 text-muted'        },
    ].filter(i => counts[i.key] > 0);

    if (!items.length) return '';
    return `<div class="flex items-center gap-1.5 flex-wrap">
        ${items.map(i => `<span class="px-2 py-0.5 rounded text-[11px] font-bold ${i.cls}">${counts[i.key]} ${i.label}</span>`).join('')}
    </div>`;
}

function showAddModal(container) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 glass z-50 flex items-center justify-center p-6';
    overlay.innerHTML = `
        <div class="pane p-8 max-w-md w-full" style="box-shadow:var(--shadow-400);">
            <div class="flex items-center justify-between mb-5">
                <div>
                    <h3 class="text-base font-bold">Add Domains</h3>
                    <p class="text-xs text-muted mt-0.5">SSL checked automatically after adding.</p>
                </div>
                <button id="ssl-modal-close" class="modal-close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest block mb-1.5">
                        One domain per line · supports domain:port
                    </label>
                    <textarea id="ssl-domain-input" rows="6"
                        class="input-modern w-full resize-none font-mono text-[11px] leading-relaxed"
                        placeholder="example.com&#10;api.company.com&#10;internal.svc.com:8443"></textarea>
                </div>
                <div id="ssl-add-feedback" class="hidden text-xs font-mono px-3 py-2 rounded"></div>
                <div class="flex gap-2">
                    <button id="ssl-modal-cancel" class="btn-outline flex-1">Cancel</button>
                    <button id="ssl-modal-save" class="btn-primary flex-1">Add &amp; Check</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#ssl-modal-close').onclick  = close;
    overlay.querySelector('#ssl-modal-cancel').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    const esc = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);

    overlay.querySelector('#ssl-modal-save').onclick = async () => {
        const btn      = overlay.querySelector('#ssl-modal-save');
        const feedback = overlay.querySelector('#ssl-add-feedback');
        const raw      = overlay.querySelector('#ssl-domain-input').value.trim();
        if (!raw) return;

        const lines = raw.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
        btn.disabled = true; btn.textContent = 'Adding…';

        let added = 0, failed = 0;
        for (const line of lines) {
            try {
                const { domain, port } = parseDomainPort(line);
                const res = await fetch(`${API_BASE}/ssl/domains`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain, port }),
                });
                if (res.ok) added++; else failed++;
            } catch (_) { failed++; }
        }

        const ok = added > 0;
        feedback.className = `text-xs font-mono px-3 py-2 rounded ${
            ok ? 'bg-success-50 text-success-500 border border-success-75'
               : 'bg-danger-50 text-danger-500 border border-danger-75'}`;
        feedback.textContent = (ok ? '✓ ' : '✗ ') + `${added} added${failed ? `, ${failed} failed` : ''}`;
        feedback.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Add & Check';

        if (ok) {
            setTimeout(async () => {
                close();
                const res  = await fetch(`${API_BASE}/ssl/check`, { method: 'POST' });
                const data = await res.json();
                renderDashboard(container, data.results || []);
            }, 600);
        }
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDomainPort(input) {
    input = input.trim().toLowerCase();
    const last = input.lastIndexOf(':');
    if (last !== -1) {
        const p = input.slice(last + 1);
        if (/^\d+$/.test(p)) return { domain: input.slice(0, last), port: parseInt(p, 10) };
    }
    return { domain: input, port: 443 };
}

function relativeTime(date) {
    const m = Math.floor((Date.now() - date.getTime()) / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
    return String(s ?? '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function emptyState() {
    return `<div class="pane p-12 flex flex-col items-center justify-center gap-4 text-center">
        <div class="p-4 rounded bg-neutral-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted mx-auto">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
        </div>
        <div>
            <h3 class="font-bold text-sm mb-1">No domains yet</h3>
            <p class="text-[11px] text-muted">Click "Add" to start monitoring SSL certificates.</p>
        </div>
    </div>`;
}

function loadingHtml() {
    return `<div style="display:flex;align-items:center;justify-content:center;height:200px;gap:10px;">
        <div class="rb-spin"></div>
        <span class="text-sm text-muted">Loading SSL Monitor…</span>
    </div>`;
}
