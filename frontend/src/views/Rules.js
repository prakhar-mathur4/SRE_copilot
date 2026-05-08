/**
 * RULES & SUPPRESSION CENTER
 */
import { state, updateState } from '../utils/state';
import { API_BASE, fetchFilters, addFilter, deleteFilter, fetchMaintenance, addMaintenance, deleteMaintenance, evaluateCel, fetchNoiseStats } from '../utils/api';

export async function renderRulesView(container) {
    container.innerHTML = '<div class="p-20 text-center animate-pulse font-heading text-lg">LOADING SUPPRESSION REGISTRY...</div>';

    try {
        const [filters, windows, stats] = await Promise.all([fetchFilters(), fetchMaintenance(), fetchNoiseStats()]);

        container.innerHTML = `
            <div class="flex flex-col gap-8 h-full max-w-7xl mx-auto px-6 animate-fade-in">

                <!-- Stats Bar -->
                <div class="grid grid-cols-3 gap-4">
                    <div class="pane flex flex-col gap-1 p-5">
                        <div class="text-[9px] font-bold uppercase tracking-widest text-muted">Storm Protection (Dedup)</div>
                        <div class="text-3xl font-bold text-yellow-400">${stats.total_deduplicated}</div>
                        <div class="text-[10px] text-muted">duplicate firings dropped this session</div>
                    </div>
                    <div class="pane flex flex-col gap-1 p-5">
                        <div class="text-[9px] font-bold uppercase tracking-widest text-muted">Filter Rule Drops</div>
                        <div class="text-3xl font-bold text-red-400">${stats.total_filter_dropped}</div>
                        <div class="text-[10px] text-muted">alerts discarded by CEL rules</div>
                    </div>
                    <div class="pane flex flex-col gap-1 p-5">
                        <div class="text-[9px] font-bold uppercase tracking-widest text-muted">Maintenance Suppressions</div>
                        <div class="text-3xl font-bold text-blue-400">${stats.total_maintenance_suppressed}</div>
                        <div class="text-[10px] text-muted">alerts silenced by maintenance windows</div>
                    </div>
                </div>

                ${stats.dedup_details.length > 0 ? `
                <!-- Dedup Details -->
                <div class="pane">
                    <div class="pane-header">Active Storm Protection — Deduplicated Alerts</div>
                    <div class="p-0 overflow-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="sticky top-0 bg-surface-light dark:bg-surface-dark border-b border-surface-hover-light dark:border-surface-hover-dark text-[10px] uppercase text-muted font-bold">
                                <tr>
                                    <th class="p-4">Alert Name</th>
                                    <th class="p-4">Fingerprint</th>
                                    <th class="p-4 text-right">Duplicate Drops</th>
                                    <th class="p-4 text-right">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-surface-hover-light dark:divide-surface-hover-dark">
                                ${stats.dedup_details.map(d => `
                                    <tr class="hover:bg-surface-hover-light/50 dark:hover:bg-surface-hover-dark/50 transition-colors text-xs">
                                        <td class="p-4 font-bold">${d.alert_name}</td>
                                        <td class="p-4 font-mono text-muted text-[10px]">${d.fingerprint}…</td>
                                        <td class="p-4 text-right"><span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full text-[9px] font-bold">${d.count}x</span></td>
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
                                <button id="add-filter-btn" class="text-[10px] text-accent-primary hover:underline font-bold">New Rule +</button>
                            </div>
                            <div class="p-0 overflow-auto max-h-[400px]">
                                <table class="w-full text-left border-collapse">
                                    <thead class="sticky top-0 bg-surface-light dark:bg-surface-dark border-b border-surface-hover-light dark:border-surface-hover-dark text-[10px] uppercase text-muted font-bold">
                                        <tr>
                                            <th class="p-4">Rule Name</th>
                                            <th class="p-4">CEL Expression</th>
                                            <th class="p-4">Action</th>
                                            <th class="p-4 text-center">Hits</th>
                                            <th class="p-4 text-right">Ops</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-surface-hover-light dark:divide-surface-hover-dark">
                                        ${filters.length === 0 ? '<tr><td colspan="5" class="empty-state">No Filter Rules Defined</td></tr>' : ''}
                                        ${filters.map(f => `
                                            <tr class="hover:bg-surface-hover-light/50 dark:hover:bg-surface-hover-dark/50 transition-colors text-xs">
                                                <td class="p-4 font-bold">${f.name}</td>
                                                <td class="p-4"><code class="text-accent-primary bg-surface-hover-light dark:bg-surface-hover-dark px-2 py-1 rounded">${f.expression}</code></td>
                                                <td class="p-4"><span class="badge ${f.action === 'discard' ? 'badge-sev1' : 'badge-sev3'}">${f.action}</span></td>
                                                <td class="p-4 text-center">
                                                    ${(stats.filter_stats[f.name] || 0) > 0
                                                        ? `<span class="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full text-[9px] font-bold">${stats.filter_stats[f.name]}x</span>`
                                                        : '<span class="text-muted text-[10px]">0</span>'}
                                                </td>
                                                <td class="p-4 text-right">
                                                    <button class="delete-filter-btn text-accent-danger hover:underline" data-name="${f.name}">Delete</button>
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
                                <button id="add-window-btn" class="text-[10px] text-accent-primary hover:underline font-bold">Schedule Window +</button>
                            </div>
                            <div class="p-0 overflow-auto max-h-[400px]">
                                <table class="w-full text-left border-collapse">
                                    <thead class="sticky top-0 bg-surface-light dark:bg-surface-dark border-b border-surface-hover-light dark:border-surface-hover-dark text-[10px] uppercase text-muted font-bold">
                                        <tr>
                                            <th class="p-4">Window ID</th>
                                            <th class="p-4">Scope (CEL)</th>
                                            <th class="p-4">End Time (UTC)</th>
                                            <th class="p-4 text-center">Suppressed</th>
                                            <th class="p-4 text-right">Ops</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-surface-hover-light dark:divide-surface-hover-dark">
                                        ${windows.length === 0 ? '<tr><td colspan="5" class="empty-state">No Active Maintenance Windows</td></tr>' : ''}
                                        ${windows.map(w => `
                                            <tr class="hover:bg-surface-hover-light/50 dark:hover:bg-surface-hover-dark/50 transition-colors text-xs">
                                                <td class="p-4 font-bold">${w.id}</td>
                                                <td class="p-4"><code class="text-accent-warning bg-surface-hover-light dark:bg-surface-hover-dark px-2 py-1 rounded">${w.query}</code></td>
                                                <td class="p-4 text-muted">${new Date(w.end_time).toLocaleString()}</td>
                                                <td class="p-4 text-center">
                                                    ${(stats.maintenance_stats[w.id] || 0) > 0
                                                        ? `<span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full text-[9px] font-bold">${stats.maintenance_stats[w.id]}x</span>`
                                                        : '<span class="text-muted text-[10px]">0</span>'}
                                                </td>
                                                <td class="p-4 text-right">
                                                    <button class="delete-window-btn text-accent-danger hover:underline" data-id="${w.id}">End Now</button>
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
                                    <label class="text-[9px] font-bold text-muted uppercase mb-1 block">Expression</label>
                                    <textarea id="cel-input" class="w-full h-24 bg-surface-hover-light dark:bg-surface-hover-dark border border-surface-hover-light dark:border-surface-hover-dark text-text-light dark:text-text-dark rounded-lg p-3 font-mono text-xs focus:ring-1 ring-accent-primary outline-none" placeholder="labels.severity == 'warning'"></textarea>
                                </div>

                                <button id="test-cel-btn" class="btn-primary w-full">Evaluate Logic</button>

                                <div id="cel-result" class="hidden p-4 rounded-lg border flex flex-col gap-2">
                                    <span class="text-[9px] font-bold uppercase" id="result-label">Result</span>
                                    <div id="result-text" class="text-sm font-bold"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Documentation Bento -->
                        <div class="bento-card bg-accent-primary/5 border-accent-primary/20">
                            <h3 class="text-sm font-bold mb-2">CEL Cheat Sheet</h3>
                            <ul class="text-[11px] text-muted space-y-2">
                                <li><code class="text-accent-primary">labels.alertname == 'HighCPU'</code></li>
                                <li><code class="text-accent-primary">labels.namespace.startsWith('prod-')</code></li>
                                <li><code class="text-accent-primary">severity in ['critical', 'page']</code></li>
                                <li><code class="text-accent-primary">status == 'firing'</code></li>
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
            
            resBox.classList.remove('hidden', 'bg-accent-success/10', 'border-accent-success/20', 'bg-accent-danger/10', 'border-accent-danger/20');
            resBox.classList.add(result ? 'bg-accent-success/10' : 'bg-accent-danger/10');
            resBox.classList.add(result ? 'border-accent-success/20' : 'border-accent-danger/20');
            
            resText.innerText = result ? 'MATCHED (Suppressed)' : 'NO MATCH (Allowed)';
            resText.className = `text-sm font-bold ${result ? 'text-accent-success' : 'text-accent-danger'}`;
        };

    } catch (e) {
        container.innerHTML = `<div class="p-20 text-center text-accent-danger font-bold uppercase">REGISTRY OFFLINE: ${e.message}</div>`;
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
