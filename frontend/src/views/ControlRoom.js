/**
 * INCIDENT CONTROL ROOM (Bento Grid Upgrade)
 */
import { state, updateState } from '../utils/state';
import { API_BASE } from '../utils/api';
import { marked } from 'marked';

export async function renderControlRoomView(container) {
    if (!state.selectedIncidentId) {
        updateState({ view: 'active' });
        return;
    }

    container.innerHTML = '<div class="p-20 text-center animate-pulse font-mono text-primary-light">INITIATING CONTROL LINK...</div>';

    try {
        const res = await fetch(`${API_BASE}/incidents/${state.selectedIncidentId}`);
        const inc = await res.json();

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-12 grid-rows-6 gap-4 h-full min-h-0">
                <!-- 1. Incident Info (Bento Unit) -->
                <div class="md:col-span-3 row-span-2 bento-card border-l-4 border-l-primary-light dark:border-l-primary-dark">
                    <div class="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">INCIDENT ID</div>
                    <div class="flex items-center gap-2 mb-4">
                        <span class="font-mono text-sm font-bold text-primary-light dark:text-primary-dark" title="${inc.incident_id}">${inc.incident_id.slice(0, 16)}…</span>
                        <button id="copy-id-btn" title="Copy full ID" class="p-1 rounded hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark text-muted hover:text-text-light dark:hover:text-text-dark transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>
                    
                    <div class="flex flex-col gap-4">
                        <div>
                            <span class="badge badge-sev${inc.severity.toLowerCase() === 'critical' ? '1' : inc.severity.toLowerCase() === 'warning' ? '2' : '3'} mb-2">${inc.severity}</span>
                            <h2 class="text-xl font-bold leading-tight">${inc.alert_name}</h2>
                        </div>
                        <div class="text-xs text-muted">
                            Started: ${new Date(inc.alert_starts_at && !inc.alert_starts_at.startsWith('0001') ? inc.alert_starts_at : inc.start_time).toLocaleString()}
                        </div>
                        
                        <div class="mt-4 pt-4 border-t border-white/5">
                            <div class="text-[9px] font-bold text-muted uppercase mb-2">Notification Status</div>
                            <div class="flex items-center gap-2 text-[10px] text-accent-success font-bold">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                Microsoft Teams Sent
                            </div>
                            <a href="#" class="text-[10px] text-accent-primary hover:underline mt-1 block">View Teams Thread →</a>
                        </div>
                    </div>
                </div>

                <!-- 2. Analysis & Telemetry (Bento Unit) -->
                <div class="md:col-span-6 row-span-4 bento-card overflow-hidden flex flex-col">
                    <div class="flex items-center justify-between mb-4 flex-shrink-0">
                        <div class="flex gap-4">
                            <button id="view-ai-btn" class="text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 border-accent-primary">AI RCA</button>
                            <button id="view-raw-btn" class="text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 border-transparent text-muted hover:text-text-primary transition-all">Raw Telemetry</button>
                            <button id="view-payload-btn" class="text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 border-transparent text-muted hover:text-text-primary transition-all">Alert Payload</button>
                        </div>
                        <span class="px-2 py-0.5 bg-accent-primary/10 text-accent-primary text-[9px] font-bold rounded">GPT-4o Vision</span>
                    </div>

                    <!-- AI Content -->
                    <div id="ai-content" class="flex-grow overflow-auto prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-white/5">
                        ${inc.diagnostics_failed
                            ? `<div class="p-10 text-center border-2 border-dashed border-alert-red/20 rounded-2xl bg-alert-red/5">
                                <h3 class="text-alert-red font-bold text-lg mb-2 uppercase tracking-tighter">Pipeline Failure</h3>
                                <p class="text-xs text-muted leading-relaxed">The diagnostic engine could not reach the target infrastructure.<br><br>
                                <span class="bg-alert-red/10 px-2 py-1 rounded text-alert-red font-mono font-bold">${inc.diagnostics_error || 'CONNECTION_TIMEOUT'}</span></p>
                               </div>`
                            : (inc.rca_report ? marked.parse(inc.rca_report) : '<div class="text-muted italic p-10 text-center">Synthesizing cluster telemetry...</div>')
                        }
                    </div>

                    <!-- Raw Content (Hidden by default) -->
                    <div id="raw-content" class="hidden flex-grow overflow-auto terminal">
                        <pre class="whitespace-pre-wrap p-4 text-[10px] text-cyan-200/80">${inc.raw_diagnostics || (inc.diagnostics_failed ? 'ERROR: INFRASTRUCTURE UNREACHABLE' : 'No raw diagnostics available for this incident.')}</pre>
                    </div>

                    <!-- Alert Payload (Hidden by default) -->
                    <div id="payload-content" class="hidden flex-grow overflow-auto p-1">
                        ${(() => {
                            const labels      = inc.labels      || {};
                            const annotations = inc.annotations || {};
                            const renderKV = (obj) => {
                                const entries = Object.entries(obj);
                                if (entries.length === 0) return '<span class="text-muted/50 italic text-xs">none</span>';
                                return entries.map(([k, v]) => `
                                    <div class="flex gap-3 py-1.5 border-b border-surface-hover-light/50 dark:border-surface-hover-dark/50 last:border-0 min-w-0">
                                        <span class="text-[10px] font-mono font-bold text-primary-light dark:text-primary-dark shrink-0 w-40 truncate" title="${k}">${k}</span>
                                        <span class="text-[11px] text-text-light dark:text-text-dark break-all">${v}</span>
                                    </div>`).join('');
                            };
                            return `
                                <div class="flex flex-col gap-5">
                                    <div>
                                        <div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-2">Labels (${Object.keys(labels).length})</div>
                                        <div class="bg-surface-hover-light/30 dark:bg-surface-hover-dark/30 rounded-lg p-4">${renderKV(labels)}</div>
                                    </div>
                                    <div>
                                        <div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-2">Annotations (${Object.keys(annotations).length})</div>
                                        <div class="bg-surface-hover-light/30 dark:bg-surface-hover-dark/30 rounded-lg p-4">${renderKV(annotations)}</div>
                                    </div>
                                    ${inc.alert_starts_at ? `
                                    <div>
                                        <div class="text-[9px] font-bold uppercase tracking-widest text-muted mb-2">Fire Time (Alertmanager)</div>
                                        <div class="bg-surface-hover-light/30 dark:bg-surface-hover-dark/30 rounded-lg p-4">
                                            <span class="text-[11px] font-mono text-text-light dark:text-text-dark">${inc.alert_starts_at}</span>
                                        </div>
                                    </div>` : ''}
                                </div>`;
                        })()}
                    </div>
                </div>

                <!-- 3. Diagnostic Logs (Bento Unit) — intentionally always dark like a terminal -->
                <div class="md:col-span-3 row-span-4 bento-card overflow-hidden !bg-background-dark !border-surface-hover-dark">
                    <div class="text-[10px] font-bold text-text-dark/40 uppercase tracking-widest mb-4 flex items-center justify-between">
                        <span>Diagnostic Stream</span>
                        <span class="flex h-2 w-2 rounded-full ${inc.diagnostics_failed ? 'bg-alert-red shadow-[0_0_8px_#EF4444]' : 'bg-alert-green animate-ping'}"></span>
                    </div>
                    <div class="flex-grow terminal text-primary-dark/80 p-0 shadow-none border-none overflow-x-hidden">
                        <div class="space-y-1">
                            <div class="text-text-dark/20">[00:00:01] PROBE: ${inc.labels?.instance || inc.labels?.cluster || inc.namespace || 'unknown'}</div>
                            <div class="text-text-dark/20">[00:00:02] CONTEXT: ${inc.namespace}</div>
                            ${inc.events.filter(e => e.source === 'Diagnostics').map(e => `<div class="break-words"><span class="text-text-dark/20">[${new Date(e.timestamp).toLocaleTimeString()}]</span> ${e.description}</div>`).join('')}
                            ${!inc.diagnostics_failed && !inc.rca_completed ? '<div class="animate-pulse text-primary-dark">_</div>' : ''}
                        </div>
                    </div>
                </div>

                <!-- 4. Timeline (Bento Unit) -->
                <div class="md:col-span-3 row-span-4 bento-card">
                    <div class="text-[10px] font-bold text-muted uppercase tracking-widest mb-6">Event Timeline</div>
                    <div class="flex-grow overflow-auto relative pl-2">
                        <div class="absolute left-3 top-0 bottom-0 w-[1px] bg-surface-hover-light dark:bg-surface-hover-dark"></div>
                        <div class="space-y-8 relative">
                            ${inc.events.map((e, i) => `
                                <div class="relative pl-8 group">
                                    <div class="absolute left-0 top-1.5 w-2 h-2 rounded-full border-2 ${e.description.includes('CRITICAL') ? 'border-alert-red bg-alert-red/20' : 'border-primary-light dark:border-primary-dark bg-surface-light dark:bg-surface-dark'} group-hover:scale-125 transition-transform"></div>
                                    <div class="text-[9px] font-bold text-muted mb-1">${new Date(e.timestamp).toLocaleTimeString()}</div>
                                    <div class="text-[11px] font-medium leading-normal ${e.description.includes('CRITICAL') ? 'text-alert-red font-bold' : ''}">${e.description}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- 5. Remediation (Bento Unit) -->
                <div class="md:col-span-9 row-span-2 bento-card border-t-4 ${inc.diagnostics_failed ? 'border-t-muted grayscale' : 'border-t-alert-orange'} shadow-lg shadow-alert-orange/5 bg-alert-orange/5">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-[10px] font-bold ${inc.diagnostics_failed ? 'text-muted' : 'text-alert-orange'} uppercase tracking-widest">Recommended Remediation</span>
                                ${inc.runbook_executed ? '<span class="text-[9px] font-bold px-2 py-0.5 bg-alert-green text-white rounded">EXECUTED</span>' : ''}
                            </div>
                            <h3 class="text-lg font-bold mb-1">${inc.diagnostics_failed ? 'Infrastructure Unreachable' : (inc.recommended_runbook || 'Standard Pod Restart')}</h3>
                            <p class="text-xs text-muted italic">${inc.diagnostics_failed ? 'Remediation engine suspended due to connectivity loss.' : `Verified safe for ${inc.namespace} context via historical runbooks.`}</p>
                        </div>
                        
                        ${!inc.runbook_executed && !inc.diagnostics_failed ? `
                            <div class="flex-grow flex flex-col gap-3">
                                <div class="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px]">
                                    <div class="text-muted mb-1 font-sans uppercase font-bold tracking-widest text-[8px]">Proposed Command</div>
                                    <div class="text-primary-light flex items-center gap-2">
                                        <span class="text-white/20">$</span>
                                        <span>${
                                            inc.alert_name === 'LocalDiskFull' ? 'rm -rf /tmp/test-logs && df -h /' :
                                            inc.alert_name === 'PodCrashLooping' ? `kubectl delete pod ${inc.namespace ? '-n ' + inc.namespace : ''} web-api-pod-xyz` :
                                            inc.alert_name === 'HighCPUUsage' ? 'ps aux --sort=-%cpu | head -n 5' :
                                            'sre-copilot-remediate --incident-id ' + inc.incident_id.slice(0,8)
                                        }</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-4 items-center shrink-0">
                                <div class="text-right hidden lg:block">
                                    <div class="text-[9px] text-muted-light uppercase font-bold mb-1">Human-in-the-loop</div>
                                    <div class="text-[10px] italic">Requires manual confirmation</div>
                                </div>
                                <button class="btn-primary bg-alert-orange from-alert-orange to-red-500 shadow-alert-orange/20" id="approve-runbook-btn">Approve Execution</button>
                            </div>
                        ` : (inc.runbook_executed ? `
                            <div class="p-3 rounded-lg bg-black/40 font-mono text-[10px] text-primary-light/60 flex-grow max-w-md">
                                <span class="text-white/40">$ runbook_exec --id ${inc.incident_id}</span><br>
                                <span class="text-accent-success">> ${inc.runbook_action}</span>
                            </div>
                        ` : `
                            <div class="p-3 border-2 border-dashed border-white/5 rounded-xl text-[10px] text-muted uppercase font-bold tracking-widest px-10">
                                Manual Control Required
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        `;

        // Copy incident ID to clipboard
        container.querySelector('#copy-id-btn').onclick = async () => {
            await navigator.clipboard.writeText(inc.incident_id);
            const btn = container.querySelector('#copy-id-btn');
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            btn.classList.add('text-alert-green');
            setTimeout(() => {
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                btn.classList.remove('text-alert-green');
            }, 2000);
        };

        // Tabs Logic
        const aiBtn      = container.querySelector('#view-ai-btn');
        const rawBtn     = container.querySelector('#view-raw-btn');
        const payloadBtn = container.querySelector('#view-payload-btn');
        const aiContent      = container.querySelector('#ai-content');
        const rawContent     = container.querySelector('#raw-content');
        const payloadContent = container.querySelector('#payload-content');

        const allBtns     = [aiBtn, rawBtn, payloadBtn];
        const allContents = [aiContent, rawContent, payloadContent];

        function activateTab(btn, content) {
            allBtns.forEach(b => { b.classList.remove('border-accent-primary'); b.classList.add('border-transparent', 'text-muted'); });
            allContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('border-accent-primary');
            btn.classList.remove('border-transparent', 'text-muted');
            content.classList.remove('hidden');
        }

        aiBtn.onclick      = () => activateTab(aiBtn, aiContent);
        rawBtn.onclick     = () => activateTab(rawBtn, rawContent);
        payloadBtn.onclick = () => activateTab(payloadBtn, payloadContent);

        const btn = container.querySelector('#approve-runbook-btn');
        if (btn) {
            btn.onclick = async () => {
                const confirmVal = prompt('Type "EXECUTE" to run the remediation:');
                if (confirmVal === 'EXECUTE') {
                    btn.disabled = true;
                    btn.innerText = 'EXECUTING...';
                    try {
                        const r = await fetch(`${API_BASE}/runbook/trigger`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ incident_id: inc.incident_id, alert_name: inc.alert_name })
                        });
                        const data = await r.json();
                        if (data.success) renderControlRoomView(container);
                        else alert("Failed: " + data.detail);
                    } catch (e) { console.error(e); }
                }
            };
        }

    } catch (e) {
        container.innerHTML = `<div class="p-20 text-center text-alert-red font-bold">LINK FAILURE: ${e.message}</div>`;
    }
}
