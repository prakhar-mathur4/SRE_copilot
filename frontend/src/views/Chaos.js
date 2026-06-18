/**
 * CHAOS ENGINEERING CONTROL
 */
import { state, updateState } from '../utils/state';
import { apiFetch, apiJson, updateHealth } from '../utils/api';
import { renderError } from '../utils/ui';

export async function renderChaosView(container) {
    let scenarios;
    try {
        scenarios = await apiJson(`/chaos/scenarios`, {}, { silent: true });
    } catch (e) {
        renderError(container, e.detail || 'Could not load chaos scenarios.', () => renderChaosView(container));
        return;
    }
    updateState({ chaosScenarios: scenarios });

    container.innerHTML = `
        <div class="flex flex-col gap-6 h-full max-w-6xl mx-auto px-4">
            ${state.isSimulationMode ? `
            <div class="flex justify-end">
                <button id="abort-all-btn" class="btn-primary flex items-center gap-2" style="background:#A36701;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                    Global Restoration
                </button>
            </div>` : ''}

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${scenarios.map(s => `
                    <div class="pane p-8 flex flex-col justify-between group transition-all duration-500 relative overflow-hidden ${s.is_active ? 'border-warning-500 bg-warning-50' : 'hover:border-primary-600'}">
                        ${s.is_active ? `<div class="absolute top-0 right-0 p-1 bg-warning-500 text-[11px] font-bold text-white px-3 tracking-widest animate-pulse">ACTIVE</div>` : ''}
                        <div>
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="font-bold text-xl ${s.is_active ? 'text-warning-500' : 'text-text-light'}">${s.name}</h3>
                            </div>
                            <p class="text-sm text-muted mb-10 leading-relaxed font-medium">${s.description}</p>
                        </div>
                        <button class="chaos-toggle-btn w-full h-12 rounded font-bold text-xs transition-all duration-300
                            ${s.is_active ? 'bg-warning-500 text-white hover:bg-warning-700' : 'bg-neutral-100 text-text-light hover:bg-primary-600 hover:text-white'}
                        " data-id="${s.id}" data-active="${s.is_active}">
                            ${s.is_active ? 'Abort Simulation' : 'Trigger Scenario'}
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="mt-20 border-t border-neutral-200 pt-10">
                <h3 class="text-2xl font-bold text-text-light mb-2 tracking-tight">Manual Alert Injection</h3>
                <p class="text-muted text-sm mb-8 font-medium">Simulate incoming webhooks from external monitoring sources (Alertmanager, Prometheus) to verify RCA pipelines.</p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="pane p-6 bg-neutral-75 border-dashed">
                        <h4 class="font-bold mb-2">💻 Local Machine</h4>
                        <p class="text-xs text-muted mb-6">Tests diagnostics on the local host (psutil provider).</p>
                        <button class="fire-test-btn btn-primary w-full" data-type="local">Fire Local Alert</button>
                    </div>
                    <div class="pane p-6 bg-neutral-75 border-dashed">
                        <h4 class="font-bold mb-2">🖥️ Virtual Machine</h4>
                        <p class="text-xs text-muted mb-6">Tests Prometheus VM metrics collection logic.</p>
                        <button class="fire-test-btn btn-primary w-full" data-type="vm">Fire VM Alert</button>
                    </div>
                    <div class="pane p-6 bg-neutral-75 border-dashed">
                        <h4 class="font-bold mb-2">☸️ Kubernetes</h4>
                        <p class="text-xs text-muted mb-6">Tests Pod logs, events, and K8s provider state.</p>
                        <button class="fire-test-btn btn-primary w-full" data-type="k8s">Fire K8s Alert</button>
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

    // Chaos toggle logic
    container.querySelectorAll('.chaos-toggle-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const active = btn.dataset.active === 'true';

            await apiFetch(`/chaos/trigger`, {
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
                await apiFetch(`/chaos/trigger`, {
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
