/**
 * INCIDENT CONTROL ROOM
 */
import { state, updateState } from '../utils/state';
import { apiFetch, apiJson } from '../utils/api';
import { renderError } from '../utils/ui';
import { marked } from 'marked';
import { openRunbookModal } from '../utils/runbookModal';

export async function renderControlRoomView(container) {
    if (!state.selectedIncidentId) {
        updateState({ view: 'active' });
        return;
    }

    container.innerHTML = '<div class="p-20 text-center animate-pulse font-mono" style="color:#666666;">Initializing control link...</div>';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const inc = await apiJson(`/incidents/${state.selectedIncidentId}`, { signal: controller.signal }, { silent: true });
        clearTimeout(timeout);

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-12 grid-rows-6 gap-4 h-full min-h-0">

                <!-- 1. Incident Info -->
                <div class="md:col-span-3 row-span-2 bento-card border-l-4 border-l-primary-600">
                    <div class="text-xs font-bold text-muted uppercase tracking-widest mb-1">Incident ID</div>
                    <div class="flex items-center gap-2 mb-4">
                        <span class="font-mono text-sm font-bold text-primary-600" title="${inc.incident_id}">${inc.incident_id.slice(0, 16)}…</span>
                        <button id="copy-id-btn" title="Copy full ID" class="p-1 rounded hover:bg-neutral-100 text-muted hover:text-neutral-1000 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>

                    <div class="flex flex-col gap-4">
                        <div>
                            <span class="badge badge-sev${inc.severity.toLowerCase() === 'critical' ? '1' : inc.severity.toLowerCase() === 'warning' ? '2' : '3'} mb-2">${inc.severity}</span>
                            <h2 class="text-base font-bold leading-tight" style="color:#121212;">${inc.alert_name}</h2>
                        </div>
                        <div class="text-xs text-muted">
                            Started: ${new Date(inc.alert_starts_at && !inc.alert_starts_at.startsWith('0001') ? inc.alert_starts_at : inc.start_time).toLocaleString()}
                        </div>

                        <div class="mt-4 pt-4 border-t border-neutral-200 flex flex-col gap-2">
                            <div class="text-xs font-bold text-muted mb-1">Context</div>
                            <div class="text-xs font-mono" style="color:#121212; word-break:break-all;">
                                ${inc.context || inc.labels?.namespace || inc.labels?.cluster || '—'}
                            </div>
                            ${(inc.dedup_count > 1) ? `
                            <div class="flex items-center gap-1.5 mt-1">
                                <span class="text-xs font-bold text-muted">Dedup</span>
                                <span class="px-2 py-0.5 rounded text-xs font-bold" style="background:#FFF3DE; color:#A36701; border:1px solid #F7D8A3;">
                                    ×${inc.dedup_count} firings
                                </span>
                            </div>` : ''}
                            <div class="flex items-center gap-1.5 mt-1">
                                <span class="text-xs font-bold text-muted">Events</span>
                                <span class="text-xs font-mono text-muted">${inc.events?.length ?? inc.event_count ?? 0} in timeline</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. Analysis & Telemetry -->
                <div class="md:col-span-6 row-span-4 bento-card overflow-hidden flex flex-col">
                    <div class="flex items-center justify-between mb-4 flex-shrink-0">
                        <!-- IQM Horizontal Tabs — Medium: h-[34px], 2px bottom border, Primary-600 active -->
                        <div class="flex gap-1">
                            <button id="view-ai-btn" class="px-3 text-xs font-bold border-b-2 border-primary-600 text-primary-600 transition-colors" style="height:34px;">AI RCA</button>
                            <button id="view-raw-btn" class="px-3 text-xs font-bold border-b-2 border-transparent text-muted hover:text-neutral-1000 transition-colors" style="height:34px;">Raw Telemetry</button>
                            <button id="view-payload-btn" class="px-3 text-xs font-bold border-b-2 border-transparent text-muted hover:text-neutral-1000 transition-colors" style="height:34px;">Alert Payload</button>
                            <button id="view-runbook-btn" class="px-3 text-xs font-bold border-b-2 border-transparent text-muted hover:text-neutral-1000 transition-colors flex items-center gap-1.5" style="height:34px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Runbook Fix
                            </button>
                        </div>
                        <span class="px-2 py-0.5 rounded text-xs font-bold" style="background:#F2F6FF; color:#134AC1;">${inc.llm_display || 'AI Analysis'}</span>
                    </div>

                    <!-- AI Content -->
                    <div id="ai-content" class="flex-grow overflow-auto prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-neutral-100 prose-pre:border prose-pre:border-neutral-200">
                        ${inc.rca_report
                            ? ((!inc.telemetry_available)
                                ? `<div class="mb-3 p-3 rounded text-xs not-prose" style="background:#FFF3DE; border:1px solid #F7D8A3; color:#A36701;">Not enough information to collect telemetry — check AI recommendation below or perform a manual investigation.</div>` + marked.parse(inc.rca_report)
                                : marked.parse(inc.rca_report))
                            : '<div class="text-muted italic p-10 text-center text-sm">Synthesizing cluster telemetry...</div>'
                        }
                    </div>

                    <!-- Raw Telemetry (hidden by default) -->
                    <div id="raw-content" class="hidden flex-grow overflow-auto terminal">
                        <!-- #3 FIX: inline color for terminal text — terminal is an intentional dark-surface exception -->
                        <pre class="whitespace-pre-wrap p-4 text-xs" style="color:#a5f3fc;">${inc.raw_diagnostics || (!inc.telemetry_available ? 'Not enough information to collect telemetry.\nCheck the AI recommendation or perform a manual investigation.' : 'No raw telemetry collected for this incident.')}</pre>
                    </div>

                    <!-- Runbook Fix (hidden by default, lazy-loaded) -->
                    <div id="runbook-content" class="hidden flex-grow overflow-auto">
                        <div id="runbook-inner" class="flex items-center justify-center h-full gap-2 text-muted text-sm">
                            <div style="width:14px; height:14px; border-radius:50%; border:2px solid #E6E6E6; border-top-color:#134AC1;" class="animate-spin flex-shrink-0"></div>
                            <span>Searching Confluence…</span>
                        </div>
                    </div>

                    <!-- Alert Payload (hidden by default) -->
                    <div id="payload-content" class="hidden flex-grow overflow-auto p-1">
                        ${(() => {
                            const labels      = inc.labels      || {};
                            const annotations = inc.annotations || {};
                            const renderKV = (obj) => {
                                const entries = Object.entries(obj);
                                if (entries.length === 0) return '<span class="text-muted italic text-xs">none</span>';
                                return entries.map(([k, v]) => `
                                    <div class="flex gap-3 py-1.5 border-b border-neutral-200 last:border-0 min-w-0">
                                        <span class="text-xs font-mono font-bold text-primary-600 shrink-0 w-40 truncate" title="${k}">${k}</span>
                                        <span class="text-xs break-all" style="color:#121212;">${v}</span>
                                    </div>`).join('');
                            };
                            return `
                                <div class="flex flex-col gap-5">
                                    <div>
                                        <div class="text-xs font-bold uppercase tracking-widest text-muted mb-2">Labels (${Object.keys(labels).length})</div>
                                        <div class="rounded p-4" style="background:#F2F2F2;">${renderKV(labels)}</div>
                                    </div>
                                    <div>
                                        <div class="text-xs font-bold uppercase tracking-widest text-muted mb-2">Annotations (${Object.keys(annotations).length})</div>
                                        <div class="rounded p-4" style="background:#F2F2F2;">${renderKV(annotations)}</div>
                                    </div>
                                    ${inc.alert_starts_at ? `
                                    <div>
                                        <div class="text-xs font-bold uppercase tracking-widest text-muted mb-2">Fire Time (Alertmanager)</div>
                                        <div class="rounded p-4" style="background:#F2F2F2;">
                                            <span class="text-xs font-mono" style="color:#121212;">${inc.alert_starts_at}</span>
                                        </div>
                                    </div>` : ''}
                                </div>`;
                        })()}
                    </div>
                </div>

                <!-- 3. Diagnostic Stream — intentionally always dark (terminal surface) -->
                <!-- #2 FIX: inline styles replace !bg-background-dark / !border-surface-hover-dark -->
                <div class="md:col-span-3 row-span-4 bento-card overflow-hidden flex flex-col" style="background:#0F1117; border-color:#1E2030;">
                    <div class="flex items-center justify-between mb-4 flex-shrink-0" style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.4);">
                        <span>Diagnostic Stream</span>
                        <span class="rounded-full ${!inc.telemetry_available ? 'bg-warning-500' : (inc.rca_completed ? 'bg-success-500' : 'bg-success-500 animate-ping')}" style="width:8px; height:8px; display:inline-block; flex-shrink:0;"></span>
                    </div>
                    <div class="flex-grow terminal overflow-x-hidden" style="background:transparent; border:none; box-shadow:none; color:#a5f3fc; padding:0;">
                        <div class="space-y-1">
                            <div style="color:rgba(255,255,255,0.25);">[00:00:01] PROBE: ${inc.labels?.instance || inc.labels?.cluster || inc.context || 'unknown'}</div>
                            <div style="color:rgba(255,255,255,0.25);">[00:00:02] CONTEXT: ${inc.context}</div>
                            ${inc.events.filter(e => e.source === 'Diagnostics').map(e => `
                                <div class="break-words">
                                    <span style="color:rgba(255,255,255,0.25);">[${new Date(e.timestamp).toLocaleTimeString()}]</span>
                                    ${e.description}
                                </div>`).join('')}
                            ${!inc.rca_completed ? '<div style="color:#346EEC;" class="animate-pulse">_</div>' : ''}
                        </div>
                    </div>
                </div>

                <!-- 4. Event Timeline -->
                <div class="md:col-span-3 row-span-4 bento-card">
                    <div class="text-xs font-bold text-muted uppercase tracking-widest mb-6">Event Timeline</div>
                    <div class="flex-grow overflow-auto relative pl-2">
                        <div class="absolute left-3 top-0 bottom-0 w-px bg-neutral-200"></div>
                        <div class="space-y-8 relative">
                            ${inc.events.map((e) => `
                                <div class="relative pl-8 group">
                                    <div class="absolute left-0 top-1.5 w-2 h-2 rounded-full border-2 group-hover:scale-125 transition-transform ${e.description.includes('CRITICAL') ? 'border-danger-500 bg-danger-50' : 'border-primary-600 bg-white'}"></div>
                                    <div class="text-xs font-bold text-muted mb-1">${new Date(e.timestamp).toLocaleTimeString()}</div>
                                    <div class="text-xs font-normal leading-normal ${e.description.includes('CRITICAL') ? 'text-danger-500 font-bold' : ''}">${e.description}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- 5. AI Suggested Remediation -->
                <!-- #1 FIX: accent-primary replaced with primary-600 tokens throughout -->
                <div class="md:col-span-9 row-span-2 bento-card border-t-4 ${inc.rca_completed ? 'border-t-primary-600' : 'border-t-neutral-200'} bg-primary-50">
                    <div class="flex flex-col gap-3 h-full">
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="text-xs font-bold text-primary-600 uppercase tracking-widest">AI Suggested Remediation</span>
                            ${inc.rca_completed ? '<span class="text-xs font-bold px-2 py-0.5 rounded" style="background:#D2E0FE; color:#134AC1;">Analysis Complete</span>' : ''}
                            ${!inc.telemetry_available ? '<span class="text-xs font-bold px-2 py-0.5 rounded" style="background:#FFF3DE; color:#A36701; border:1px solid #F7D8A3;">No Telemetry</span>' : ''}
                        </div>
                        ${inc.suggested_remediation
                            ? `<div class="flex-grow p-4 rounded overflow-auto" style="background:#FFFFFF; border:1px solid #B1CAFE;">
                                <p class="text-sm leading-relaxed" style="color:#121212;">${inc.suggested_remediation}</p>
                               </div>
                               <p class="text-xs text-muted italic flex-shrink-0">Suggestion only — all actions must be performed manually by an on-call engineer.</p>`
                            : (inc.rca_completed
                                ? `<p class="text-sm text-muted italic">No remediation suggestion generated. Review the AI RCA tab for details.</p>`
                                : `<div class="flex items-center gap-3 text-muted flex-grow">
                                    <div class="animate-spin h-4 w-4 rounded-full flex-shrink-0" style="border:2px solid #D2E0FE; border-top-color:#134AC1;"></div>
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
            btn.style.color = '#007B51';
            setTimeout(() => {
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                btn.style.color = '';
            }, 2000);
        };

        // Tabs — IQM Horizontal Tabs: Primary-600 active border, muted inactive
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

        // #1 FIX: border-primary-600 replaces border-accent-primary in activateTab
        function activateTab(btn, content) {
            allBtns.forEach(b => {
                b.classList.remove('border-primary-600', 'text-primary-600');
                b.classList.add('border-transparent', 'text-muted');
            });
            allContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('border-primary-600', 'text-primary-600');
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
                const res  = await apiFetch(`/runbooks/suggest?incident_id=${encodeURIComponent(inc.incident_id)}`);
                const data = await res.json();

                if (!data.configured) {
                    runbookInner.innerHTML = `
                        <div class="flex flex-col items-center gap-3 text-center p-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <p class="text-sm text-muted">Confluence not configured.</p>
                            <p class="text-xs text-muted">Add your Confluence details in <strong>Settings → Confluence Runbooks</strong>.</p>
                        </div>`;
                    return;
                }

                if (!data.found) {
                    runbookInner.innerHTML = `
                        <div class="flex flex-col items-center gap-3 text-center p-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <p class="text-sm text-muted">No runbook found for <strong style="color:#121212;">${data.alert_name}</strong>.</p>
                            <p class="text-xs text-muted">Consider creating a runbook in Confluence under the configured root page.</p>
                        </div>`;
                    return;
                }

                runbookInner.innerHTML = `
                    <div class="flex flex-col gap-3 p-4 h-full">
                        <div class="flex items-center justify-between flex-shrink-0 gap-3 flex-wrap">
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="p-1.5 rounded flex-shrink-0" style="background:#F2FAFF; color:#0874AA;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <span class="text-xs font-bold truncate" style="color:#0874AA;">${data.runbook_title}</span>
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                                ${data.runbook_id ? `
                                <button id="rb-view-full-btn" class="btn-outline flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                    View Full Runbook
                                </button>` : ''}
                                ${data.runbook_url ? `
                                <a href="${data.runbook_url}" target="_blank" rel="noopener noreferrer"
                                    class="flex items-center gap-1 text-xs font-bold text-muted hover:text-primary-600 transition-colors">
                                    Confluence
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>` : ''}
                            </div>
                        </div>
                        <div class="flex-grow overflow-auto rounded p-4" style="background:#F2F6FF; border:1px solid #D2E0FE;">
                            <p class="text-xs leading-relaxed whitespace-pre-wrap" style="color:#121212;">${data.suggestion}</p>
                        </div>
                        <p class="text-xs text-muted italic flex-shrink-0">
                            AI-grounded suggestion · all actions must be performed manually by the on-call engineer
                        </p>
                    </div>`;
                if (data.runbook_id) {
                    runbookInner.querySelector('#rb-view-full-btn').onclick = () =>
                        openRunbookModal(data.runbook_id, data.runbook_title, data.runbook_url);
                }
            } catch (e) {
                runbookInner.innerHTML = `<div class="text-danger-500 text-sm p-4">Failed to fetch runbook suggestion: ${e.message}</div>`;
            }
        };

    } catch (e) {
        clearTimeout(timeout);
        const msg = e.name === 'AbortError'
            ? 'Request timed out — the backend did not respond within 10s.'
            : (e.detail || 'Could not load this incident.');
        renderError(container, msg, () => renderControlRoomView(container));
    }
}
