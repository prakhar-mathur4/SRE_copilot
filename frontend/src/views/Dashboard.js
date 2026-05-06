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

    // Silent Killers — incidents with highest dedup_count (most re-fired)
    const silentKillers = [...allInc]
        .filter(i => (i.dedup_count || 0) > 0)
        .sort((a, b) => (b.dedup_count || 0) - (a.dedup_count || 0))
        .slice(0, 5);

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
                        <div class="text-3xl font-heading font-black text-text-light dark:text-text-dark">${noiseStats.received_last_24h ?? 0}</div>
                        <div class="text-[9px] text-muted mt-2 font-mono">${noiseStats.total_dropped ?? 0} suppressed &nbsp;·&nbsp; ${(noiseStats.received_last_24h ?? 0) - Math.min(noiseStats.total_dropped ?? 0, noiseStats.received_last_24h ?? 0)} processed</div>
                    </div>

                    <!-- KPI 2: Active Critical -->
                    <div class="pane p-5 relative overflow-hidden group border-l-2 border-l-red-500/50">
                        <div class="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            Active Critical
                        </div>
                        <div class="text-3xl font-heading font-black text-red-400">${critCount}</div>
                        <div class="text-[9px] text-muted mt-2 font-mono">critical &amp; page severity</div>
                    </div>

                    <!-- KPI 3: Active Warning -->
                    <div class="pane p-5 relative overflow-hidden group border-l-2 border-l-yellow-500/50">
                        <div class="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
                            Active Warning
                        </div>
                        <div class="text-3xl font-heading font-black text-yellow-400">${warnCount}</div>
                        <div class="text-[9px] text-muted mt-2 font-mono">warning severity</div>
                    </div>

                    <!-- KPI 4: Active Info / Other -->
                    <div class="pane p-5 relative overflow-hidden group border-l-2 border-l-blue-500/50">
                        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                            Active Info
                        </div>
                        <div class="text-3xl font-heading font-black text-blue-400">${infoCount}</div>
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
                                    <div class="flex justify-between items-center mb-6">
                                        <div class="flex items-center gap-3">
                                            <div class="p-2 rounded-lg bg-surface-light dark:bg-surface-dark border border-surface-hover-light dark:border-surface-hover-dark">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${env.status === 'healthy' || env.status === 'online' ? 'text-alert-green' : 'text-alert-red'}">
                                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                                                    <line x1="6" y1="6" x2="6.01" y2="6"></line>
                                                    <line x1="6" y1="18" x2="6.01" y2="18"></line>
                                                </svg>
                                            </div>
                                            <div>
                                                <div class="font-bold text-sm leading-tight">${env.name}</div>
                                                <div class="text-[9px] font-mono text-muted uppercase tracking-wider">${env.status}</div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div id="cpu-text-${env.id}" class="text-[10px] font-bold text-primary-light">CPU: ${env.cpu_usage ?? 0}%</div>
                                            <div id="mem-text-${env.id}" class="text-[10px] font-bold text-purple-500">MEM: ${env.memory_usage ?? 0}%</div>
                                        </div>
                                    </div>
                                    <div id="timeseries-container-${env.id}" class="mt-4 min-h-[60px]">
                                        <!-- Initial loading state -->
                                        <div class="text-center p-6 border border-dashed border-surface-hover-light dark:border-surface-hover-dark rounded-lg">
                                            <div class="w-4 h-4 rounded-full border-2 border-primary-light border-t-transparent animate-spin mx-auto mb-2"></div>
                                            <div class="text-[9px] text-muted uppercase tracking-widest font-bold">Querying Telemetry History...</div>
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
                <div class="pane flex flex-col h-[60%]">
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

                <div class="pane flex flex-col h-[40%]">
                    <div class="pane-header text-alert-red flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Storm Radar — Most Suppressed
                    </div>
                    <div class="p-4 overflow-y-auto flex-grow">
                        ${silentKillers.length === 0
                            ? `<div class="text-[10px] text-muted italic text-center mt-4">No storm protection hits yet.</div>`
                            : `<div class="flex flex-col gap-3">
                                ${silentKillers.map(i => `
                                    <div class="flex justify-between items-center text-[10px]">
                                        <div class="flex items-center gap-2 min-w-0">
                                            <span class="w-1.5 h-1.5 rounded-full bg-alert-orange shrink-0"></span>
                                            <span class="font-bold font-mono truncate">${i.alert_name}</span>
                                        </div>
                                        <span class="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full text-[9px] font-bold shrink-0 ml-2">${i.dedup_count}x</span>
                                    </div>`).join('')}
                               </div>`
                        }
                    </div>
                </div>
            </div>
        </div>
    `;

    // Fetch and render historical time series graphs without destroying the DOM on updates
    import('../utils/api.js').then(({ fetchTimeSeries }) => {
        import('../utils/state.js').then(({ subscribe, state: currentState }) => {
            
            const refreshGraphs = async (currentEnvs) => {
                for (const env of currentEnvs) {
                    const containerEl = document.getElementById(`timeseries-container-${env.id}`);
                    if (!containerEl) continue;

                    // Update live CPU/MEM text blocks immediately
                    const cpuText = document.getElementById(`cpu-text-${env.id}`);
                    const memText = document.getElementById(`mem-text-${env.id}`);
                    if (cpuText) cpuText.textContent = `CPU: ${env.cpu_usage ?? 0}%`;
                    if (memText) memText.textContent = `MEM: ${env.memory_usage ?? 0}%`;

                    // Skip fetch if completely offline
                    if (env.status === 'offline') {
                        containerEl.innerHTML = `<div class="text-[9px] text-muted italic text-center p-4">Environment offline. Historical telemetry unavailable.</div>`;
                        continue;
                    }

                    const data = await fetchTimeSeries(env.id);

                    if (data.error) {
                        containerEl.innerHTML = `
                            <div class="p-4 mt-2 rounded-lg bg-alert-orange/5 border border-alert-orange/20 text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-alert-orange mx-auto mb-2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                <div class="text-[9px] text-alert-orange font-mono leading-tight px-4">${data.error}</div>
                            </div>
                        `;
                        continue;
                    }

                    const drawGraph = (label, colorHex, points) => {
                        if (!points || points.length === 0) {
                            return `
                                <div>
                                    <div class="text-[9px] text-muted uppercase font-bold tracking-widest mb-1">${label}</div>
                                    <div class="h-12 flex items-center justify-center border-b border-surface-hover-light dark:border-surface-hover-dark text-[9px] text-muted italic">Waiting for initial telemetry window...</div>
                                </div>
                            `;
                        }
                        
                        const step = 110 / Math.max(1, points.length - 1);
                        const svgPoints = points.map((p, i) => `${i * step},${40 - (p[1]/100)*35}`).join(' ');
                        const currentValue = points[points.length-1][1];

                        return `
                            <div>
                                <div class="text-[9px] text-muted uppercase font-bold tracking-widest mb-1 flex justify-between">
                                    <span>${label}</span>
                                    <span class="text-text-light dark:text-text-dark">${currentValue}%</span>
                                </div>
                                <svg viewBox="0 -5 110 45" class="w-full h-12 overflow-visible">
                                    <polyline points="${svgPoints}" fill="none" stroke="${colorHex}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                    <path d="M0,40 L${svgPoints} L110,40 Z" fill="${colorHex}" opacity="0.1" />
                                </svg>
                            </div>
                        `;
                    };

                    containerEl.innerHTML = `
                        <div class="grid grid-cols-2 gap-4 mt-4">
                            ${drawGraph('CPU History', '#6366f1', data.cpu)}
                            ${drawGraph('Memory History', '#8b5cf6', data.memory)}
                        </div>
                    `;
                }
            };

            // Initial render
            refreshGraphs(currentState.environments);

            // Subscribe to background refreshes (triggered by main.js every 5s)
            const unsub = subscribe((newState) => {
                if (newState.view !== 'dashboard') {
                    unsub();
                    return;
                }
                refreshGraphs(newState.environments);

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

