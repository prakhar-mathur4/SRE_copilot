/**
 * HEADER — IQM Design
 */
import { state } from '../utils/state';
import { triggerAlert, logout } from '../utils/api';

export function renderHeader() {
    const header = document.querySelector('header');
    if (!header) return;

    const wsStyle = state.wsConnected
        ? 'background:#007B51; box-shadow:0 0 0 3px rgba(0,123,81,0.15);'
        : 'background:#CC0909; box-shadow:0 0 0 3px rgba(204,9,9,0.15);';

    header.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
            <h1 style="font-size:15px; font-weight:600; color:#121212; display:flex; align-items:center; gap:10px; margin:0;">
                <span id="view-title">${getViewTitle(state.view)}</span>
                <span id="connection-status" style="width:8px; height:8px; border-radius:50%; flex-shrink:0; ${wsStyle}"></span>
            </h1>
            ${state.isSimulationMode ? `
                <div id="simulation-warning" style="background:#FFF3DE; color:#A36701; border:1px solid #F7D8A3; font-size:11px; font-weight:600; padding:3px 10px; border-radius:4px; letter-spacing:0.04em;">
                    ⚠ Simulation Mode
                </div>
            ` : ''}
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
            <button id="fire-test-btn" style="height:34px; padding:0 12px; border:1px solid #E6E6E6; border-radius:2px; font-size:13px; font-weight:600; color:#4D4D4D; background:transparent; cursor:pointer; font-family:inherit; transition:background 200ms, border-color 200ms;"
                onmouseenter="this.style.background='#F2F2F2'; this.style.borderColor='#CCCCCC';"
                onmouseleave="this.style.background='transparent'; this.style.borderColor='#E6E6E6';">
                Fire Alert
            </button>

            <div style="display:flex; align-items:center; gap:4px;">
                <button id="manual-refresh-btn" title="Refresh now" style="display:flex; align-items:center; justify-content:center; width:34px; height:34px; border:1px solid #E6E6E6; border-radius:2px; background:transparent; cursor:pointer; color:#666666; transition:background 200ms, border-color 200ms;"
                    onmouseenter="this.style.background='#F2F2F2'; this.style.borderColor='#CCCCCC';"
                    onmouseleave="this.style.background='transparent'; this.style.borderColor='#E6E6E6';">
                    <svg id="refresh-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                </button>
                <span id="refresh-countdown" style="font-size:11px; color:#999999; width:22px; text-align:center; font-variant-numeric:tabular-nums;">5s</span>
            </div>

            ${state.currentUser ? `
                <div style="width:1px; height:20px; background:#E6E6E6; margin:0 4px;"></div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="display:flex; flex-direction:column; line-height:1.15; text-align:right;">
                        <span style="font-size:12px; font-weight:600; color:#121212;">${state.currentUser.username}</span>
                        <span style="font-size:10px; color:#999999; text-transform:capitalize;">${state.currentUser.role}</span>
                    </div>
                    <button id="logout-btn" title="Sign out" style="display:flex; align-items:center; justify-content:center; width:34px; height:34px; border:1px solid #E6E6E6; border-radius:2px; background:transparent; cursor:pointer; color:#666666; transition:background 200ms, border-color 200ms, color 200ms;"
                        onmouseenter="this.style.background='#FFF2F2'; this.style.borderColor='#F29696'; this.style.color='#CC0909';"
                        onmouseleave="this.style.background='transparent'; this.style.borderColor='#E6E6E6'; this.style.color='#666666';">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    const testBtn = header.querySelector('#fire-test-btn');
    if (testBtn) testBtn.onclick = () => showDiagnosticModal();

    const logoutBtn = header.querySelector('#logout-btn');
    if (logoutBtn) logoutBtn.onclick = async () => {
        await logout();
        window.location.reload();
    };

    const refreshBtn = header.querySelector('#manual-refresh-btn');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            document.dispatchEvent(new CustomEvent('manual-refresh'));
            const icon = header.querySelector('#refresh-icon');
            if (icon) {
                icon.style.transition = 'transform 0.5s ease';
                icon.style.transform = 'rotate(360deg)';
                setTimeout(() => { icon.style.transition = ''; icon.style.transform = ''; }, 500);
            }
        };
    }
}

async function showDiagnosticModal() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        animation: fadeIn 200ms cubic-bezier(0.4,0,0.2,1) forwards;
    `;

    overlay.innerHTML = `
        <div style="background:#FFFFFF; border-radius:4px; box-shadow:0 12px 24px rgba(0,0,0,0.1), 0 0 8px rgba(0,0,0,0.05); width:100%; max-width:440px; overflow:hidden;">
            <!-- Header -->
            <div style="display:flex; align-items:center; justify-content:space-between; height:48px; padding:0 16px; border-bottom:1px solid #E6E6E6;">
                <span style="font-size:13px; font-weight:600; color:#121212;">Diagnostic Signal Center</span>
                <button id="close-diag" style="width:26px; height:26px; border-radius:4px; border:none; background:transparent; cursor:pointer; color:#666666; display:flex; align-items:center; justify-content:center; transition:background 150ms, color 150ms;"
                    onmouseenter="this.style.background='#FFF2F2'; this.style.color='#CC0909';"
                    onmouseleave="this.style.background='transparent'; this.style.color='#666666';">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- Body -->
            <div style="padding:16px 16px 20px; display:flex; flex-direction:column; gap:10px;">
                <p style="font-size:13px; color:#666666; margin:0 0 4px 0; line-height:1.5;">Select target infrastructure to verify connectivity and diagnostic pipeline health.</p>

                <button id="probe-k8s" style="display:flex; align-items:flex-start; gap:12px; padding:14px; border:1px solid #E6E6E6; border-radius:4px; background:transparent; cursor:pointer; text-align:left; width:100%; font-family:inherit; transition:background 200ms, border-color 200ms;"
                    onmouseenter="this.style.background='#F2F6FF'; this.style.borderColor='#B1CAFE';"
                    onmouseleave="this.style.background='transparent'; this.style.borderColor='#E6E6E6';">
                    <div style="width:36px; height:36px; border-radius:4px; background:#F2F6FF; display:flex; align-items:center; justify-content:center; color:#134AC1; flex-shrink:0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                    </div>
                    <div>
                        <div style="font-size:13px; font-weight:600; color:#121212; margin-bottom:3px;">Kubernetes Cluster Probe</div>
                        <div style="font-size:12px; color:#666666; line-height:1.4;">Verifies API connectivity, pod listings, and manifest retrieval.</div>
                    </div>
                </button>

                <button id="probe-local" style="display:flex; align-items:flex-start; gap:12px; padding:14px; border:1px solid #E6E6E6; border-radius:4px; background:transparent; cursor:pointer; text-align:left; width:100%; font-family:inherit; transition:background 200ms, border-color 200ms;"
                    onmouseenter="this.style.background='#ECFFFD'; this.style.borderColor='#8EE6C9';"
                    onmouseleave="this.style.background='transparent'; this.style.borderColor='#E6E6E6';">
                    <div style="width:36px; height:36px; border-radius:4px; background:#ECFFFD; display:flex; align-items:center; justify-content:center; color:#007B51; flex-shrink:0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                    </div>
                    <div>
                        <div style="font-size:13px; font-weight:600; color:#121212; margin-bottom:3px;">VM / Local Node Probe</div>
                        <div style="font-size:12px; color:#666666; line-height:1.4;">Verifies OS-level telemetry, process mapping, and hardware health.</div>
                    </div>
                </button>

                <button id="trigger-sim" style="display:flex; align-items:flex-start; gap:12px; padding:14px; border:1px solid #FCDEDE; border-radius:4px; background:transparent; cursor:pointer; text-align:left; width:100%; font-family:inherit; transition:background 200ms, border-color 200ms;"
                    onmouseenter="this.style.background='#FFF2F2'; this.style.borderColor='#F29696';"
                    onmouseleave="this.style.background='transparent'; this.style.borderColor='#FCDEDE';">
                    <div style="width:36px; height:36px; border-radius:4px; background:#FFF2F2; display:flex; align-items:center; justify-content:center; color:#CC0909; flex-shrink:0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div>
                        <div style="font-size:13px; font-weight:600; color:#121212; margin-bottom:3px;">Simulated Critical Incident</div>
                        <div style="font-size:12px; color:#666666; line-height:1.4;">Triggers a full-pipeline simulation (Diagnostics → AI RCA → Remediation).</div>
                    </div>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-diag').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#probe-k8s').onclick = async () => {
        await triggerAlert({
            alertname: 'ConnectivityProbe_K8s',
            namespace: 'production',
            severity: 'info',
            description: 'System-generated probe to verify Kubernetes monitoring pipeline connectivity.',
        });
        close();
    };

    overlay.querySelector('#probe-local').onclick = async () => {
        await triggerAlert({
            alertname: 'ConnectivityProbe_VM',
            namespace: 'local-system',
            instance: 'local',
            severity: 'info',
            description: 'System-generated probe to verify VM/Node telemetry and diagnostic routing.',
        });
        close();
    };

    overlay.querySelector('#trigger-sim').onclick = async () => {
        await triggerAlert({
            alertname: 'SIMULATED_INCIDENT: Database Connection Leak',
            namespace: 'local-system',
            instance: 'local',
            severity: 'critical',
            description: 'HIGH_LOAD detected. Potential connection leak in auth-service.',
        });
        close();
    };
}

function getViewTitle(view) {
    const titles = {
        dashboard: 'Global Dashboard',
        active:    'Active Incidents',
        control:   'Incident Control',
        archive:   'Post-Mortem Ledger',
        chaos:     'Chaos Control',
        pods:      'Resource Registry',
        settings:  'Settings',
        runbooks:  'Runbooks',
        rules:     'Rules & Suppression',
        ssl:       'SSL Monitor',
    };
    return titles[view] ?? 'Global Dashboard';
}
