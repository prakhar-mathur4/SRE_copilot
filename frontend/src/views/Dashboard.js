import { state } from '../utils/state';

export function renderDashboardView(container) {
    const envs = state.environments || [];

    // Helper for dummy sparklines
    const generateSparkline = (colorClass) => {
        const points = Array.from({length: 12}, () => Math.floor(Math.random() * 40) + 10);
        const max = Math.max(...points) || 1;
        const svgPoints = points.map((p, i) => `${i * 10},${40 - (p/max)*30}`).join(' ');
        
        // Map tailwind class to generic hex for SVG stroke (simplified)
        let hex = '#6366f1'; // Primary default
        if (colorClass.includes('green')) hex = '#10b981';
        if (colorClass.includes('orange')) hex = '#f59e0b';
        if (colorClass.includes('red')) hex = '#ef4444';
        if (colorClass.includes('purple')) hex = '#8b5cf6';

        return `<svg viewBox="0 0 110 40" class="w-full h-8 overflow-visible">
            <polyline points="${svgPoints}" fill="none" stroke="${hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M0,40 L${svgPoints} L110,40 Z" fill="${hex}" opacity="0.1" />
        </svg>`;
    };

    container.innerHTML = `
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full min-h-0 overflow-y-auto pb-10">
            
            <!-- Left Column: KPIs & Fleet Matrix -->
            <div class="xl:col-span-9 flex flex-col gap-6">
                
                <!-- KPI Top Bar -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="pane p-5 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-primary-light/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-light"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            Noise Reduction
                        </div>
                        <div class="text-3xl font-heading font-black text-text-light dark:text-text-dark">98.2<span class="text-lg text-primary-light">%</span></div>
                        <div class="text-[9px] text-muted mt-2 font-mono">1,432 alerts -> 12 incidents</div>
                    </div>
                    
                    <div class="pane p-5 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                            AI Tokens Used
                        </div>
                        <div class="text-3xl font-heading font-black text-text-light dark:text-text-dark">14.2<span class="text-lg text-purple-500">k</span></div>
                        <div class="text-[9px] text-muted mt-2 font-mono">~$0.42 spent today</div>
                    </div>

                    <div class="pane p-5 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-alert-green"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                            MTTR Trend
                        </div>
                        <div class="text-3xl font-heading font-black text-text-light dark:text-text-dark">12<span class="text-lg text-alert-green">m</span></div>
                        <div class="text-[9px] text-alert-green mt-2 font-mono flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                            34% faster this week
                        </div>
                    </div>

                    <div class="pane p-5 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="text-[10px] uppercase font-bold text-muted tracking-widest mb-2 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Auto-Mitigated
                        </div>
                        <div class="text-3xl font-heading font-black text-text-light dark:text-text-dark">89<span class="text-lg text-blue-500">%</span></div>
                        <div class="text-[9px] text-muted mt-2 font-mono">Runbooks applied automatically</div>
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

            <!-- Right Column: AI Ticker & Radar -->
            <div class="xl:col-span-3 flex flex-col gap-6">
                <!-- Keep the AI ticker and radar identical -->
                <div class="pane flex flex-col h-[60%]">
                    <div class="pane-header flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-light"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                        AI Activity Feed
                    </div>
                    <div class="p-4 flex-grow overflow-hidden relative">
                        <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-light dark:to-surface-dark z-10 pointer-events-none"></div>
                        <div class="flex flex-col gap-3 text-[10px] font-mono absolute bottom-4 left-4 right-4 animate-[scroll-up_20s_linear_infinite]">
                            <div class="text-muted"><span class="text-primary-light">[14:02:11]</span> Evaluated alert 'HighMemoryUsage' -> Ignored (Threshold match)</div>
                            <div class="text-muted"><span class="text-primary-light">[14:05:32]</span> Deduplicated 4 similar network latency events from Minikube.</div>
                            <div class="text-muted"><span class="text-primary-light">[14:12:05]</span> Fetched diagnostics for auth-service (Pod Restarting).</div>
                            <div class="text-alert-green"><span class="text-primary-light">[14:12:09]</span> RCA Generation Complete (ID: a7f89b). Mitigation proposed.</div>
                            <div class="text-muted"><span class="text-primary-light">[14:18:44]</span> Cleaned up 12 stale incidents from ledger.</div>
                            <div class="text-muted"><span class="text-primary-light">[14:22:10]</span> Connectivity probe succeeded for Prom-VM-01.</div>
                            <div class="text-blue-500"><span class="text-primary-light">[14:30:00]</span> Runbook 'Restart Deployment' executed automatically.</div>
                            <div class="text-muted"><span class="text-primary-light">[14:35:12]</span> Evaluated alert 'CPUThrottlingHigh' -> Suppressed by rules engine.</div>
                        </div>
                    </div>
                </div>

                <div class="pane flex flex-col h-[40%]">
                    <div class="pane-header text-alert-red flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Silent Killers Radar
                    </div>
                    <div class="p-4 overflow-y-auto">
                        <div class="flex flex-col gap-3">
                            <div class="flex justify-between items-center text-[10px]">
                                <div class="flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-alert-orange"></span>
                                    <span class="font-bold font-mono">checkout-service-pod</span>
                                </div>
                                <span class="text-muted">4 OOMKills</span>
                            </div>
                            <div class="flex justify-between items-center text-[10px]">
                                <div class="flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-alert-orange"></span>
                                    <span class="font-bold font-mono">postgres-vm-01</span>
                                </div>
                                <span class="text-muted">High I/O Wait</span>
                            </div>
                            <div class="flex justify-between items-center text-[10px]">
                                <div class="flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-alert-orange"></span>
                                    <span class="font-bold font-mono">frontend-deployment</span>
                                </div>
                                <span class="text-muted">CPU Throttling</span>
                            </div>
                        </div>
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
                    unsub(); // Cleanup subscription when navigating away
                    return;
                }
                refreshGraphs(newState.environments);
            });

        });
    });
}

