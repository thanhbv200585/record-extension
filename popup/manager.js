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

    // Mocks UI
    const tabNetwork = document.getElementById('tab-network');
    const tabMocks = document.getElementById('tab-mocks');
    const networkView = document.getElementById('network-log-view');
    const mockView = document.getElementById('mock-manager-view');
    const mockList = document.getElementById('mock-list');
    const addMockBtn = document.getElementById('add-mock');
    const enableMockingCheckbox = document.getElementById('enable-mocking');

    let currentEditingSession = null;
    let localVariables = {};
    let localMocks = [];

    // Initial load
    refreshAll();

    // Tab Switching
    tabNetwork.addEventListener('click', () => {
        tabNetwork.classList.add('active-tab');
        tabNetwork.style.color = 'var(--text-main)';
        tabMocks.classList.remove('active-tab');
        tabMocks.style.color = 'var(--text-dim)';
        networkView.style.display = 'flex';
        mockView.style.display = 'none';
    });

    tabMocks.addEventListener('click', () => {
        tabMocks.classList.add('active-tab');
        tabMocks.style.color = 'var(--text-main)';
        tabNetwork.classList.remove('active-tab');
        tabNetwork.style.color = 'var(--text-dim)';
        mockView.style.display = 'flex';
        networkView.style.display = 'none';
        renderMocks();
    });

    addMockBtn.addEventListener('click', () => {
        const urlPattern = prompt('Enter URL Pattern to match (e.g. /api/user/*):', '');
        if (!urlPattern) return;

        const newMock = {
            id: Date.now(),
            urlPattern: urlPattern,
            method: 'GET',
            status: 200,
            responseBody: '{"message": "Mocked response"}',
            enabled: true
        };

        localMocks.push(newMock);
        saveMocks();
        renderMocks();
    });

    enableMockingCheckbox.addEventListener('change', (e) => {
        chrome.storage.local.set({ mockingEnabled: e.target.checked }, () => {
            chrome.runtime.sendMessage({ type: 'UPDATE_MOCKING_STATE' });
        });
        showSaveBanner(e.target.checked ? 'API Mocking Enabled' : 'API Mocking Disabled');
    });

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
        loadMocks();
    }

    function loadMocks() {
        chrome.storage.local.get({ mocks: [], mockingEnabled: false }, (data) => {
            localMocks = data.mocks || [];
            enableMockingCheckbox.checked = !!data.mockingEnabled;
            renderMocks();
        });
    }

    function saveMocks() {
        chrome.storage.local.set({ mocks: localMocks });
    }

    function renderMocks() {
        mockList.innerHTML = '';
        if (localMocks.length === 0) {
            mockList.innerHTML = '<div style="color: var(--text-dim); text-align: center; margin-top: 20px; font-size: 11px;">No mock rules defined</div>';
            return;
        }

        localMocks.forEach((mock, index) => {
            const div = document.createElement('div');
            div.className = 'mock-item';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <span class="mock-badge">${mock.method}</span>
                        <input type="text" class="mock-pattern-input" value="${mock.urlPattern}" style="background: transparent; border: none; color: var(--text-main); font-family: monospace; font-size: 11px; width: 180px;" title="URL Pattern">
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <input type="checkbox" ${mock.enabled ? 'checked' : ''} class="mock-toggle" title="Toggle this rule">
                        <button class="delete-mock small-btn" style="padding: 2px 4px;">×</button>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 10px; color: var(--text-dim); align-self: center;">Status:</span>
                    <input type="number" class="mock-status-input" value="${mock.status}" style="width: 50px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fbbf24; font-size: 10px; border-radius: 4px; padding: 2px 4px;">
                    <select class="mock-method-select" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); font-size: 10px; border-radius: 4px;">
                        <option value="GET" ${mock.method === 'GET' ? 'selected' : ''}>GET</option>
                        <option value="POST" ${mock.method === 'POST' ? 'selected' : ''}>POST</option>
                        <option value="PUT" ${mock.method === 'PUT' ? 'selected' : ''}>PUT</option>
                        <option value="DELETE" ${mock.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                        <option value="PATCH" ${mock.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
                    </select>
                </div>
                <textarea class="mock-body-input" style="width: 100%; height: 60px; background: #000; border: 1px solid rgba(255,255,255,0.05); color: #10b981; font-family: monospace; font-size: 10px; border-radius: 8px; padding: 8px; resize: vertical;" placeholder="Response Body (JSON)">${mock.responseBody}</textarea>
            `;

            const patternInput = div.querySelector('.mock-pattern-input');
            const statusInput = div.querySelector('.mock-status-input');
            const methodSelect = div.querySelector('.mock-method-select');
            const bodyInput = div.querySelector('.mock-body-input');
            const toggle = div.querySelector('.mock-toggle');

            const update = () => {
                mock.urlPattern = patternInput.value;
                mock.status = parseInt(statusInput.value);
                mock.method = methodSelect.value;
                mock.responseBody = bodyInput.value;
                mock.enabled = toggle.checked;
                saveMocks();
            };

            patternInput.addEventListener('change', update);
            statusInput.addEventListener('change', update);
            methodSelect.addEventListener('change', update);
            bodyInput.addEventListener('change', update);
            toggle.addEventListener('change', update);

            div.querySelector('.delete-mock').addEventListener('click', () => {
                localMocks.splice(index, 1);
                saveMocks();
                renderMocks();
            });

            mockList.appendChild(div);
        });
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
                        <button class="curl-btn">Copy cURL</button>
                        <button class="replay-btn">Re-execute</button>
                        <button class="create-mock-btn" style="background: rgba(129, 140, 248, 0.2); color: #818cf8; border-color: rgba(129, 140, 248, 0.3);">Mock this</button>
                        <div style="font-size: 10px; color: var(--text-dim); align-self: center; margin-left: auto; word-break: break-all;">${req.url}</div>
                    </div>
                    
                    <div class="payload-box">
                        <div class="payload-title">
                            Request Headers 
                            <button class="copy-btn" data-type="headers" data-target="req-headers">Copy</button>
                        </div>
                        <div class="req-headers" style="font-family: monospace; font-size: 11px; padding: 10px; background:#111; border-radius:8px; line-height:1.4; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
                            ${headersHtml(req.headers)}
                        </div>
                    </div>

                    <div class="payload-box">
                        <div class="payload-title">
                            Response Headers
                            <button class="copy-btn" data-type="headers" data-target="res-headers">Copy</button>
                        </div>
                        <div class="res-headers" style="font-family: monospace; font-size: 11px; padding: 10px; background:#111; border-radius:8px; line-height:1.4; border: 1px solid rgba(255,255,255,0.05);">
                            ${headersHtml(req.responseHeaders)}
                        </div>
                    </div>

                    ${reqBody ? `
                        <div class="payload-box">
                            <div class="payload-title">
                                Request Body
                                <button class="copy-btn" data-target="req-body">Copy</button>
                            </div>
                            <pre class="payload-content req-body">${reqBody}</pre>
                        </div>
                    ` : ''}

                    ${resBody ? `
                        <div class="payload-box">
                            <div class="payload-title">
                                Response Body
                                <button class="copy-btn" data-target="res-body">Copy</button>
                            </div>
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

            // Copy logic
            item.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetClass = btn.getAttribute('data-target');
                    const targetEl = item.querySelector(`.${targetClass}`);
                    let textToCopy = '';

                    if (btn.getAttribute('data-type') === 'headers') {
                        textToCopy = Array.from(targetEl.querySelectorAll('div'))
                            .map(div => div.innerText.trim())
                            .join('\n');
                    } else {
                        textToCopy = targetEl.innerText;
                    }

                    copyText(textToCopy, btn);
                });
            });

            // cURL logic
            item.querySelector('.curl-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const curl = generateCurl(req);
                copyText(curl, item.querySelector('.curl-btn'));
            });

            // Re-execute logic
            item.querySelector('.replay-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                reExecuteRequest(req, item.querySelector('.replay-btn'));
            });

            // Create Mock logic
            item.querySelector('.create-mock-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const url = new URL(req.url);
                const mock = {
                    id: Date.now(),
                    urlPattern: `*${url.pathname}${url.search ? url.search : ''}*`,
                    method: req.method,
                    status: req.status || 200,
                    responseBody: resBody || '{}',
                    enabled: true
                };
                localMocks.unshift(mock);
                saveMocks();
                showSaveBanner('Mock rule created!');
                
                // Switch to mocks tab
                tabMocks.click();
            });





            networkLogList.appendChild(item);
        });
    }



    function generateCurl(req) {
        let curl = `curl '${req.url}' \\\n  -X '${req.method}'`;

        if (req.headers) {
            Object.entries(req.headers).forEach(([k, v]) => {
                curl += ` \\\n  -H '${k}: ${v}'`;
            });
        }

        if (req.requestBody) {
            curl += ` \\\n  --data-raw '${req.requestBody}'`;
        }

        return curl;
    }

    function reExecuteRequest(req, btn) {
        if (btn.classList.contains('loading')) return;

        const originalText = btn.textContent;
        btn.textContent = 'Executing...';
        btn.classList.add('loading');

        const options = {
            method: req.method,
            headers: req.headers
        };

        if (req.method !== 'GET' && req.method !== 'HEAD' && req.requestBody) {
            options.body = req.requestBody;
        }

        fetch(req.url, options)
            .then(async (res) => {
                const status = res.status;
                const text = await res.text();
                alert(`Execution Result:\nStatus: ${status}\n\nResponse snippet:\n${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`);
            })
            .catch(err => {
                alert(`Execution Failed:\n${err.message}`);
            })
            .finally(() => {
                btn.textContent = originalText;
                btn.classList.remove('loading');
            });
    }

    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 2000);
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
