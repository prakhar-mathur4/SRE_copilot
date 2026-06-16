/**
 * AUTH SCREENS — full-screen login & forced password-change overlay.
 * Rendered by main.js before the app boots. Handlers return an error string to
 * display, or null on success (caller then removes the overlay).
 */

const OVERLAY_ID = 'auth-overlay';

function _shell(innerHtml) {
    return `
        <div id="${OVERLAY_ID}" style="position:fixed; inset:0; z-index:1000; background:#FAFAFA;
             display:flex; align-items:center; justify-content:center; padding:24px; font-family:inherit;">
            <div style="width:100%; max-width:380px; background:#FFFFFF; border:1px solid #E6E6E6;
                 border-radius:6px; box-shadow:0 8px 28px rgba(0,0,0,0.08); padding:32px;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px; margin-bottom:24px;">
                    <img src="/logo.png" alt="SRE Co-Pilot" style="height:36px; width:auto; object-fit:contain;" />
                </div>
                ${innerHtml}
            </div>
        </div>
    `;
}

const _inputStyle = 'width:100%; height:38px; padding:0 12px; border:1px solid #E6E6E6; border-radius:4px; '
    + 'font-size:14px; font-family:inherit; color:#121212; outline:none; box-sizing:border-box;';
const _labelStyle = 'font-size:11px; font-weight:700; color:#666666; text-transform:uppercase; letter-spacing:0.06em;';
const _btnStyle = 'width:100%; height:40px; border:none; border-radius:4px; background:#134AC1; color:#FFFFFF; '
    + 'font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; transition:background 150ms;';

function _errorEl() {
    return `<div id="auth-error" style="display:none; font-size:12px; color:#CC0909; background:#FFF2F2;
        border:1px solid #FCDEDE; border-radius:4px; padding:8px 10px; margin-top:4px;"></div>`;
}

function _showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

export function removeAuthScreen() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
}

export function renderAuthScreen(mode, handlers = {}) {
    removeAuthScreen();

    if (mode === 'login') {
        document.body.insertAdjacentHTML('beforeend', _shell(`
            <h2 style="font-size:16px; font-weight:600; color:#121212; text-align:center; margin:0 0 4px;">Sign in</h2>
            <p style="font-size:12px; color:#999; text-align:center; margin:0 0 20px;">SRE Copilot Control Center</p>
            <div style="display:flex; flex-direction:column; gap:14px;">
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <label style="${_labelStyle}">Username</label>
                    <input id="auth-username" type="text" autocomplete="username" style="${_inputStyle}" />
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <label style="${_labelStyle}">Password</label>
                    <input id="auth-password" type="password" autocomplete="current-password" style="${_inputStyle}" />
                </div>
                ${_errorEl()}
                <button id="auth-submit" style="${_btnStyle}; margin-top:6px;">Sign in</button>
            </div>
        `));

        const submit = async () => {
            const btn = document.getElementById('auth-submit');
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value;
            if (!username || !password) { _showError('Enter your username and password.'); return; }
            btn.disabled = true; btn.textContent = 'Signing in…';
            const err = await handlers.onLogin(username, password);
            if (err) { _showError(err); btn.disabled = false; btn.textContent = 'Sign in'; }
        };
        document.getElementById('auth-submit').onclick = submit;
        ['auth-username', 'auth-password'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        });
        document.getElementById('auth-username').focus();
        return;
    }

    if (mode === 'change') {
        document.body.insertAdjacentHTML('beforeend', _shell(`
            <h2 style="font-size:16px; font-weight:600; color:#121212; text-align:center; margin:0 0 4px;">Set a new password</h2>
            <p style="font-size:12px; color:#999; text-align:center; margin:0 0 20px;">You must change your password before continuing.</p>
            <div style="display:flex; flex-direction:column; gap:14px;">
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <label style="${_labelStyle}">New password</label>
                    <input id="auth-newpw" type="password" autocomplete="new-password" style="${_inputStyle}" />
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <label style="${_labelStyle}">Confirm password</label>
                    <input id="auth-confirmpw" type="password" autocomplete="new-password" style="${_inputStyle}" />
                </div>
                ${_errorEl()}
                <button id="auth-submit" style="${_btnStyle}; margin-top:6px;">Update password</button>
            </div>
        `));

        const submit = async () => {
            const btn = document.getElementById('auth-submit');
            const pw = document.getElementById('auth-newpw').value;
            const confirm = document.getElementById('auth-confirmpw').value;
            if (pw.length < 10) { _showError('Password must be at least 10 characters.'); return; }
            if (pw !== confirm) { _showError('Passwords do not match.'); return; }
            btn.disabled = true; btn.textContent = 'Updating…';
            const err = await handlers.onChange(pw);
            if (err) { _showError(err); btn.disabled = false; btn.textContent = 'Update password'; }
        };
        document.getElementById('auth-submit').onclick = submit;
        ['auth-newpw', 'auth-confirmpw'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        });
        document.getElementById('auth-newpw').focus();
    }
}
