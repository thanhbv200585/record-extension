document.addEventListener('DOMContentLoaded', () => {
    const addVarBtn = document.getElementById('add-var');
    const sideSessionList = document.getElementById('side-session-list');
    const editingName = document.getElementById('editing-session-name');
    const stepEditorList = document.getElementById('step-editor-list');
    const saveBtn = document.getElementById('save-flow');
    const variableList = document.getElementById('variable-list');
    const saveBanner = document.getElementById('save-banner');

    const networkLogList = document.getElementById('network-log-list');
    const networkStats = document.getElementById('network-stats');
    const sessionStats = document.getElementById('session-stats');

    let currentEditingSession = null;
    let localVariables = {};

    // Initial load
    refreshAll();

    addVarBtn.addEventListener('click', () => {
        const key = prompt('Enter variable name (e.g. USER_ID):');
        if (key && !localVariables[key]) {
            localVariables[key] = '';
            saveVariables();
            renderVariables();
        }
    });

    saveBtn.addEventListener('click', () => {
        if (!currentEditingSession) return;

        // Collect steps from UI
        const stepItems = stepEditorList.querySelectorAll('.step-item');
        const updatedActions = currentEditingSession.actions.map((action, idx) => {
            const input = stepItems[idx].querySelector('.step-input');
            if (input) {
                return { ...action, value: input.value };
            }
            return action;
        });

        currentEditingSession.actions = updatedActions;
        saveSession(currentEditingSession);
    });

    function refreshAll() {
        loadSessions();
        loadVariables();
    }

    function loadSessions() {
        chrome.storage.local.get({ sessions: [] }, (data) => {
            sideSessionList.innerHTML = '';
            data.sessions.slice().reverse().forEach(session => {
                const div = document.createElement('div');
                div.className = 'session-item';
                div.style.cursor = 'pointer';
                div.innerHTML = `
                    <div class="session-info">
                        <span class="session-name">${session.name}</span>
                        <div class="session-meta">${session.actions.length} steps</div>
                    </div>
                `;
                div.addEventListener('click', () => loadSessionEditor(session));
                sideSessionList.appendChild(div);
            });
        });
    }

    function loadVariables() {
        chrome.storage.local.get({ variables: {} }, (data) => {
            localVariables = data.variables || {};
            renderVariables();
        });
    }

    function renderVariables() {
        variableList.innerHTML = '';
        Object.entries(localVariables).forEach(([key, val]) => {
            const row = document.createElement('div');
            row.className = 'var-item';
            row.innerHTML = `
                <span style="font-size: 11px; width: 60px; overflow: hidden; text-overflow: ellipsis;" title="${key}">${key}</span>
                <input type="text" class="var-input" style="flex-grow: 1;" value="${val}" data-key="${key}">
                <button class="small-btn delete-var" style="padding: 2px 4px;">×</button>
            `;

            const input = row.querySelector('.var-input');
            input.addEventListener('change', (e) => {
                localVariables[key] = e.target.value;
                saveVariables();
            });

            row.querySelector('.delete-var').addEventListener('click', () => {
                delete localVariables[key];
                saveVariables();
                renderVariables();
            });

            variableList.appendChild(row);
        });
    }

    function saveVariables() {
        chrome.storage.local.set({ variables: localVariables }, () => {
            showSaveBanner('Variables updated');
        });
    }

    function loadSessionEditor(session) {
        currentEditingSession = session;
        editingName.textContent = `Editing: ${session.name}`;
        sessionStats.textContent = `${session.actions.length} steps • Recorded at ${new Date(session.id || session.timestamp).toLocaleString()}`;
        saveBtn.style.display = 'block';
        stepEditorList.innerHTML = '';

        renderNetworkLog(session);

        session.actions.forEach((action, index) => {
            const item = document.createElement('div');
            item.className = 'step-item';

            let valueField = '';
            if (action.type === 'input' || action.type === 'select') {
                valueField = `<input type="text" class="step-input" value="${action.value || ''}" placeholder="Value or {{variable}}">`;
            } else if (action.type === 'file') {
                valueField = `<div class="step-selector">File Path: ${action.value.filePath}</div>`;
            }

            // Map API calls to this step
            const nextAction = session.actions[index + 1];
            const startTime = action.timestamp;
            const endTime = nextAction ? nextAction.timestamp : (startTime + 2000);

            const triggeredRequests = (session.networkRequests || []).filter(req => {
                return req.timestamp >= startTime && req.timestamp < endTime;
            });

            let apiSection = '';
            if (triggeredRequests.length > 0) {
                apiSection = `
                    <div class="api-mapping" style="margin-top: 8px; border-top: 1px dashed rgba(251, 191, 36, 0.3); padding-top: 6px;">
                        <div style="font-size: 10px; color: #fbbf24; margin-bottom: 4px; font-weight: bold;">⚡ TRIGGERED API</div>
                        ${triggeredRequests.map(req => `
                            <div style="font-size: 10px; color: var(--text-dim); font-family: monospace; word-break: break-all; white-space: normal; line-height: 1.3; margin-bottom: 4px;">
                                <span style="color:#10b981; font-weight:bold;">${req.method}</span> ${new URL(req.url).pathname}
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            item.innerHTML = `
                <div class="step-index">${index + 1}</div>
                <div class="step-details">
                    <span class="step-type">${action.type}</span>
                    <span class="step-selector">${action.selector}</span>
                    ${valueField}
                    ${apiSection}
                </div>
                <button class="small-btn delete-step" title="Remove step">🗑️</button>
            `;

            item.querySelector('.delete-step').addEventListener('click', () => {
                if (confirm('Remove this step?')) {
                    session.actions.splice(index, 1);
                    loadSessionEditor(session);
                }
            });

            stepEditorList.appendChild(item);
        });
    }

    function renderNetworkLog(session) {
        const requests = session.networkRequests || [];
        networkStats.textContent = `${requests.length} requests captured`;
        networkLogList.innerHTML = '';

        if (requests.length === 0) {
            networkLogList.innerHTML = '<div style="color: var(--text-dim); text-align: center; margin-top: 20px;">No API calls captured for this session</div>';
            return;
        }

        requests.forEach((req, idx) => {
            const tryParse = (str) => {
                if (!str) return null;
                try { return JSON.stringify(JSON.parse(str), null, 2); }
                catch (e) { return str; }
            };

            const item = document.createElement('div');
            item.className = 'api-call-item';

            const reqBody = tryParse(req.requestBody);
            const resBody = tryParse(req.responseBody);

            const headersHtml = (headers) => {
                if (!headers) return 'None';
                return Object.entries(headers).map(([k, v]) => `<div><span style="color:#818cf8">${k}:</span> ${v}</div>`).join('');
            };

            item.innerHTML = `
                <div class="api-call-header">
                    <span class="api-method">${req.method}</span>
                    <span class="api-url" title="${req.url}">${new URL(req.url).pathname}</span>
                    <span class="api-status" style="color:${req.status >= 400 ? '#f38ba8' : '#fbbf24'}">${req.status || '---'}</span>
                </div>
                <div class="api-details">
                    <div style="display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <div style="font-size: 10px; color: var(--text-dim); align-self: center; margin-left: auto; word-break: break-all;">${req.url}</div>
                    </div>
                    
                    <div class="payload-box">
                        <div class="payload-title">Request Headers</div>
                        <div class="req-headers" style="font-family: monospace; font-size: 11px; padding: 10px; background:#111; border-radius:8px; line-height:1.4; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
                            ${headersHtml(req.headers)}
                        </div>
                    </div>

                    <div class="payload-box">
                        <div class="payload-title">Response Headers</div>
                        <div class="res-headers" style="font-family: monospace; font-size: 11px; padding: 10px; background:#111; border-radius:8px; line-height:1.4; border: 1px solid rgba(255,255,255,0.05);">
                            ${headersHtml(req.responseHeaders)}
                        </div>
                    </div>

                    ${reqBody ? `
                        <div class="payload-box">
                            <div class="payload-title">Request Body</div>
                            <pre class="payload-content req-body">${reqBody}</pre>
                        </div>
                    ` : ''}

                    ${resBody ? `
                        <div class="payload-box">
                            <div class="payload-title">Response Body</div>
                            <pre class="payload-content res-body">${resBody}</pre>
                        </div>
                    ` : ''}
                </div>
            `;

            // Expansion logic
            item.querySelector('.api-call-header').addEventListener('click', () => {
                const details = item.querySelector('.api-details');
                details.classList.toggle('expand');
            });





            networkLogList.appendChild(item);
        });
    }



    function saveSession(updatedSession) {
        chrome.storage.local.get({ sessions: [] }, (data) => {
            const sessions = data.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
            chrome.storage.local.set({ sessions }, () => {
                showSaveBanner('Flow saved successfully');
                loadSessions();
            });
        });
    }

    function showSaveBanner(text) {
        saveBanner.textContent = text;
        saveBanner.classList.add('show');
        setTimeout(() => saveBanner.classList.remove('show'), 2000);
    }
});
