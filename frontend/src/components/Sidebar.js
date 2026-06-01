/**
 * SIDEBAR — IQM Vertical Tabs
 */
import { state, updateState } from '../utils/state';

const NAV_ITEMS = [
    {
        id: 'dashboard',
        label: 'Global Dashboard',
        icon: `<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>`,
    },
    {
        id: 'active',
        label: 'Active Incidents',
        icon: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    },
    {
        id: 'runbooks',
        label: 'Runbooks',
        icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
    },
    {
        id: 'archive',
        label: 'Archive',
        icon: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
    },
    {
        id: 'chaos',
        label: 'Chaos Engine',
        icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
    },
    {
        id: 'rules',
        label: 'Rules & Suppression',
        icon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
    },
    {
        id: 'pods',
        label: 'Resource Inventory',
        icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>`,
    },
    {
        id: 'ssl',
        label: 'SSL Monitor',
        icon: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`,
    },
    {
        id: 'settings',
        label: 'Connectors & Keys',
        icon: `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`,
    },
];

export function renderSidebar() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    nav.innerHTML = `
        <!-- Logo -->
        <div style="height:56px; display:flex; align-items:center; padding:0 16px; border-bottom:1px solid #E6E6E6; flex-shrink:0;">
            <img src="/logo.png" alt="SRE Co-Pilot" style="height:32px; width:auto; object-fit:contain; display:block;" />
        </div>

        <!-- Nav list -->
        <div style="flex:1; overflow-y:auto; padding:6px 0;">
            ${NAV_ITEMS.map(item => {
                const isActive = state.view === item.id || (item.id === 'active' && state.view === 'control');
                const showBadge = item.id === 'runbooks' && state.runbookCount != null && state.runbookCount > 0;
                return `
                    <button
                        id="nav-${item.id}"
                        title="${item.label}"
                        style="
                            position: relative;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            width: 100%;
                            height: 42px;
                            padding: 0 16px;
                            border: none;
                            cursor: pointer;
                            text-align: left;
                            background: ${isActive ? '#F2F6FF' : 'transparent'};
                            color: ${isActive ? '#134AC1' : '#4D4D4D'};
                            font-size: 13px;
                            font-weight: ${isActive ? '600' : '400'};
                            font-family: inherit;
                            transition: background 200ms cubic-bezier(0.4,0,0.2,1), color 200ms cubic-bezier(0.4,0,0.2,1);
                        "
                    >
                        ${isActive ? `<div style="position:absolute; left:0; top:0; bottom:0; width:2px; background:#134AC1; border-radius:0 2px 2px 0;"></div>` : ''}
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${isActive ? '2' : '1.75'}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">${item.icon}</svg>
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${item.label}</span>
                        ${showBadge ? `
                            <span style="flex-shrink:0; min-width:18px; height:18px; padding:0 5px; border-radius:50rem; background:#134AC1; color:#FFFFFF; font-size:10px; font-weight:600; display:flex; align-items:center; justify-content:center; line-height:1;">
                                ${state.runbookCount > 99 ? '99+' : state.runbookCount}
                            </span>
                        ` : ''}
                    </button>
                `;
            }).join('')}
        </div>
    `;

    NAV_ITEMS.forEach(item => {
        const btn = nav.querySelector(`#nav-${item.id}`);
        if (!btn) return;

        const isActive = state.view === item.id || (item.id === 'active' && state.view === 'control');

        if (!isActive) {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#E2EBFF';
                btn.style.color = '#134AC1';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'transparent';
                btn.style.color = '#4D4D4D';
            });
        }

        btn.onclick = () => updateState({ view: item.id });
    });
}
