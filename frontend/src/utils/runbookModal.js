/**
 * SHARED RUNBOOK MODAL
 * Renders a full Confluence runbook page in a slide-up modal.
 * Used by both the Runbooks view and the Control Room Runbook Fix tab.
 */
import DOMPurify from 'dompurify';
import { apiFetch } from './api';

const STYLE_ID = 'rb-injected-styles';

export function injectRunbookStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes rb-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rb-panel-in {
            from { opacity: 0; transform: translateY(24px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)  scale(1);    }
        }
        @keyframes rb-spin { to { transform: rotate(360deg); } }

        /* ── Overlay ── */
        #rb-modal {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; align-items: center; justify-content: center; padding: 20px;
            background: rgba(0,0,0,0.72);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            animation: rb-overlay-in 0.2s ease-out forwards;
        }

        /* ── Panel ── */
        .rb-panel {
            width: 100%; max-width: 900px; max-height: 92vh;
            display: flex; flex-direction: column; overflow: hidden;
            background: #0d1526;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 20px;
            box-shadow: 0 32px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.06);
            animation: rb-panel-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }

        /* ── Header ── */
        .rb-header {
            flex-shrink: 0;
            padding: 24px 28px 0;
            border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .rb-header-top {
            display: flex; align-items: flex-start;
            justify-content: space-between; gap: 16px; margin-bottom: 14px;
        }
        .rb-title {
            font-family: 'Fira Code', monospace;
            font-size: 17px; font-weight: 700;
            letter-spacing: -0.025em; color: #f1f5f9; line-height: 1.35;
        }
        .rb-close {
            flex-shrink: 0; width: 30px; height: 30px;
            border-radius: 8px; border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.05); color: #64748b;
            transition: background 0.15s, color 0.15s;
        }
        .rb-close:hover { background: rgba(239,68,68,0.15); color: #f87171; }

        /* ── Meta bar ── */
        .rb-meta {
            display: flex; align-items: center; gap: 18px;
            padding-bottom: 16px; flex-wrap: wrap;
        }
        .rb-meta-pill {
            display: flex; align-items: center; gap: 6px;
            font-size: 11px; color: #64748b;
            font-family: 'Fira Code', monospace;
        }
        .rb-cf-link {
            display: flex; align-items: center; gap: 6px;
            padding: 6px 14px; border-radius: 8px; text-decoration: none;
            font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
            color: #38bdf8;
            background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.18);
            transition: background 0.15s, color 0.15s; margin-left: auto;
        }
        .rb-cf-link:hover { background: rgba(56,189,248,0.16); color: #7dd3fc; }

        /* ── Body ── */
        .rb-body {
            flex: 1; overflow-y: auto; padding: 28px 32px 32px;
            scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .rb-body::-webkit-scrollbar { width: 5px; }
        .rb-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        /* ── Confluence HTML styling ── */
        .cf-content { color: #c4cfe0; line-height: 1.75; font-size: 14px; }
        .cf-content > *:first-child { margin-top: 0 !important; }
        .cf-content h1 {
            font-family: 'Fira Code', monospace; font-size: 21px; font-weight: 700;
            color: #f1f5f9; letter-spacing: -0.02em;
            margin: 28px 0 12px; padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .cf-content h2 {
            font-family: 'Fira Code', monospace; font-size: 17px; font-weight: 700;
            color: #e2e8f0; letter-spacing: -0.01em; margin: 24px 0 10px;
        }
        .cf-content h3 {
            font-size: 14px; font-weight: 700; color: #cbd5e1; margin: 18px 0 8px;
            text-transform: uppercase; letter-spacing: 0.04em; font-family: 'Fira Code', monospace;
        }
        .cf-content h4, .cf-content h5, .cf-content h6 {
            font-size: 13px; font-weight: 600; color: #94a3b8; margin: 14px 0 6px;
        }
        .cf-content p { margin: 0 0 12px; }
        .cf-content a { color: #38bdf8; text-decoration: underline; text-underline-offset: 3px; }
        .cf-content a:hover { color: #7dd3fc; }
        .cf-content strong, .cf-content b { color: #e2e8f0; font-weight: 600; }
        .cf-content em, .cf-content i { color: #94a3b8; }
        .cf-content ul, .cf-content ol { margin: 6px 0 14px 22px; }
        .cf-content li { margin-bottom: 6px; }
        .cf-content ul > li { list-style-type: disc; }
        .cf-content ul > li > ul > li { list-style-type: circle; }
        .cf-content ol > li { list-style-type: decimal; }
        .cf-content code {
            font-family: 'Fira Code', monospace; font-size: 12px; color: #a5f3fc;
            background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.07);
            border-radius: 5px; padding: 1px 7px;
        }
        .cf-content pre {
            background: rgba(8,8,20,0.9); border: 1px solid rgba(139,92,246,0.18);
            border-radius: 12px; padding: 18px 20px; overflow-x: auto; margin: 14px 0;
            position: relative;
        }
        .cf-content pre code {
            background: none; border: none; padding: 0;
            font-size: 12px; color: #a5f3fc; line-height: 1.6;
        }
        /* Copy button on code blocks */
        .rb-copy-btn {
            position: absolute; top: 10px; right: 10px;
            padding: 4px 8px; border-radius: 6px; border: none; cursor: pointer;
            font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
            background: rgba(255,255,255,0.07); color: #64748b;
            transition: background 0.15s, color 0.15s; font-family: 'Fira Code', monospace;
        }
        .rb-copy-btn:hover { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .rb-copy-btn.copied { background: rgba(34,197,94,0.15); color: #22c55e; }
        .cf-content blockquote {
            border-left: 3px solid rgba(56,189,248,0.45);
            padding: 10px 18px; margin: 14px 0;
            background: rgba(56,189,248,0.04); border-radius: 0 10px 10px 0;
            color: #94a3b8;
        }
        .cf-content hr {
            border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 22px 0;
        }
        .cf-content img { max-width: 100%; border-radius: 10px; margin: 8px 0; }
        .cf-content table {
            width: 100%; border-collapse: collapse; margin: 16px 0;
            font-size: 13px; border-radius: 10px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.08);
        }
        .cf-content th {
            background: rgba(56,189,248,0.07); color: #7dd3fc;
            font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.06em; padding: 10px 14px; text-align: left;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            font-family: 'Fira Code', monospace;
        }
        .cf-content td {
            padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
            vertical-align: top;
        }
        .cf-content tr:last-child td { border-bottom: none; }
        .cf-content tr:hover td { background: rgba(255,255,255,0.02); }
        /* Confluence info macros */
        .cf-content .confluence-information-macro {
            border-radius: 10px; padding: 14px 18px; margin: 14px 0; border-left: 4px solid;
        }
        .cf-content .confluence-information-macro-note    { background: rgba(245,158,11,0.07); border-color: #f59e0b; }
        .cf-content .confluence-information-macro-information { background: rgba(56,189,248,0.07); border-color: #38bdf8; }
        .cf-content .confluence-information-macro-tip     { background: rgba(34,197,94,0.07);  border-color: #22c55e; }
        .cf-content .confluence-information-macro-warning { background: rgba(239,68,68,0.07);   border-color: #ef4444; }
        .cf-content .confluence-information-macro-icon { display: none; }
        .cf-content .panel {
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px; padding: 16px; margin: 12px 0;
        }
        .cf-content .codeContent { background: transparent; }
        /* Spinner */
        .rb-spin {
            width: 20px; height: 20px; border-radius: 50%;
            border: 2px solid rgba(56,189,248,0.15); border-top-color: #38bdf8;
            animation: rb-spin 0.75s linear infinite;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Open the full-content runbook modal.
 * @param {string} pageId   - Confluence page ID
 * @param {string} title    - Display title (shown immediately, before fetch)
 * @param {string} pageUrl  - Full Confluence URL for the "Open in Confluence" link
 */
export function openRunbookModal(pageId, title, pageUrl) {
    injectRunbookStyles();
    document.getElementById('rb-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'rb-modal';
    modal.innerHTML = `
        <div class="rb-panel">
            <div class="rb-header">
                <div class="rb-header-top">
                    <span class="rb-title">${escHtml(title)}</span>
                    <button class="rb-close" id="rb-close-btn" title="Close (Esc)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="rb-meta">
                    <div class="rb-meta-pill">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                        </svg>
                        <span id="rb-meta-author">—</span>
                    </div>
                    <div class="rb-meta-pill">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span id="rb-meta-date">—</span>
                    </div>
                    ${pageUrl ? `
                    <a href="${escAttr(pageUrl)}" target="_blank" rel="noopener noreferrer" class="rb-cf-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Open in Confluence
                    </a>` : ''}
                </div>
            </div>
            <div class="rb-body" id="rb-body-content">
                <div style="display:flex;align-items:center;justify-content:center;height:220px;gap:12px;color:#64748b;">
                    <div class="rb-spin"></div>
                    <span style="font-size:13px;font-family:'Fira Code',monospace;">Fetching runbook…</span>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.style.transition = 'opacity 0.15s';
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 160);
        document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    modal.querySelector('#rb-close-btn').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    apiFetch(`/runbooks/${encodeURIComponent(pageId)}`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(page => {
            const authorEl = modal.querySelector('#rb-meta-author');
            const dateEl   = modal.querySelector('#rb-meta-date');
            if (authorEl) authorEl.textContent = page.author || 'Unknown';
            if (dateEl && page.last_modified) {
                dateEl.textContent = new Date(page.last_modified).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
            }

            const body = modal.querySelector('#rb-body-content');
            if (page.html_content?.trim()) {
                const clean = DOMPurify.sanitize(page.html_content, {
                    USE_PROFILES: { html: true },
                    // Allow Confluence macro classes but strip any event handlers / scripts
                    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button'],
                    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
                });
                const wrapper = document.createElement('div');
                wrapper.className = 'cf-content';
                wrapper.innerHTML = clean;

                // Open all links in a new tab
                wrapper.querySelectorAll('a').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                });

                // Add copy buttons to every code block
                wrapper.querySelectorAll('pre').forEach(pre => {
                    const btn = document.createElement('button');
                    btn.className = 'rb-copy-btn';
                    btn.textContent = 'Copy';
                    btn.onclick = () => {
                        const text = pre.querySelector('code')?.innerText || pre.innerText;
                        navigator.clipboard.writeText(text).then(() => {
                            btn.textContent = 'Copied!';
                            btn.classList.add('copied');
                            setTimeout(() => {
                                btn.textContent = 'Copy';
                                btn.classList.remove('copied');
                            }, 2000);
                        });
                    };
                    pre.appendChild(btn);
                });

                body.innerHTML = '';
                body.appendChild(wrapper);
            } else {
                body.innerHTML = `<p style="color:#64748b;text-align:center;padding:48px 0;font-size:13px;">No content found for this runbook page.</p>`;
            }
        })
        .catch(err => {
            const body = modal.querySelector('#rb-body-content');
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:8px;">
                    <span style="color:#f87171;font-size:13px;font-weight:600;">Failed to load runbook</span>
                    <span style="color:#64748b;font-size:11px;font-family:'Fira Code',monospace;">${escHtml(err.message)}</span>
                </div>`;
        });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
