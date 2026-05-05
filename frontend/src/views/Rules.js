/**
 * RULES & SUPPRESSION CENTER
 */
import { state, updateState } from '../utils/state';
import { API_BASE, fetchFilters, addFilter, deleteFilter, fetchMaintenance, addMaintenance, deleteMaintenance, evaluateCel } from '../utils/api';

export async function renderRulesView(container) {
    container.innerHTML = '<div class="p-20 text-center animate-pulse font-heading text-lg">LOADING SUPPRESSION REGISTRY...</div>';

    try {
        const [filters, windows] = await Promise.all([fetchFilters(), fetchMaintenance()]);

        container.innerHTML = `
            <div class="flex flex-col gap-8 h-full max-w-7xl mx-auto py-10 px-6 animate-fade-in">
                <!-- Header -->
                <div class="flex flex-col gap-2">
                    <h2 class="text-3xl font-bold tracking-tight">Suppression Center</h2>
                    <p class="text-muted text-sm max-w-2xl">Manage alert noise by defining filter rules and maintenance windows using Common Expression Language (CEL).</p>
                </div>

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
                                    <thead class="sticky top-0 bg-surface-color border-b border-white/5 text-[10px] uppercase text-muted font-bold">
                                        <tr>
                                            <th class="p-4">Rule Name</th>
                                            <th class="p-4">CEL Expression</th>
                                            <th class="p-4">Action</th>
                                            <th class="p-4 text-right">Ops</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5">
                                        ${filters.length === 0 ? '<tr><td colspan="4" class="p-10 text-center text-muted italic text-xs">No filter rules defined.</td></tr>' : ''}
                                        ${filters.map(f => `
                                            <tr class="hover:bg-white/5 transition-colors text-xs">
                                                <td class="p-4 font-bold">${f.name}</td>
                                                <td class="p-4"><code class="text-accent-primary bg-black/30 px-2 py-1 rounded">${f.expression}</code></td>
                                                <td class="p-4"><span class="badge ${f.action === 'discard' ? 'badge-sev1' : 'badge-sev3'}">${f.action}</span></td>
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
                                    <thead class="sticky top-0 bg-surface-color border-b border-white/5 text-[10px] uppercase text-muted font-bold">
                                        <tr>
                                            <th class="p-4">Window ID</th>
                                            <th class="p-4">Scope (CEL)</th>
                                            <th class="p-4">End Time (UTC)</th>
                                            <th class="p-4 text-right">Ops</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5">
                                        ${windows.length === 0 ? '<tr><td colspan="4" class="p-10 text-center text-muted italic text-xs">No active maintenance windows.</td></tr>' : ''}
                                        ${windows.map(w => `
                                            <tr class="hover:bg-white/5 transition-colors text-xs">
                                                <td class="p-4 font-bold">${w.id}</td>
                                                <td class="p-4"><code class="text-accent-warning bg-black/30 px-2 py-1 rounded">${w.query}</code></td>
                                                <td class="p-4 text-muted">${new Date(w.end_time).toLocaleString()}</td>
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
                                    <textarea id="cel-input" class="w-full h-24 bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-xs focus:ring-1 ring-accent-primary outline-none" placeholder="labels.severity == 'warning'"></textarea>
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
