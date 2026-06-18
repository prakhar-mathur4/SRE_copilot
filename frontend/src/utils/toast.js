/**
 * Lightweight global toast notifications (top-right, auto-dismiss).
 * Messages are inserted as text (not HTML) to avoid injection.
 */
const CONTAINER_ID = 'toast-container';

function getContainer() {
    let el = document.getElementById(CONTAINER_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = CONTAINER_ID;
        el.style.cssText =
            'position:fixed; top:16px; right:16px; z-index:1200; display:flex; ' +
            'flex-direction:column; gap:8px; max-width:360px;';
        document.body.appendChild(el);
    }
    return el;
}

const STYLES = {
    success: { bg: '#ECFFFD', border: '#B0EFDA', color: '#007B51', icon: '✓' },
    error:   { bg: '#FFF2F2', border: '#FCDEDE', color: '#CC0909', icon: '✕' },
    warning: { bg: '#FFF3DE', border: '#F7D8A3', color: '#A36701', icon: '⚠' },
    info:    { bg: '#F2F6FF', border: '#B1CAFE', color: '#134AC1', icon: 'ℹ' },
};

export function toast(message, type = 'info', timeout = 4500) {
    const s = STYLES[type] || STYLES.info;

    const el = document.createElement('div');
    el.style.cssText =
        `display:flex; align-items:flex-start; gap:8px; background:${s.bg}; ` +
        `border:1px solid ${s.border}; color:${s.color}; border-radius:6px; ` +
        'padding:10px 12px; font-size:13px; font-family:inherit; ' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.08);';

    const icon = document.createElement('span');
    icon.style.cssText = 'font-weight:700; flex-shrink:0;';
    icon.textContent = s.icon;

    const msg = document.createElement('span');
    msg.style.cssText = 'flex:1; line-height:1.4;';
    msg.textContent = message;  // text, not HTML — safe

    const close = document.createElement('button');
    close.style.cssText =
        'border:none; background:transparent; color:inherit; cursor:pointer; ' +
        'font-size:15px; line-height:1; flex-shrink:0;';
    close.textContent = '×';

    const remove = () => {
        el.style.transition = 'opacity 150ms';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 150);
    };
    close.onclick = remove;

    el.append(icon, msg, close);
    getContainer().appendChild(el);
    if (timeout) setTimeout(remove, timeout);
    return el;
}
