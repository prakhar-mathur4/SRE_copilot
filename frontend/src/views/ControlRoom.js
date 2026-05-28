/**
 * INCIDENT CONTROL ROOM (Bento Grid Upgrade)
 */
import { state, updateState } from '../utils/state';
import { API_BASE } from '../utils/api';
import { marked } from 'marked';
import { openRunbookModal } from '../utils/runbookModal';

export async function renderControlRoomView(container) {
    if (!state.selectedIncidentId) {
        updateState({ view: 'active' });
        return;
    }

    container.innerHTML = '<div class="p-20 text-center animate-pulse font-mono text-primary-light">INITIATING CONTROL LINK...</div>';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(`${API_BASE}/incidents/${state.selectedIncidentId}`, { signal: controller.signal });
        clearTimeout(timeout);
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
                        
                        <div class="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                            <div class="text-[9px] font-bold text-muted uppercase mb-1">Context</div>
                            <div class="text-[10px] font-mono text-text-light dark:text-text-dark break-all">
                                ${inc.context || inc.labels?.namespace || inc.labels?.cluster || '—'}
                            </div>
                            ${(inc.dedup_count > 1) ? `
                            <div class="flex items-center gap-1.5 mt-1">
                                <span class="text-[9px] font-bold text-muted uppercase">Dedup</span>
                                <span class="px-1.5 py-0.5 rounded bg-alert-orange/10 text-alert-orange text-[9px] font-bold">
                                    ×${inc.dedup_count} firings
                                </span>
                            </div>` : ''}
                            <div class="flex items-center gap-1.5 mt-1">
                                <span class="text-[9px] font-bold text-muted uppercase">Events</span>
                                <span class="text-[10px] font-mono text-muted">${inc.events?.length ?? inc.event_count ?? 0} in timeline</span>
                            </div>
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
                            <button id="view-runbook-btn" class="text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 border-transparent text-muted hover:text-text-primary transition-all flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Runbook Fix
                            </button>
                        </div>
                        <span class="px-2 py-0.5 bg-accent-primary/10 text-accent-primary text-[9px] font-bold rounded">${inc.llm_display || 'AI Analysis'}</span>
                    </div>

                    <!-- AI Content -->
                    <div id="ai-content" class="flex-grow overflow-auto prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-white/5">
                        ${inc.rca_report
                            ? ((!inc.telemetry_available)
                                ? `<div class="mb-3 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 not-prose">Not enough information to collect telemetry — check AI recommendation below or perform a manual investigation.</div>` + marked.parse(inc.rca_report)
                                : marked.parse(inc.rca_report))
                            : '<div class="text-muted italic p-10 text-center">Synthesizing cluster telemetry...</div>'
                        }
                    </div>

                    <!-- Raw Content (Hidden by default) -->
                    <div id="raw-content" class="hidden flex-grow overflow-auto terminal">
                        <pre class="whitespace-pre-wrap p-4 text-[10px] text-cyan-200/80">${inc.raw_diagnostics || (!inc.telemetry_available ? 'Not enough information to collect telemetry.\nCheck the AI recommendation or perform a manual investigation.' : 'No raw telemetry collected for this incident.')}</pre>
                    </div>

                    <!-- Runbook Fix (Hidden by default, lazy-loaded) -->
                    <div id="runbook-content" class="hidden flex-grow overflow-auto">
                        <div id="runbook-inner" class="flex items-center justify-center h-full gap-2 text-muted text-sm">
                            <div class="spinner" style="width:14px;height:14px;border-color:rgba(255,255,255,0.1);border-top-color:currentColor"></div>
                            <span>Searching Confluence…</span>
                        </div>
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
                        <span class="flex h-2 w-2 rounded-full ${!inc.telemetry_available ? 'bg-yellow-500' : (inc.rca_completed ? 'bg-alert-green' : 'bg-alert-green animate-ping')}"></span>
                    </div>
                    <div class="flex-grow terminal text-primary-dark/80 p-0 shadow-none border-none overflow-x-hidden">
                        <div class="space-y-1">
                            <div class="text-text-dark/20">[00:00:01] PROBE: ${inc.labels?.instance || inc.labels?.cluster || inc.context || 'unknown'}</div>
                            <div class="text-text-dark/20">[00:00:02] CONTEXT: ${inc.context}</div>
                            ${inc.events.filter(e => e.source === 'Diagnostics').map(e => `<div class="break-words"><span class="text-text-dark/20">[${new Date(e.timestamp).toLocaleTimeString()}]</span> ${e.description}</div>`).join('')}
                            ${!inc.rca_completed ? '<div class="animate-pulse text-primary-dark">_</div>' : ''}
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
                <div class="md:col-span-9 row-span-2 bento-card border-t-4 ${inc.rca_completed ? 'border-t-accent-primary' : 'border-t-muted'} bg-accent-primary/5">
                    <div class="flex flex-col gap-3 h-full">
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="text-[10px] font-bold text-accent-primary uppercase tracking-widest">AI Suggested Remediation</span>
                            ${inc.rca_completed ? '<span class="text-[9px] font-bold px-2 py-0.5 bg-accent-primary/20 text-accent-primary rounded">ANALYSIS COMPLETE</span>' : ''}
                            ${!inc.telemetry_available ? '<span class="text-[9px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">NO TELEMETRY</span>' : ''}
                        </div>
                        ${inc.suggested_remediation
                            ? `<div class="flex-grow p-4 rounded-xl bg-black/30 border border-accent-primary/20 overflow-auto">
                                <p class="text-sm leading-relaxed">${inc.suggested_remediation}</p>
                               </div>
                               <p class="text-[10px] text-muted italic flex-shrink-0">Suggestion only — all actions must be performed manually by an on-call engineer.</p>`
                            : (inc.rca_completed
                                ? `<p class="text-sm text-muted italic">No remediation suggestion generated. Review the AI RCA tab for details.</p>`
                                : `<div class="flex items-center gap-3 text-muted flex-grow">
                                    <div class="animate-spin h-4 w-4 border-2 border-accent-primary/20 border-t-accent-primary rounded-full flex-shrink-0"></div>
                                    <span class="text-sm italic">Waiting for AI analysis...</span>
                                   </div>`)
                        }
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
        const runbookBtn = container.querySelector('#view-runbook-btn');
        const aiContent      = container.querySelector('#ai-content');
        const rawContent     = container.querySelector('#raw-content');
        const payloadContent = container.querySelector('#payload-content');
        const runbookContent = container.querySelector('#runbook-content');
        const runbookInner   = container.querySelector('#runbook-inner');

        const allBtns     = [aiBtn, rawBtn, payloadBtn, runbookBtn];
        const allContents = [aiContent, rawContent, payloadContent, runbookContent];

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

        // Runbook tab — lazy fetch on first click
        let runbookLoaded = false;
        runbookBtn.onclick = async () => {
            activateTab(runbookBtn, runbookContent);
            if (runbookLoaded) return;
            runbookLoaded = true;
            try {
                const res  = await fetch(`${API_BASE}/runbooks/suggest?incident_id=${encodeURIComponent(inc.incident_id)}`);
                const data = await res.json();

                if (!data.configured) {
                    runbookInner.innerHTML = `
                        <div class="flex flex-col items-center gap-3 text-center p-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <p class="text-sm text-muted">Confluence not configured.</p>
                            <p class="text-[11px] text-muted">Add your Confluence details in <strong>Settings → Confluence Runbooks</strong>.</p>
                        </div>`;
                    return;
                }

                if (!data.found) {
                    runbookInner.innerHTML = `
                        <div class="flex flex-col items-center gap-3 text-center p-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <p class="text-sm text-muted">No runbook found for <span class="font-bold text-text-light dark:text-text-dark">${data.alert_name}</span>.</p>
                            <p class="text-[11px] text-muted">Consider creating a runbook in Confluence under the configured root page.</p>
                        </div>`;
                    return;
                }

                runbookInner.innerHTML = `
                    <div class="flex flex-col gap-3 p-4 h-full">
                        <!-- Runbook header -->
                        <div class="flex items-center justify-between flex-shrink-0 gap-3 flex-wrap">
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="p-1.5 rounded bg-blue-500/10 text-blue-400 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <span class="text-[11px] font-bold text-blue-400 uppercase tracking-widest truncate">${data.runbook_title}</span>
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                                ${data.runbook_id ? `
                                <button id="rb-view-full-btn"
                                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                           bg-blue-500/10 hover:bg-blue-500/20 text-blue-400
                                           text-[10px] font-bold uppercase tracking-widest transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                                        fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                    View Full Runbook
                                </button>` : ''}
                                ${data.runbook_url ? `
                                <a href="${data.runbook_url}" target="_blank" rel="noopener noreferrer"
                                    class="flex items-center gap-1 text-[9px] font-bold text-muted
                                           hover:text-primary-light dark:hover:text-primary-dark
                                           uppercase tracking-widest transition-colors">
                                    Confluence
                                    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>` : ''}
                            </div>
                        </div>
                        <!-- AI suggestion -->
                        <div class="flex-grow overflow-auto bg-black/20 rounded-xl border border-white/5 p-4">
                            <p class="text-[12px] leading-relaxed whitespace-pre-wrap">${data.suggestion}</p>
                        </div>
                        <p class="text-[10px] text-muted italic flex-shrink-0">
                            AI-grounded suggestion · all actions must be performed manually by the on-call engineer
                        </p>
                    </div>`;
                if (data.runbook_id) {
                    runbookInner.querySelector('#rb-view-full-btn').onclick = () =>
                        openRunbookModal(data.runbook_id, data.runbook_title, data.runbook_url);
                }
            } catch (e) {
                runbookInner.innerHTML = `<div class="text-alert-red text-sm p-4">Failed to fetch runbook suggestion: ${e.message}</div>`;
            }
        };


} catch (e) {
        clearTimeout(timeout);
        const isTimeout = e.name === 'AbortError';
        container.innerHTML = `
            <div class="p-20 text-center flex flex-col items-center gap-4">
                <div class="text-alert-red font-bold font-mono text-sm">
                    ${isTimeout ? 'LINK TIMEOUT — Backend did not respond within 10s' : `LINK FAILURE: ${e.message}`}
                </div>
                <button id="cr-retry-btn" class="mt-2 px-6 py-2 bg-primary-light dark:bg-primary-dark text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 transition-opacity">
                    Retry
                </button>
            </div>`;
        container.querySelector('#cr-retry-btn').onclick = () => renderControlRoomView(container);
    }
}
