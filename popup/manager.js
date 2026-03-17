document.addEventListener('DOMContentLoaded', () => {
    const sessionList = document.getElementById('side-session-list');
    const variableList = document.getElementById('variable-list');
    const stepEditorList = document.getElementById('step-editor-list');
    const editingName = document.getElementById('editing-session-name');
    const saveBtn = document.getElementById('save-flow');
    const addVarBtn = document.getElementById('add-var');
    const saveBanner = document.getElementById('save-banner');

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
            sessionList.innerHTML = '';
            data.sessions.slice().reverse().forEach(session => {
                const div = document.createElement('div');
                div.className = 'session-item';
                div.style.cursor = 'pointer';
                div.innerHTML = `
                    <div class="session-info">
                        <span class="session-name">${session.name}</span>
                        <span class="session-meta">${session.actions.length} steps</span>
                    </div>
                `;
                div.onclick = () => loadSessionEditor(session);
                sessionList.appendChild(div);
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
            input.onchange = (e) => {
                localVariables[key] = e.target.value;
                saveVariables();
            };

            row.querySelector('.delete-var').onclick = () => {
                delete localVariables[key];
                saveVariables();
                renderVariables();
            };

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
        saveBtn.style.display = 'block';
        stepEditorList.innerHTML = '';

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
                    <div class="api-mapping">
                        <div style="font-size: 10px; color: #fbbf24; margin-bottom: 4px; font-weight: bold;">⚡ TRIGGERED API CALLS</div>
                        ${triggeredRequests.map(req => `
                            <div class="api-call-item" title="${req.url}">
                                <span class="api-method">${req.method}</span>
                                <span class="api-url">${new URL(req.url).pathname}</span>
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

            item.querySelector('.delete-step').onclick = () => {
                if (confirm('Remove this step?')) {
                    session.actions.splice(index, 1);
                    loadSessionEditor(session);
                }
            };

            stepEditorList.appendChild(item);
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
