/**
 * USERS VIEW — admin user management (create, role, enable/disable, reset, delete).
 * Gated to Admin/Owner in the sidebar; the backend enforces it regardless.
 * One-time temp passwords (create / reset) are surfaced inline since the server
 * only returns them once.
 */
import { state } from '../utils/state';
import { listUsers, createUser, updateUser, resetUserPassword, deleteUser } from '../utils/api';

const ASSIGNABLE_ROLES = ['viewer', 'responder', 'maintainer', 'admin'];

function banner(msg, ok = true) {
    const el = document.getElementById('users-banner');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = ok ? '#ECFFFD' : '#FFF2F2';
    el.style.color = ok ? '#007B51' : '#CC0909';
    el.style.border = `1px solid ${ok ? '#B0EFDA' : '#FCDEDE'}`;
    el.innerHTML = msg;
}

export async function renderUsersView(container) {
    container.innerHTML = '<div class="p-20 text-center" style="color:#666;font-size:13px;">Loading users…</div>';

    const { users } = await listUsers();
    const me = state.currentUser || {};

    const roleOptions = (selected) => ASSIGNABLE_ROLES
        .map(r => `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`).join('');

    container.innerHTML = `
        <div style="max-width:960px; margin:0 auto; display:flex; flex-direction:column; gap:24px;">
            <div id="users-banner" style="display:none; font-size:12px; font-family:monospace; padding:10px 12px; border-radius:4px;"></div>

            <!-- Create user -->
            <div class="pane" style="padding:20px;">
                <h3 style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#666; margin:0 0 14px;">Add user</h3>
                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
                    <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:160px;">
                        <label style="font-size:11px; font-weight:700; color:#666; text-transform:uppercase;">Username</label>
                        <input id="nu-username" class="input-modern" type="text" autocomplete="off" />
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:160px;">
                        <label style="font-size:11px; font-weight:700; color:#666; text-transform:uppercase;">Display name</label>
                        <input id="nu-display" class="input-modern" type="text" autocomplete="off" />
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; min-width:140px;">
                        <label style="font-size:11px; font-weight:700; color:#666; text-transform:uppercase;">Role</label>
                        <select id="nu-role" class="input-modern">${roleOptions('responder')}</select>
                    </div>
                    <button id="nu-create" class="btn-primary" style="height:38px;">Create</button>
                </div>
            </div>

            <!-- User list -->
            <div class="pane" style="padding:0; overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#F7F7F7; text-align:left; color:#666; font-size:11px; text-transform:uppercase; letter-spacing:0.05em;">
                            <th style="padding:12px 16px;">User</th>
                            <th style="padding:12px 16px;">Role</th>
                            <th style="padding:12px 16px;">Status</th>
                            <th style="padding:12px 16px;">Last login</th>
                            <th style="padding:12px 16px; text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => {
                            const isOwner = u.role === 'owner';
                            const isSelf = u.id === me.id;
                            const locked = isOwner; // owner role/status is immutable from UI
                            return `
                            <tr data-id="${u.id}" style="border-top:1px solid #EEE;">
                                <td style="padding:12px 16px;">
                                    <div style="font-weight:600; color:#121212;">${u.username}${isSelf ? ' <span style="color:#999;font-weight:400;">(you)</span>' : ''}</div>
                                    <div style="color:#999; font-size:12px;">${u.display_name || ''}</div>
                                </td>
                                <td style="padding:12px 16px;">
                                    ${locked
                                        ? `<span style="font-weight:600; text-transform:capitalize;">${u.role}</span>`
                                        : `<select class="input-modern u-role" style="height:32px;">${roleOptions(u.role)}</select>`}
                                </td>
                                <td style="padding:12px 16px;">
                                    <span style="display:inline-flex; align-items:center; gap:6px;">
                                        <span style="width:8px;height:8px;border-radius:50%;background:${u.is_active ? '#007B51' : '#CC0909'};"></span>
                                        ${u.is_active ? 'Active' : 'Disabled'}
                                    </span>
                                </td>
                                <td style="padding:12px 16px; color:#666;">${u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—'}</td>
                                <td style="padding:12px 16px; text-align:right; white-space:nowrap;">
                                    <button class="u-reset" style="${actionBtn}">Reset password</button>
                                    ${locked ? '' : `<button class="u-toggle" style="${actionBtn}">${u.is_active ? 'Disable' : 'Enable'}</button>`}
                                    ${locked || isSelf ? '' : `<button class="u-delete" style="${actionBtn}; color:#CC0909;">Delete</button>`}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Create
    container.querySelector('#nu-create').onclick = async () => {
        const username = container.querySelector('#nu-username').value.trim();
        const display_name = container.querySelector('#nu-display').value.trim();
        const role = container.querySelector('#nu-role').value;
        if (!username) { banner('Username is required.', false); return; }
        const { ok, data } = await createUser({ username, role, display_name });
        if (!ok) { banner(data.detail || 'Create failed.', false); return; }
        banner(`Created <b>${data.username}</b> (${data.role}). One-time password: <b>${data.temp_password}</b> — share it securely; it won't be shown again.`);
        renderUsersView(container);
    };

    // Role change
    container.querySelectorAll('tr[data-id]').forEach(row => {
        const id = row.dataset.id;
        const roleSel = row.querySelector('.u-role');
        if (roleSel) roleSel.onchange = async () => {
            const { ok, data } = await updateUser(id, { role: roleSel.value });
            banner(ok ? `Role updated to ${roleSel.value}.` : (data.detail || 'Update failed.'), ok);
            if (!ok) renderUsersView(container);
        };
        const toggle = row.querySelector('.u-toggle');
        if (toggle) toggle.onclick = async () => {
            const enabling = toggle.textContent.trim() === 'Enable';
            const { ok, data } = await updateUser(id, { is_active: enabling });
            if (!ok) { banner(data.detail || 'Update failed.', false); return; }
            renderUsersView(container);
        };
        const reset = row.querySelector('.u-reset');
        if (reset) reset.onclick = async () => {
            if (!confirm('Issue a new one-time password for this user?')) return;
            const { ok, data } = await resetUserPassword(id);
            banner(ok
                ? `New one-time password for <b>${data.username}</b>: <b>${data.temp_password}</b> — share it securely.`
                : (data.detail || 'Reset failed.'), ok);
        };
        const del = row.querySelector('.u-delete');
        if (del) del.onclick = async () => {
            if (!confirm('Permanently delete this user?')) return;
            const { ok, data } = await deleteUser(id);
            if (!ok) { banner(data.detail || 'Delete failed.', false); return; }
            renderUsersView(container);
        };
    });
}

const actionBtn = 'height:30px; padding:0 10px; margin-left:6px; border:1px solid #E6E6E6; border-radius:4px; '
    + 'background:#FFF; font-size:12px; font-weight:600; color:#4D4D4D; cursor:pointer; font-family:inherit;';
