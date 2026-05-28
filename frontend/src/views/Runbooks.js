/**
 * RUNBOOKS VIEW — Confluence knowledge base browser
 */
import { API_BASE } from '../utils/api';
import { updateState } from '../utils/state';
import { openRunbookModal, injectRunbookStyles, escHtml, escAttr } from '../utils/runbookModal';

export async function renderRunbooksView(container) {
    injectRunbookStyles();
    container.innerHTML = loadingHtml('Fetching runbooks from Confluence…');

    try {
        const res  = await fetch(`${API_BASE}/runbooks`);
        const data = await res.json();

        if (!data.configured) {
            renderUnconfigured(container);
            return;
        }

        const runbooks = data.runbooks || [];
        updateState({ runbookCount: runbooks.length });
        renderGrid(container, runbooks);

    } catch (e) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-3">
                <div class="text-alert-red font-bold text-sm">Failed to load runbooks: ${escHtml(e.message)}</div>
                <button onclick="location.reload()"
                    class="px-4 py-2 rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark text-[10px] font-bold uppercase tracking-widest">
                    Retry
                </button>
            </div>`;
    }
}

function renderUnconfigured(container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full gap-6 max-w-md mx-auto text-center px-4">
            <div class="p-5 rounded-2xl bg-surface-hover-light dark:bg-surface-hover-dark">
                <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted mx-auto">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
            </div>
            <div>
                <h2 class="text-lg font-bold mb-2">Confluence Not Configured</h2>
                <p class="text-sm text-muted leading-relaxed">
                    Connect your Confluence workspace to browse runbooks and get
                    AI-grounded incident fix suggestions.
                </p>
            </div>
            <button id="rb-go-settings"
                class="px-6 py-2.5 bg-primary-light dark:bg-primary-dark text-white rounded-lg
                       font-bold text-[11px] uppercase tracking-widest hover:opacity-90 transition-opacity">
                Configure in Settings →
            </button>
        </div>`;
    container.querySelector('#rb-go-settings').onclick = () =>
        import('../utils/state').then(({ updateState }) => updateState({ view: 'settings' }));
}

function renderGrid(container, runbooks) {
    container.innerHTML = `
        <div class="flex flex-col gap-5 max-w-5xl mx-auto w-full">
            <div class="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 class="text-lg font-bold">Runbooks</h2>
                    <p class="text-[11px] text-muted mt-0.5" id="rb-label">
                        ${runbooks.length} runbook${runbooks.length !== 1 ? 's' : ''} synced from Confluence
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                            xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input id="rb-search" type="text" placeholder="Search runbooks…"
                            class="input-modern pl-9 w-52 h-9 text-[12px]" autocomplete="off" />
                    </div>
                    <button id="rb-refresh"
                        class="flex items-center gap-2 px-4 h-9 rounded-lg
                               bg-surface-hover-light dark:bg-surface-hover-dark
                               text-[10px] font-bold uppercase tracking-widest
                               text-muted hover:text-text-light dark:hover:text-text-dark transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            ${runbooks.length === 0
                ? `<div class="pane p-16 text-center text-muted text-sm">
                       No runbook pages found under the configured root page.
                       <br><span class="text-[11px] mt-2 block opacity-60">
                           Check the Root Page URL in Settings and ensure child pages exist.
                       </span>
                   </div>`
                : `<div id="rb-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                       ${runbooks.map(rb => cardHtml(rb)).join('')}
                   </div>
                   <p id="rb-empty-search" class="hidden text-center text-muted text-sm py-12 font-mono">
                       No runbooks match your search.
                   </p>`
            }
        </div>`;

    container.querySelector('#rb-refresh')?.addEventListener('click', async () => {
        const btn = container.querySelector('#rb-refresh');
        const origHTML = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Syncing…';
        try {
            const res = await fetch(`${API_BASE}/runbooks`);
            const data = await res.json();
            if (data.configured) {
                const runbooks = data.runbooks || [];
                updateState({ runbookCount: runbooks.length });
                renderGrid(container, runbooks);
            }
        } catch (_) {
            btn.disabled = false;
            btn.innerHTML = origHTML;
        }
    });

    // Live search filter
    const searchEl = container.querySelector('#rb-search');
    if (searchEl) {
        searchEl.addEventListener('input', () => {
            const q = searchEl.value.toLowerCase().trim();
            const cards = container.querySelectorAll('.rb-card');
            let shown = 0;
            cards.forEach(c => {
                const hit = !q || c.dataset.search.includes(q);
                c.style.display = hit ? '' : 'none';
                if (hit) shown++;
            });
            container.querySelector('#rb-empty-search')?.classList.toggle('hidden', shown > 0);
            const label = container.querySelector('#rb-label');
            if (label) label.textContent = q
                ? `${shown} of ${runbooks.length} runbooks`
                : `${runbooks.length} runbook${runbooks.length !== 1 ? 's' : ''} synced from Confluence`;
        });
    }

    // "Read" buttons
    container.querySelectorAll('.rb-read-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            openRunbookModal(btn.dataset.id, btn.dataset.title, btn.dataset.url);
        })
    );

    // Clicking card body also opens modal
    container.querySelectorAll('.rb-card').forEach(card =>
        card.addEventListener('click', e => {
            if (e.target.closest('a') || e.target.closest('.rb-read-btn')) return;
            const btn = card.querySelector('.rb-read-btn');
            if (btn) openRunbookModal(btn.dataset.id, btn.dataset.title, btn.dataset.url);
        })
    );
}

function cardHtml(rb) {
    const dateStr = rb.last_modified
        ? new Date(rb.last_modified).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
          })
        : null;

    return `
        <div class="rb-card pane p-5 flex flex-col gap-4 cursor-pointer
                    hover:border-blue-500/30 hover:shadow-xl transition-all group"
             data-search="${escAttr((rb.title + ' ' + (rb.excerpt || '')).toLowerCase())}">
            <div class="flex items-start gap-3">
                <div class="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 flex-shrink-0 mt-0.5
                            group-hover:bg-blue-500/18 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                </div>
                <div class="min-w-0 flex-grow">
                    <h3 class="font-bold text-sm leading-snug group-hover:text-blue-400 transition-colors">
                        ${escHtml(rb.title)}
                    </h3>
                    <div class="flex items-center gap-1.5 mt-1 text-[10px] text-muted font-mono flex-wrap">
                        ${rb.author ? `<span>${escHtml(rb.author)}</span>` : ''}
                        ${rb.author && dateStr ? '<span class="opacity-40">·</span>' : ''}
                        ${dateStr ? `<span>${dateStr}</span>` : ''}
                    </div>
                </div>
            </div>
            ${rb.excerpt
                ? `<p class="text-[11.5px] text-muted leading-relaxed line-clamp-3 flex-grow">
                       ${escHtml(rb.excerpt)}
                   </p>`
                : '<div class="flex-grow"></div>'}
            <div class="flex items-center justify-between pt-3
                        border-t border-surface-hover-light dark:border-surface-hover-dark">
                <button class="rb-read-btn flex items-center gap-2 px-3.5 py-1.5 rounded-lg
                               bg-blue-500/10 hover:bg-blue-500/20 text-blue-400
                               text-[10px] font-bold uppercase tracking-widest transition-colors"
                    data-id="${escAttr(rb.id)}"
                    data-title="${escAttr(rb.title)}"
                    data-url="${escAttr(rb.url || '')}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Read Runbook
                </button>
                ${rb.url ? `
                <a href="${escAttr(rb.url)}" target="_blank" rel="noopener noreferrer"
                    onclick="event.stopPropagation()"
                    title="Open in Confluence"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                           text-[10px] text-muted hover:text-primary-light dark:hover:text-primary-dark
                           hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Confluence
                </a>` : ''}
            </div>
        </div>`;
}

function loadingHtml(msg) {
    return `<div style="display:flex;align-items:center;justify-content:center;height:200px;gap:10px;">
        <div class="rb-spin"></div>
        <span class="text-sm text-muted">${msg}</span>
    </div>`;
}
