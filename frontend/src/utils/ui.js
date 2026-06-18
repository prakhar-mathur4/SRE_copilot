/**
 * Shared view states: loading and error cards. Keeps every view's empty /
 * failure UX consistent instead of broken HTML or stuck skeletons.
 */
function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderLoading(container, message = 'Loading…') {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
             height:100%; min-height:200px; gap:12px; color:#666; font-size:13px;">
            <div style="width:32px; height:32px; border-radius:50%; border:3px solid #D2E0FE;
                 border-top-color:#134AC1;" class="animate-spin"></div>
            <div>${esc(message)}</div>
        </div>`;
}

export function renderError(container, message = 'Something went wrong.', onRetry) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
             height:100%; min-height:240px; gap:14px; text-align:center; padding:24px;">
            <div style="width:44px; height:44px; border-radius:50%; background:#FFF2F2; color:#CC0909;
                 display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700;">!</div>
            <div style="font-size:14px; font-weight:600; color:#121212; max-width:420px;">${esc(message)}</div>
            ${onRetry ? `
                <button id="err-retry" style="height:34px; padding:0 16px; border:1px solid #E6E6E6;
                    border-radius:4px; background:#FFFFFF; font-size:13px; font-weight:600; color:#134AC1;
                    cursor:pointer; font-family:inherit;">Retry</button>` : ''}
        </div>`;
    if (onRetry) {
        const btn = container.querySelector('#err-retry');
        if (btn) btn.onclick = () => onRetry();
    }
}
