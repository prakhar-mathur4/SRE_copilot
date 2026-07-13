/**
 * SETTINGS & CONNECTORS VIEW (Multi-Infrastructure Upgrade)
 */
import { state, notify } from '../utils/state';
import { fetchSettings, updateEnvSettings, addConnector, deleteConnector, pingConfluence } from '../utils/api';

export async function renderSettingsView(container) {
    container.innerHTML = '<div class="p-20 text-center" style="color:#666666; font-size:13px;">Synchronizing registry...</div>';

    try {
        const data = await fetchSettings();
        const { env, secrets = {}, connectors } = data;
        // Secrets are masked by the backend — show a "configured" hint as a
        // placeholder and only send a value when the user types a new one.
        const secretPlaceholder = (key, fallback) => {
            const s = secrets[key];
            return s && s.configured ? `Configured ${s.hint} — leave blank to keep` : fallback;
        };

        container.innerHTML = `
            <div class="flex flex-col gap-6 h-full max-w-5xl mx-auto px-4">

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <!-- Left: Connectors List -->
                    <div class="lg:col-span-8 flex flex-col gap-6">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-bold">Active Connectors (${connectors.length})</h3>
                            <button id="show-add-modal" class="btn-primary">+ Add Connector</button>
                        </div>

                        <div class="grid grid-cols-1 gap-4">
                            ${connectors.map(c => `
                                <div class="pane p-6 flex justify-between items-center group">
                                    <div class="flex items-center gap-4">
                                        <div class="p-3 rounded ${
                                            c.type === 'kubernetes'     ? 'bg-info-50 text-info-500' :
                                            c.type === 'prometheus'     ? 'bg-warning-50 text-warning-500' :
                                            c.type === 'victoriametrics' ? 'bg-primary-50 text-primary-500' :
                                            c.type === 'vmalert'        ? 'bg-warning-50 text-warning-500' :
                                            c.type === 'alertmanager'   ? 'bg-danger-50 text-danger-500' :
                                            'bg-success-50 text-success-500'}">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${
                                                c.type === 'kubernetes' ? '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>' :
                                                c.type === 'prometheus' ? '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>' :
                                                c.type === 'victoriametrics' ? '<path d="M3 3v18h18"></path><path d="m7 14 4-4 3 3 5-6"></path>' :
                                                c.type === 'vmalert' ? '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>' :
                                                c.type === 'alertmanager' ? '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>' :
                                                '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect>'
                                            }</svg>
                                        </div>
                                        <div>
                                            <div class="font-bold text-sm mb-0.5 flex items-center gap-2">
                                                ${c.name}
                                                <span class="w-1.5 h-1.5 rounded-full ${c.status === 'healthy' || c.status === 'online' ? 'bg-success-500' : 'bg-danger-500'}"></span>
                                            </div>
                                            <div class="text-xs font-mono text-muted uppercase">${c.type} • ${c.url || 'Internal'}</div>
                                        </div>
                                    </div>
                                    <button class="delete-connector-btn p-2 text-muted hover:text-danger-500 transition-colors opacity-0 group-hover:opacity-100" data-id="${c.id}" title="Remove Connector">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Right: AI Engine + Notifications -->
                    <div class="lg:col-span-4 flex flex-col gap-6">

                        <!-- AI Engine -->
                        <div class="pane p-8 flex flex-col gap-6">
                            <h3 class="text-sm font-bold uppercase tracking-widest text-muted border-b border-neutral-200 pb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
                                AI Engine
                            </h3>
                            <div class="flex flex-col gap-4">
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Provider</label>
                                    <select id="setting-llm-provider" class="input-modern">
                                        <option value="openai"    ${env.LLM_PROVIDER === 'openai'    ? 'selected' : ''}>OpenAI</option>
                                        <option value="anthropic" ${env.LLM_PROVIDER === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                                        <option value="gemini"    ${env.LLM_PROVIDER === 'gemini'    ? 'selected' : ''}>Google Gemini</option>
                                        <option value="groq"      ${env.LLM_PROVIDER === 'groq'      ? 'selected' : ''}>Groq</option>
                                    </select>
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label id="api-key-label" class="text-[11px] font-bold text-muted uppercase tracking-widest">API Key</label>
                                    <input type="password" id="setting-llm-key" class="input-modern" autocomplete="off">
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Model <span class="normal-case font-normal">(optional)</span></label>
                                    <input type="text" id="setting-llm-model" value="${env.LLM_MODEL}" class="input-modern" autocomplete="off">
                                    <p id="model-hint" class="text-xs text-muted"></p>
                                </div>
                                <button id="save-ai-btn" class="mt-2 btn-outline w-full hover:bg-primary-600 hover:text-white transition-all">Save AI Config</button>
                                <div id="ai-feedback" class="hidden text-xs font-mono px-3 py-2 rounded"></div>
                            </div>
                        </div>

                        <!-- Notifications -->
                        <div class="pane p-8 flex flex-col gap-6">
                            <h3 class="text-sm font-bold uppercase tracking-widest text-muted border-b border-neutral-200 pb-4">Notifications</h3>
                            <div class="flex flex-col gap-4">
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Teams Webhook</label>
                                    <input type="text" id="setting-teams-url" value="" placeholder="${secretPlaceholder('TEAMS_WEBHOOK_URL', 'https://outlook.office.com/webhook/…')}" class="input-modern">
                                </div>
                                <button id="save-env-btn" class="mt-2 btn-outline w-full hover:bg-primary-600 hover:text-white transition-all">Save</button>
                                <div id="notif-feedback" class="hidden text-xs font-mono px-3 py-2 rounded"></div>
                            </div>
                        </div>

                        <!-- Confluence Knowledge Base -->
                        <div class="pane p-8 flex flex-col gap-6">
                            <h3 class="text-sm font-bold uppercase tracking-widest text-muted border-b border-neutral-200 pb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                Confluence Runbooks
                            </h3>
                            <div class="flex flex-col gap-4">
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Type</label>
                                    <select id="setting-conf-type" class="input-modern">
                                        <option value="cloud"       ${env.CONFLUENCE_TYPE === 'cloud'       ? 'selected' : ''}>Atlassian Cloud</option>
                                        <option value="self-hosted" ${env.CONFLUENCE_TYPE === 'self-hosted' ? 'selected' : ''}>Self-Hosted (On-prem)</option>
                                    </select>
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Confluence URL</label>
                                    <input type="text" id="setting-conf-url" value="${env.CONFLUENCE_URL || ''}" placeholder="https://yourcompany.atlassian.net" class="input-modern">
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Email / Username</label>
                                    <input type="text" id="setting-conf-email" value="${env.CONFLUENCE_EMAIL || ''}" placeholder="user@company.com" class="input-modern" autocomplete="off">
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">API Token / Password</label>
                                    <input type="password" id="setting-conf-token" value="" placeholder="${secretPlaceholder('CONFLUENCE_API_TOKEN', 'API token')}" class="input-modern" autocomplete="off">
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Root Page URL</label>
                                    <input type="text" id="setting-conf-page" value="${env.CONFLUENCE_ROOT_PAGE_URL || ''}" placeholder="https://…/wiki/spaces/SRE/pages/123456/Runbooks" class="input-modern">
                                    <p class="text-xs text-muted">Paste the full URL of the parent Confluence page — all child pages will be treated as runbooks.</p>
                                </div>
                                <div class="mt-2 flex flex-col gap-2">
                                    <div class="flex gap-2">
                                        <button id="test-confluence-btn"
                                            class="flex-1 btn-outline hover:bg-info-50 hover:text-info-500 transition-all">
                                            Test Connection
                                        </button>
                                        <button id="save-confluence-btn"
                                            class="flex-1 btn-outline hover:bg-primary-600 hover:text-white transition-all">
                                            Save Config
                                        </button>
                                    </div>
                                    <div id="confluence-feedback" class="hidden text-xs font-mono px-3 py-2 rounded"></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <!-- Add Connector Modal -->
            <div id="add-modal" class="fixed inset-0 glass z-50 flex items-center justify-center hidden">
                <div class="pane p-10 max-w-md w-full" style="box-shadow:var(--shadow-400);">
                    <h3 class="text-2xl font-bold mb-2">New Infrastructure</h3>
                    <p class="text-muted text-xs mb-8">Register a new Prometheus server or K8s cluster.</p>

                    <div class="flex flex-col gap-6">
                        <div class="flex flex-col gap-2">
                            <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Connector Name</label>
                            <input type="text" id="new-conn-name" placeholder="E.g. EKS-Prod-01" class="input-modern">
                        </div>
                        <div class="flex flex-col gap-2">
                            <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Type</label>
                            <select id="new-conn-type" class="input-modern">
                                <option value="alertmanager">Alertmanager</option>
                                <option value="prometheus">Prometheus Server</option>
                                <option value="victoriametrics">VictoriaMetrics</option>
                                <option value="vmalert">vmalert</option>
                                <option value="kubernetes">Kubernetes Cluster</option>
                                <option value="local_machine">Local Machine</option>
                            </select>
                        </div>
                        <div id="url-container" class="flex flex-col gap-2">
                            <label class="text-[11px] font-bold text-muted uppercase tracking-widest">Endpoint URL</label>
                            <input type="text" id="new-conn-url" placeholder="http://10.0.0.5:9093" class="input-modern">
                            <p id="url-hint" class="text-xs text-muted">Alertmanager base URL — alerts will be polled every 30s automatically.</p>
                        </div>

                        <div class="flex gap-4 mt-4">
                            <button id="close-modal" class="flex-grow btn-outline">Cancel</button>
                            <button id="confirm-add-conn" class="flex-grow btn-primary">Add Connector</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Logic
        const modal = container.querySelector('#add-modal');
        container.querySelector('#show-add-modal').onclick = () => modal.classList.remove('hidden');
        container.querySelector('#close-modal').onclick = () => modal.classList.add('hidden');

        const typeHints = {
            alertmanager: { placeholder: 'http://10.0.0.5:9093', hint: 'Alertmanager base URL — alerts polled every 30s automatically.' },
            prometheus:   { placeholder: 'http://10.0.0.5:9090', hint: 'Prometheus server URL — used for metrics and diagnostics.' },
            victoriametrics: { placeholder: 'http://10.0.0.5:8428', hint: 'VictoriaMetrics vmselect/single-node URL — Prometheus-compatible query API.' },
            vmalert:      { placeholder: 'http://10.0.0.5:8880', hint: 'vmalert URL — firing alerts polled every 30s; pending alerts ignored.' },
            kubernetes:   { placeholder: 'my-k8s-context',       hint: 'Kubeconfig context name, or leave blank for default.' },
            local_machine:{ placeholder: 'localhost',             hint: 'Monitors this machine via psutil — URL is not used.' },
        };
        const urlInput = container.querySelector('#new-conn-url');
        const urlHint  = container.querySelector('#url-hint');
        container.querySelector('#new-conn-type').onchange = (e) => {
            const h = typeHints[e.target.value] || typeHints.alertmanager;
            urlInput.placeholder = h.placeholder;
            urlHint.textContent  = h.hint;
        };

        container.querySelector('#confirm-add-conn').onclick = async () => {
            const btn = container.querySelector('#confirm-add-conn');
            btn.disabled = true;
            btn.innerText = 'Provisioning…';

            const payload = {
                name: container.querySelector('#new-conn-name').value,
                type: container.querySelector('#new-conn-type').value,
                url: container.querySelector('#new-conn-url').value,
                status: 'online'
            };

            try {
                const res = await addConnector(payload);
                if (res.ok) {
                    notify('Connector added to registry', 'success');
                    renderSettingsView(container);
                }
            } catch (e) {
                notify('Failed to add connector', 'error');
                btn.disabled = false;
                btn.innerText = 'Add Connector';
            }
        };

        container.querySelectorAll('.delete-connector-btn').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Are you sure you want to remove this infrastructure from the registry?')) {
                    const id = btn.dataset.id;
                    await deleteConnector(id);
                    notify('Connector removed', 'success');
                    renderSettingsView(container);
                }
            };
        });

        // AI Engine — provider metadata
        const providerMeta = {
            openai:    { label: 'OpenAI API Key',    keyEnv: 'OPENAI_API_KEY',    placeholder: 'gpt-4o' },
            anthropic: { label: 'Anthropic API Key', keyEnv: 'ANTHROPIC_API_KEY', placeholder: 'claude-sonnet-4-6' },
            gemini:    { label: 'Gemini API Key',    keyEnv: 'GEMINI_API_KEY',    placeholder: 'gemini-2.0-flash' },
            groq:      { label: 'Groq API Key',      keyEnv: 'GROQ_API_KEY',      placeholder: 'llama-3.3-70b-versatile' },
        };

        const providerSelect = container.querySelector('#setting-llm-provider');
        const apiKeyInput    = container.querySelector('#setting-llm-key');
        const apiKeyLabel    = container.querySelector('#api-key-label');
        const modelInput     = container.querySelector('#setting-llm-model');
        const modelHint      = container.querySelector('#model-hint');

        function applyProviderUI(provider) {
            const meta = providerMeta[provider];
            apiKeyLabel.textContent = meta.label;
            apiKeyInput.value = '';
            apiKeyInput.placeholder = secretPlaceholder(meta.keyEnv, 'Enter API key');
            modelHint.textContent = `Default: ${meta.placeholder}`;
            if (!modelInput.value) modelInput.placeholder = meta.placeholder;
        }

        // Init with current provider
        applyProviderUI(providerSelect.value);

        providerSelect.onchange = (e) => applyProviderUI(e.target.value);

        container.querySelector('#save-ai-btn').onclick = async () => {
            const btn = container.querySelector('#save-ai-btn');
            const provider = providerSelect.value;
            const meta = providerMeta[provider];
            const keyVal = apiKeyInput.value.trim();
            const payload = {
                LLM_PROVIDER: provider,
                LLM_MODEL:    modelInput.value.trim(),
            };
            // Only overwrite the API key if the user actually entered a new one.
            if (keyVal) payload[meta.keyEnv] = keyVal;
            env.LLM_PROVIDER = provider;
            env.LLM_MODEL    = modelInput.value.trim();
            setBtnState(btn, 'loading', 'Saving…');
            try {
                const res = await updateEnvSettings(payload);
                showFeedback('ai-feedback', res.ok, res.ok ? 'AI config saved' : 'Save failed — check backend logs');
            } catch (e) {
                showFeedback('ai-feedback', false, e.message);
            } finally {
                setBtnState(btn, 'idle', 'Save AI Config');
            }
        };

        container.querySelector('#save-env-btn').onclick = async () => {
            const btn = container.querySelector('#save-env-btn');
            setBtnState(btn, 'loading', 'Saving…');
            const teams = container.querySelector('#setting-teams-url').value.trim();
            const payload = {};
            if (teams) payload.TEAMS_WEBHOOK_URL = teams;
            try {
                const res = await updateEnvSettings(payload);
                showFeedback('notif-feedback', res.ok, res.ok ? 'Settings saved' : 'Save failed — check backend logs');
            } catch (e) {
                showFeedback('notif-feedback', false, e.message);
            } finally {
                setBtnState(btn, 'idle', 'Save');
            }
        };

        function readConfluenceForm() {
            return {
                confluence_type:          container.querySelector('#setting-conf-type').value,
                confluence_url:           container.querySelector('#setting-conf-url').value.trim(),
                confluence_email:         container.querySelector('#setting-conf-email').value.trim(),
                confluence_api_token:     container.querySelector('#setting-conf-token').value.trim(),
                confluence_root_page_url: container.querySelector('#setting-conf-page').value.trim(),
            };
        }

        function showFeedback(elementId, ok, message) {
            const el = container.querySelector(`#${elementId}`);
            if (!el) return;
            el.style.background  = ok ? '#ECFFFD' : '#FFF2F2';
            el.style.color       = ok ? '#007B51' : '#CC0909';
            el.style.borderColor = ok ? '#B0EFDA' : '#FCDEDE';
            el.style.border      = '1px solid';
            el.className = 'text-xs font-mono px-3 py-2 rounded';
            el.textContent = (ok ? '✓ ' : '✗ ') + message;
        }

        function showConfluenceFeedback(ok, message) {
            showFeedback('confluence-feedback', ok, message);
        }

        function setBtnState(btn, state, label) {
            btn.disabled = state === 'loading';
            btn.textContent = label;
            btn.classList.toggle('opacity-50', state === 'loading');
        }

        container.querySelector('#test-confluence-btn').onclick = async () => {
            const btn = container.querySelector('#test-confluence-btn');
            setBtnState(btn, 'loading', 'Testing…');
            try {
                const result = await pingConfluence(readConfluenceForm());
                showConfluenceFeedback(result.ok, result.message);
            } catch (e) {
                showConfluenceFeedback(false, e.message);
            } finally {
                setBtnState(btn, 'idle', 'Test Connection');
            }
        };

        container.querySelector('#save-confluence-btn').onclick = async () => {
            const btn = container.querySelector('#save-confluence-btn');
            setBtnState(btn, 'loading', 'Saving…');
            try {
                const form = readConfluenceForm();
                const payload = {
                    CONFLUENCE_TYPE:          form.confluence_type,
                    CONFLUENCE_URL:           form.confluence_url,
                    CONFLUENCE_EMAIL:         form.confluence_email,
                    CONFLUENCE_ROOT_PAGE_URL: form.confluence_root_page_url,
                };
                // Only overwrite the token if the user entered a new one.
                if (form.confluence_api_token) payload.CONFLUENCE_API_TOKEN = form.confluence_api_token;
                const res = await updateEnvSettings(payload);
                if (res.ok) showConfluenceFeedback(true, 'Settings saved');
                else showConfluenceFeedback(false, 'Save failed — check backend logs');
            } catch (e) {
                showConfluenceFeedback(false, e.message);
            } finally {
                setBtnState(btn, 'idle', 'Save Config');
            }
        };

    } catch (e) {
        container.innerHTML = `<div class="p-20 text-center text-danger-500 font-bold">REGISTRY SYNC FAILED: ${e.message}</div>`;
    }
}
