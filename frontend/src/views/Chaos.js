/**
 * CHAOS ENGINEERING CONTROL
 */
import { state, updateState } from '../utils/state';
import { API_BASE, updateHealth } from '../utils/api';

export async function renderChaosView(container) {
    const res = await fetch(`${API_BASE}/chaos/scenarios`);
    const scenarios = await res.json();
    updateState({ chaosScenarios: scenarios });

    container.innerHTML = `
        <div class="flex flex-col gap-10 h-full max-w-6xl mx-auto py-10 px-4">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-surface-hover-light dark:border-surface-hover-dark pb-10">
                <div class="max-w-2xl">
                    <h2 class="text-4xl font-heading font-bold text-primary-light dark:text-primary-dark mb-4 tracking-tight">Simulation Control</h2>
                    <p class="text-muted text-base leading-relaxed font-medium">Inject controlled failures into the cluster to verify pipeline resilience. Ensure emergency bypasses are clear before triggering destructive scenarios.</p>
                </div>
                ${state.isSimulationMode ? `
                    <button id="abort-all-btn" class="px-8 h-12 bg-alert-orange hover:bg-red-600 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-alert-orange/20 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                        Global Restoration
                    </button>
                ` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${scenarios.map(s => `
                    <div class="pane p-8 flex flex-col justify-between group transition-all duration-500 relative overflow-hidden ${s.is_active ? 'border-alert-orange shadow-2xl shadow-alert-orange/10 bg-alert-orange/5' : 'hover:border-primary-light dark:hover:border-primary-dark hover:shadow-xl hover:shadow-primary-light/5'}">
                        ${s.is_active ? `<div class="absolute top-0 right-0 p-1 bg-alert-orange text-[8px] font-black text-white px-3 tracking-widest animate-pulse">ACTIVE</div>` : ''}
                        <div>
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="font-bold text-xl ${s.is_active ? 'text-alert-orange' : 'text-text-light dark:text-text-dark'}">${s.name}</h3>
                            </div>
                            <p class="text-sm text-muted mb-10 leading-relaxed font-medium">${s.description}</p>
                        </div>
                        <button class="chaos-toggle-btn w-full h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all duration-300
                            ${s.is_active ? 'bg-alert-orange text-white hover:bg-red-600 shadow-lg shadow-alert-orange/20' : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-light dark:text-text-dark hover:bg-primary-light hover:text-white dark:hover:bg-primary-dark shadow-sm'}
                        " data-id="${s.id}" data-active="${s.is_active}">
                            ${s.is_active ? 'Abort Simulation' : 'Trigger Scenario'}
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="mt-20 border-t border-surface-hover-light dark:border-surface-hover-dark pt-10">
                <h3 class="text-2xl font-bold text-text-light dark:text-text-dark mb-2 tracking-tight">Manual Alert Injection</h3>
                <p class="text-muted text-sm mb-8 font-medium">Simulate incoming webhooks from external monitoring sources (Alertmanager, Prometheus) to verify RCA pipelines.</p>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="pane p-6 bg-surface-light/30 dark:bg-surface-dark/30 border-dashed">
                        <h4 class="font-bold mb-2">💻 Local Machine</h4>
                        <p class="text-xs text-muted mb-6">Tests diagnostics on the local host (psutil provider).</p>
                        <button class="fire-test-btn w-full h-10 bg-primary-light dark:bg-primary-dark text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform" data-type="local">Fire Local Alert</button>
                    </div>
                    <div class="pane p-6 bg-surface-light/30 dark:bg-surface-dark/30 border-dashed">
                        <h4 class="font-bold mb-2">🖥️ Virtual Machine</h4>
                        <p class="text-xs text-muted mb-6">Tests Prometheus VM metrics collection logic.</p>
                        <button class="fire-test-btn w-full h-10 bg-primary-light dark:bg-primary-dark text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform" data-type="vm">Fire VM Alert</button>
                    </div>
                    <div class="pane p-6 bg-surface-light/30 dark:bg-surface-dark/30 border-dashed">
                        <h4 class="font-bold mb-2">☸️ Kubernetes</h4>
                        <p class="text-xs text-muted mb-6">Tests Pod logs, events, and K8s provider state.</p>
                        <button class="fire-test-btn w-full h-10 bg-primary-light dark:bg-primary-dark text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform" data-type="k8s">Fire K8s Alert</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.querySelectorAll('.fire-test-btn').forEach(btn => {
        btn.onclick = async () => {
            const type = btn.dataset.type;
            let payload = {};
            
            if (type === 'local') {
                payload = {
                    alertname: 'LocalDiskFull',
                    instance: 'local',
                    severity: 'critical',
                    description: 'Simulated Disk pressure on root partition'
                };
            } else if (type === 'vm') {
                payload = {
                    alertname: 'HighCPUUsage',
                    instance: 'vm-test-01',
                    severity: 'warning',
                    description: 'Simulated high CPU load on Virtual Machine'
                };
            } else if (type === 'k8s') {
                payload = {
                    alertname: 'PodCrashLooping',
                    namespace: 'default',
                    pod: 'web-api-pod-xyz',
                    severity: 'critical',
                    description: 'Simulated crashloop event for K8s pod'
                };
            }
            
            const btnText = btn.innerText;
            btn.innerText = 'FIRING...';
            btn.disabled = true;
            
            try {
                const { triggerAlert } = await import('../utils/api');
                await triggerAlert(payload);
                notify(`Test alert fired: ${payload.alertname}`, 'success');
            } catch (e) {
                notify('Failed to fire test alert', 'error');
            } finally {
                setTimeout(() => {
                    btn.innerText = btnText;
                    btn.disabled = false;
                }, 1000);
            }
        };
    });

    // Existing Chaos logic
    container.querySelectorAll('.chaos-toggle-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const active = btn.dataset.active === 'true';
            
            await fetch(`${API_BASE}/chaos/trigger`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id, active: !active })
            });
            
            renderChaosView(container);
            updateHealth();
        };
    });

    const abort = container.querySelector('#abort-all-btn');
    if (abort) {
        abort.onclick = async () => {
            for (const s of scenarios.filter(sc => sc.is_active)) {
                await fetch(`${API_BASE}/chaos/trigger`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id: s.id, active: false })
                });
            }
            renderChaosView(container);
            updateHealth();
        };
    }
}
