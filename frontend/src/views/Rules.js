/**
 * RULES & SUPPRESSION CENTER
 */
import { state, updateState } from '../utils/state';
import { API_BASE, fetchFilters, addFilter, deleteFilter, fetchMaintenance, addMaintenance, deleteMaintenance, evaluateCel, fetchNoiseStats } from '../utils/api';

export async function renderRulesView(container) {
    container.innerHTML = '<div class="p-20 text-center" style="color:#666666; font-size:13px;">Loading suppression registry...</div>';

    try {
        const [filters, windows, stats] = await Promise.all([fetchFilters(), fetchMaintenance(), fetchNoiseStats()]);

        container.innerHTML = `
            <div class="flex flex-col gap-8 h-full max-w-7xl mx-auto px-6 animate-fade-in">

                <!-- Stats Bar -->
                <div class="grid grid-cols-3 gap-4">
                    <div class="pane flex flex-col gap-1 p-5">
                        <div class="text-[11px] font-bold uppercase tracking-widest text-muted">Storm Protection (Dedup)</div>
                        <div class="text-3xl font-bold text-warning-500">${stats.total_deduplicated}</div>
                        <div class="text-xs text-muted">duplicate firings dropped this session</div>
                    </div>
                    <div class="pane flex flex-col gap-1 p-5">
                        <div class="text-[11px] font-bold uppercase tracking-widest text-muted">Filter Rule Drops</div>
                        <div class="text-3xl font-bold text-danger-500">${stats.total_filter_dropped}</div>
                        <div class="text-xs text-muted">alerts discarded by CEL rules</div>
                    </div>
                    <div class="pane flex flex-col gap-1 p-5">
                        <div class="text-[11px] font-bold uppercase tracking-widest text-muted">Maintenance Suppressions</div>
                        <div class="text-3xl font-bold text-info-500">${stats.total_maintenance_suppressed}</div>
                        <div class="text-xs text-muted">alerts silenced by maintenance windows</div>
                    </div>
                </div>

                ${stats.dedup_details.length > 0 ? `
                <!-- Dedup Details -->
                <div class="pane">
                    <div class="pane-header">Active Storm Protection — Deduplicated Alerts</div>
                    <div class="p-0 overflow-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="table-header">
                                <tr>
                                    <th class="p-4">Alert Name</th>
                                    <th class="p-4">Fingerprint</th>
                                    <th class="p-4 text-right">Duplicate Drops</th>
                                    <th class="p-4 text-right">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-neutral-200">
                                ${stats.dedup_details.map(d => `
                                    <tr class="hover:bg-neutral-75 transition-colors text-xs">
                                        <td class="p-4 font-bold">${d.alert_name}</td>
                                        <td class="p-4 font-mono text-muted text-xs">${d.fingerprint}…</td>
                                        <td class="p-4 text-right"><span class="px-2 py-0.5 bg-warning-50 text-warning-500 border border-warning-75 rounded-full text-[11px] font-bold">${d.count}x</span></td>
                                        <td class="p-4 text-right text-muted">${d.last_seen ? new Date(d.last_seen + 'Z').toLocaleTimeString() : '—'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>` : ''}

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <!-- Left: Rules & Windows -->
                    <div class="lg:col-span-8 flex flex-col gap-8">

                        <!-- Filter Rules -->
                        <div class="pane">
                            <div class="pane-header flex justify-between items-center">
                                <span>Active Filter Rules</span>
                                <button id="add-filter-btn" class="text-xs text-primary-600 hover:underline font-bold">New Rule +</button>
                            </div>
                            <div class="p-0 overflow-auto max-h-[400px]">
                                <table class="w-full text-left border-collapse">
                                    <thead class="table-header">
                                        <tr>
                                            <th class="p-4">Rule Name</th>
                                            <th class="p-4">CEL Expression</th>
                                            <th class="p-4">Action</th>
                                            <th class="p-4 text-center">Hits</th>
                                            <th class="p-4 text-right">Ops</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-neutral-200">
                                        ${filters.length === 0 ? '<tr><td colspan="5" class="empty-state">No Filter Rules Defined</td></tr>' : ''}
                                        ${filters.map(f => `
                                            <tr class="hover:bg-neutral-75 transition-colors text-xs">
                                                <td class="p-4 font-bold">${f.name}</td>
                                                <td class="p-4"><code class="text-primary-600 bg-primary-50 px-2 py-1 rounded">${f.expression}</code></td>
                                                <td class="p-4"><span class="badge ${f.action === 'discard' ? 'badge-sev1' : 'badge-sev3'}">${f.action}</span></td>
                                                <td class="p-4 text-center">
                                                    ${(stats.filter_stats[f.name] || 0) > 0
                                                        ? `<span class="px-2 py-0.5 bg-danger-50 text-danger-500 border border-danger-75 rounded-full text-[11px] font-bold">${stats.filter_stats[f.name]}x</span>`
                                                        : '<span class="text-muted text-xs">0</span>'}
                                                </td>
                                                <td class="p-4 text-right">
                                                    <button class="delete-filter-btn text-danger-500 hover:underline text-xs font-bold" data-name="${f.name}">Delete</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Maintenance Windows -->
                        <div class="pane">
                            <div class="pane-header flex justify-between items-center">
                                <span>Maintenance Windows</span>
                                <button id="add-window-btn" class="text-xs text-primary-600 hover:underline font-bold">Schedule Window +</button>
                            </div>
                            <div class="p-0 overflow-auto max-h-[400px]">
                                <table class="w-full text-left border-collapse">
                                    <thead class="table-header">
                                        <tr>
                                            <th class="p-4">Window ID</th>
                                            <th class="p-4">Scope (CEL)</th>
                                            <th class="p-4">End Time (UTC)</th>
                                            <th class="p-4 text-center">Suppressed</th>
                                            <th class="p-4 text-right">Ops</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-neutral-200">
                                        ${windows.length === 0 ? '<tr><td colspan="5" class="empty-state">No Active Maintenance Windows</td></tr>' : ''}
                                        ${windows.map(w => `
                                            <tr class="hover:bg-neutral-75 transition-colors text-xs">
                                                <td class="p-4 font-bold">${w.id}</td>
                                                <td class="p-4"><code class="text-warning-500 bg-warning-50 px-2 py-1 rounded">${w.query}</code></td>
                                                <td class="p-4 text-muted">${new Date(w.end_time).toLocaleString()}</td>
                                                <td class="p-4 text-center">
                                                    ${(stats.maintenance_stats[w.id] || 0) > 0
                                                        ? `<span class="px-2 py-0.5 bg-info-50 text-info-500 border border-info-75 rounded-full text-[11px] font-bold">${stats.maintenance_stats[w.id]}x</span>`
                                                        : '<span class="text-muted text-xs">0</span>'}
                                                </td>
                                                <td class="p-4 text-right">
                                                    <button class="delete-window-btn text-danger-500 hover:underline text-xs font-bold" data-id="${w.id}">End Now</button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Right: CEL Playground -->
                    <div class="lg:col-span-4 flex flex-col gap-6 sticky top-10">
                        <div class="pane">
                            <div class="pane-header">CEL Playground</div>
                            <div class="p-6 flex flex-col gap-4">
                                <p class="text-[11px] text-muted leading-relaxed">Test your suppression logic against a mock alert before deploying.</p>

                                <div>
                                    <label class="text-[11px] font-bold text-muted uppercase mb-1 block">Expression</label>
                                    <textarea id="cel-input" class="w-full h-24 bg-neutral-75 border border-neutral-200 text-text-light rounded p-3 font-mono text-xs focus:ring-1 ring-primary-600 outline-none" placeholder="labels.severity == 'warning'"></textarea>
                                </div>

                                <button id="test-cel-btn" class="btn-primary w-full">Evaluate Logic</button>

                                <div id="cel-result" class="hidden p-4 rounded border flex flex-col gap-2">
                                    <span class="text-[11px] font-bold uppercase" id="result-label">Result</span>
                                    <div id="result-text" class="text-sm font-bold"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Documentation Bento -->
                        <div class="bento-card bg-primary-50 border border-primary-200">
                            <h3 class="text-sm font-bold mb-2">CEL Cheat Sheet</h3>
                            <ul class="text-[11px] text-muted space-y-2">
                                <li><code class="text-primary-600">labels.alertname == 'HighCPU'</code></li>
                                <li><code class="text-primary-600">labels.namespace.startsWith('prod-')</code></li>
                                <li><code class="text-primary-600">severity in ['critical', 'page']</code></li>
                                <li><code class="text-primary-600">status == 'firing'</code></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event Handlers
        container.querySelector('#add-filter-btn').onclick = () => showAddFilterModal(container);
        container.querySelector('#add-window-btn').onclick = () => showAddWindowModal(container);

        container.querySelectorAll('.delete-filter-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm(`Delete rule "${btn.dataset.name}"?`)) {
                    await deleteFilter(btn.dataset.name);
                    renderRulesView(container);
                }
            };
        });

        container.querySelectorAll('.delete-window-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm(`End maintenance "${btn.dataset.id}"?`)) {
                    await deleteMaintenance(btn.dataset.id);
                    renderRulesView(container);
                }
            };
        });

        container.querySelector('#test-cel-btn').onclick = async () => {
            const expr = container.querySelector('#cel-input').value;
            const mockAlert = {
                status: 'firing',
                labels: { alertname: 'TestAlert', severity: 'warning', namespace: 'default' },
                annotations: { description: 'A test alert' },
                startsAt: '', endsAt: '', generatorURL: '', fingerprint: ''
            };

            const { result } = await evaluateCel(expr, mockAlert);
            const resBox = container.querySelector('#cel-result');
            const resText = container.querySelector('#result-text');

            resBox.classList.remove('hidden');
            resBox.style.background = result ? '#ECFFFD' : '#FFF2F2';
            resBox.style.borderColor = result ? '#B0EFDA' : '#FCDEDE';

            resText.innerText = result ? 'MATCHED (Suppressed)' : 'NO MATCH (Allowed)';
            resText.className = `text-sm font-bold ${result ? 'text-success-500' : 'text-danger-500'}`;
        };

    } catch (e) {
        container.innerHTML = `<div class="p-20 text-center text-danger-500 font-bold uppercase">REGISTRY OFFLINE: ${e.message}</div>`;
    }
}

async function showAddFilterModal(container) {
    const name = prompt("Enter Rule Name:");
    if (!name) return;
    const expression = prompt("Enter CEL Expression (e.g. labels.severity == 'warning'):");
    if (!expression) return;

    await addFilter({ name, expression, action: 'discard' });
    renderRulesView(container);
}

async function showAddWindowModal(container) {
    const id = prompt("Enter Window ID:");
    if (!id) return;
    const query = prompt("Enter Scope CEL (e.g. labels.namespace == 'dev'):");
    if (!query) return;

    // Set for 1 hour from now
    const start_time = new Date().toISOString();
    const end_time = new Date(Date.now() + 3600000).toISOString();

    await addMaintenance({ id, start_time, end_time, query });
    renderRulesView(container);
}
