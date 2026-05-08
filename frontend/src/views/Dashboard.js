import { state } from '../utils/state';
import { fetchNoiseStats } from '../utils/api';

export async function renderDashboardView(container) {
    const envs = state.environments || [];

    // Fetch real noise stats
    let noiseStats = { noise_reduction_pct: 0, total_received: 0, total_dropped: 0, dedup_details: [] };
    try { noiseStats = await fetchNoiseStats(); } catch (_) {}

    // Compute real KPIs from state.incidents
    const allInc    = state.incidents || [];
    const activeInc = allInc.filter(i => i.status !== 'resolved');

    // Active alerts by severity (critical+page / warning / everything else)
    const critCount = activeInc.filter(i => ['critical','page'].includes((i.severity||'').toLowerCase())).length;
    const warnCount = activeInc.filter(i => (i.severity||'').toLowerCase() === 'warning').length;
    const infoCount = activeInc.filter(i => !['critical','page','warning'].includes((i.severity||'').toLowerCase())).length;

    container.innerHTML = `
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full min-h-0 overflow-y-auto pb-10">
            
            <!-- Left Column: KPIs & Fleet Matrix -->
            <div class="xl:col-span-9 flex flex-col gap-6">
                
                <!-- KPI Top Bar -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">

                    <!-- KPI 1: Total alerts last 24h -->
                    <div class="pane p-5 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-primary-light/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-light"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            Alerts (Last 24h)
                        </div>
                        <div class="text-3xl font-heading font-black text-text-light dark:text-text-dark" id="kpi-24h">${noiseStats.received_last_24h ?? 0}</div>
                        <div class="text-[9px] text-muted mt-2 font-mono">${noiseStats.dropped_last_24h ?? 0} suppressed &nbsp;·&nbsp; ${noiseStats.processed_last_24h ?? 0} processed</div>
                    </div>

                    <!-- KPI 2: Active Critical -->
                    <div class="pane p-5 relative overflow-hidden group border-l-2 border-l-red-500/50">
                        <div class="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            Active Critical
                        </div>
                        <div class="text-3xl font-heading font-black text-red-400" id="kpi-crit">${critCount}</div>
                        <div class="text-[9px] text-muted mt-2 font-mono">critical &amp; page severity</div>
                    </div>

                    <!-- KPI 3: Active Warning -->
                    <div class="pane p-5 relative overflow-hidden group border-l-2 border-l-yellow-500/50">
                        <div class="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
                            Active Warning
                        </div>
                        <div class="text-3xl font-heading font-black text-yellow-400" id="kpi-warn">${warnCount}</div>
                        <div class="text-[9px] text-muted mt-2 font-mono">warning severity</div>
                    </div>

                    <!-- KPI 4: Active Info / Other -->
                    <div class="pane p-5 relative overflow-hidden group border-l-2 border-l-blue-500/50">
                        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                            Active Info
                        </div>
                        <div class="text-3xl font-heading font-black text-blue-400" id="kpi-info">${infoCount}</div>
                        <div class="text-[9px] text-muted mt-2 font-mono">info &amp; other severity</div>
                    </div>

                </div>

                <!-- Main Grid: Fleet Health Matrix -->
                <div class="pane flex flex-col flex-grow min-h-[500px]">
                    <div class="pane-header flex justify-between items-center">
                        <span>Fleet Telemetry Matrix (Golden Signals)</span>
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-alert-green animate-pulse"></span>
                            <span class="text-[9px] text-alert-green uppercase tracking-widest font-bold">Live</span>
                        </div>
                    </div>
                    <div class="p-6 overflow-y-auto">
                        ${envs.length === 0 ? `<div class="text-center p-10 text-muted-light italic text-xs">No infrastructure registered. Go to Settings to add connectors.</div>` : ''}
                        
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            ${envs.map(env => `
                                <div class="p-5 rounded-xl border border-surface-hover-light dark:border-surface-hover-dark bg-surface-hover-light/10 dark:bg-surface-hover-dark/10 hover:border-primary-light/30 transition-all group">
                                    <div class="flex items-center gap-3 mb-5 min-w-0">
                                            <div class="p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${env.status === 'healthy' || env.status === 'online' ? 'text-alert-green' : 'text-alert-red'}">
                                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                                    <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                                    <line x1="6" y1="18" x2="6.01" y2="18"></line>
                                                </svg>
                                            </div>
                                            <div class="min-w-0">
                                                <div class="font-bold text-sm leading-tight break-words">${env.name}</div>
                                                <div class="text-[9px] font-mono text-muted uppercase tracking-wider">${env.status}</div>
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-2 gap-3">
                                            <div class="p-4 rounded-xl bg-surface-hover-dark/40 border border-surface-hover-dark text-center overflow-hidden">
                                                <div class="text-[9px] text-muted uppercase font-bold tracking-widest mb-2">CPU</div>
                                                <div id="cpu-val-${env.id}" class="text-2xl font-heading font-black text-primary-dark leading-none">—</div>
                                                <div class="text-[9px] text-muted mt-1">utilization</div>
                                            </div>
                                            <div class="p-4 rounded-xl bg-surface-hover-dark/40 border border-surface-hover-dark text-center overflow-hidden">
                                                <div class="text-[9px] text-muted uppercase font-bold tracking-widest mb-2">Memory</div>
                                                <div id="mem-val-${env.id}" class="text-2xl font-heading font-black text-purple-400 leading-none">—</div>
                                                <div class="text-[9px] text-muted mt-1">utilization</div>
                                            </div>
                                        </div>

                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Activity Feed & Storm Radar -->
            <div class="xl:col-span-3 flex flex-col gap-6">
                <div class="pane flex flex-col flex-grow">
                    <div class="pane-header flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-light"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                        Live Activity Feed
                    </div>
                    <div class="p-4 flex-grow overflow-y-auto flex flex-col gap-2" id="dashboard-activity-feed">
                        ${state.activityLog.length === 0
                            ? `<div class="text-[10px] text-muted italic text-center mt-6">Waiting for events...</div>`
                            : state.activityLog.map(e => `
                                <div class="flex gap-2 text-[10px] font-mono">
                                    <span class="text-primary-light shrink-0">[${e.ts}]</span>
                                    <span class="${e.color}">${e.msg}</span>
                                </div>`).join('')
                        }
                    </div>
                </div>

            </div>
        </div>
    `;

    // Fetch current CPU/Memory % for each connector and update cards
    import('../utils/api.js').then(({ fetchTimeSeries }) => {
        import('../utils/state.js').then(({ subscribe, state: currentState }) => {

            const refreshGraphs = async (currentEnvs) => {
                for (const env of currentEnvs) {
                    const cpuEl = document.getElementById(`cpu-val-${env.id}`);
                    const memEl = document.getElementById(`mem-val-${env.id}`);
                    if (!cpuEl || !memEl) continue;

                    if (env.status === 'offline') {
                        cpuEl.textContent = 'N/A';
                        memEl.textContent = 'N/A';
                        continue;
                    }

                    const data = await fetchTimeSeries(env.id);
                    if (data.error) continue;

                    const lastCpu = data.cpu?.length ? data.cpu[data.cpu.length - 1][1] : null;
                    const lastMem = data.memory?.length ? data.memory[data.memory.length - 1][1] : null;

                    if (cpuEl) cpuEl.textContent = lastCpu !== null ? `${parseFloat(lastCpu).toFixed(1)}%` : '—';
                    if (memEl) memEl.textContent = lastMem !== null ? `${parseFloat(lastMem).toFixed(1)}%` : '—';

                    // Color CPU red if above 80%
                    if (cpuEl && lastCpu !== null) {
                        cpuEl.className = `text-3xl font-heading font-black ${lastCpu >= 80 ? 'text-alert-red' : lastCpu >= 60 ? 'text-alert-orange' : 'text-primary-dark'}`;
                    }
                    // Color memory red if above 85%
                    if (memEl && lastMem !== null) {
                        memEl.className = `text-3xl font-heading font-black ${lastMem >= 85 ? 'text-alert-red' : lastMem >= 70 ? 'text-alert-orange' : 'text-purple-400'}`;
                    }
                }
            };

            // Initial render
            refreshGraphs(currentState.environments);

            // Patch KPI count elements from latest incident state
            function patchKpis(incidents) {
                const active = (incidents || []).filter(i => i.status !== 'resolved');
                const crit = active.filter(i => ['critical','page'].includes((i.severity||'').toLowerCase())).length;
                const warn = active.filter(i => (i.severity||'').toLowerCase() === 'warning').length;
                const info = active.filter(i => !['critical','page','warning'].includes((i.severity||'').toLowerCase())).length;
                const critEl = document.getElementById('kpi-crit');
                const warnEl = document.getElementById('kpi-warn');
                const infoEl = document.getElementById('kpi-info');
                if (critEl) critEl.textContent = crit;
                if (warnEl) warnEl.textContent = warn;
                if (infoEl) infoEl.textContent = info;
            }

            // Refresh "Alerts Last 24h" KPI from API every 60s
            const noiseRefreshInterval = setInterval(async () => {
                if (state.view !== 'dashboard') { clearInterval(noiseRefreshInterval); return; }
                try {
                    const fresh = await fetchNoiseStats();
                    const el24h = document.getElementById('kpi-24h');
                    if (el24h) el24h.textContent = fresh.received_last_24h ?? 0;
                } catch (_) {}
            }, 60000);

            // Subscribe to background refreshes (triggered by main.js every 5s)
            const unsub = subscribe((newState) => {
                if (newState.view !== 'dashboard') {
                    clearInterval(noiseRefreshInterval);
                    unsub();
                    return;
                }
                refreshGraphs(newState.environments);

                // Live-patch KPI severity counts
                patchKpis(newState.incidents);

                // Live-patch the activity feed without re-rendering the page
                const feedEl = document.getElementById('dashboard-activity-feed');
                if (feedEl && newState.activityLog?.length > 0) {
                    feedEl.innerHTML = newState.activityLog.map(e => `
                        <div class="flex gap-2 text-[10px] font-mono">
                            <span class="text-primary-light shrink-0">[${e.ts}]</span>
                            <span class="${e.color}">${e.msg}</span>
                        </div>`).join('');
                }
            });

        });
    });
}

