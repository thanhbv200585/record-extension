document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const methodSelect = document.getElementById('method-select');
    const urlInput = document.getElementById('url-input');
    const sendBtn = document.getElementById('send-btn');
    const themeToggle = document.getElementById('theme-toggle');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    const paramsRows = document.getElementById('params-rows');
    const headersRows = document.getElementById('headers-rows');
    const addRowBtns = document.querySelectorAll('.add-row-btn');
    
    const bodyRadioBtns = document.querySelectorAll('input[name="body-type"]');
    const bodyEditor = document.getElementById('body-editor');
    
    const responseMeta = document.getElementById('response-meta');
    const responseStatus = document.getElementById('res-status');
    const responseTime = document.getElementById('res-time');
    const responseSize = document.getElementById('res-size');
    const responsePlaceholder = document.getElementById('response-placeholder');
    const responseContent = document.getElementById('response-content');
    const responseViewer = document.getElementById('response-viewer');
    const resHeadersDisplay = document.getElementById('res-headers-display');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Modal Elements
    const importCurlBtn = document.getElementById('import-curl-btn');
    const modal = document.getElementById('curl-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelImportBtn = document.getElementById('cancel-import');
    const confirmImportBtn = document.getElementById('confirm-import');
    const curlPasteArea = document.getElementById('curl-paste-area');

    // --- Tab Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            const parent = btn.closest('.tabs-container');
            
            // Deactivate all siblings in this container
            parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            // Activate current
            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // --- KV Editor Logic ---
    function createKVRow(key = '', value = '') {
        const row = document.createElement('div');
        row.className = 'kv-row';
        row.innerHTML = `
            <input type="text" placeholder="Key" class="kv-key" value="${key}">
            <input type="text" placeholder="Value" class="kv-value" value="${value}">
            <button class="remove-row-btn" title="Remove">&times;</button>
        `;
        
        row.querySelector('.remove-row-btn').addEventListener('click', () => {
            row.remove();
        });
        
        return row;
    }

    addRowBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            const container = document.getElementById(`${type}-rows`);
            container.appendChild(createKVRow());
        });
    });

    // --- Body Type Logic ---
    bodyRadioBtns.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'none') {
                bodyEditor.parentElement.classList.add('hidden');
            } else {
                bodyEditor.parentElement.classList.remove('hidden');
                if (radio.value === 'json') {
                    bodyEditor.placeholder = '{ "key": "value" }';
                } else {
                    bodyEditor.placeholder = 'Enter raw body text...';
                }
            }
        });
    });

    // --- Theme Toggle ---
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        themeToggle.textContent = document.body.classList.contains('light-theme') ? '🌙' : '🌓';
    });

    // --- Modal Logic ---
    importCurlBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        curlPasteArea.value = '';
        curlPasteArea.focus();
    });

    const closeModal = () => modal.classList.add('hidden');
    closeModalBtn.addEventListener('click', closeModal);
    cancelImportBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    confirmImportBtn.addEventListener('click', () => {
        const curl = curlPasteArea.value.trim();
        if (!curl) return;
        
        try {
            const request = parseCurl(curl);
            applyParsedRequest(request);
            closeModal();
        } catch (e) {
            console.error('Parsing failed:', e);
            alert('Failed to parse cURL command. Please make sure it is a valid cURL string.');
        }
    });

    // --- cURL Parser ---
    function parseCurl(curlString) {
        const request = {
            method: 'GET',
            url: '',
            headers: {},
            body: ''
        };

        // Normalize string: handle both \ and ^ as line continuations
        // and handle Windows-style ^ escaping
        let normalized = curlString
            .replace(/[\\^]\n/g, ' ')      // Line continuations
            .replace(/\^([\\^"{}])/g, '$1') // Unescape common characters escaped with ^
            .replace(/\s+/g, ' ');         // Multiple spaces to single space
        
        // Extract URL
        // Improved to handle URLs that might not be quoted or use different quotes
        const urlMatch = normalized.match(/(?:--url\s+)?['"]?(https?:\/\/[^'"\s]+)['"]?/) || 
                        normalized.match(/(?:^| )['"]?(https?:\/\/[^'"\s]+)['"]?/);
        if (urlMatch) request.url = urlMatch[1];

        // Extract Method
        const methodMatch = normalized.match(/-X\s+['"]?(\w+)['"]?|--request\s+['"]?(\w+)['"]?/i);
        if (methodMatch) request.method = (methodMatch[1] || methodMatch[2]).toUpperCase();

        // Extract Headers
        // Improved to handle common header formats
        const headerRegex = /-(?:H|--header)\s+(['"])(.*?)\1|-(?:H|--header)\s+([^-\s][\S]*)/g;
        let headerMatch;
        while ((headerMatch = headerRegex.exec(normalized)) !== null) {
            const fullHeader = headerMatch[2] || headerMatch[3];
            if (fullHeader) {
                const [key, ...valueParts] = fullHeader.split(':');
                if (key) {
                    request.headers[key.trim()] = valueParts.join(':').trim();
                }
            }
        }

        // Extract Body
        // Handle various data flags and try to capture the full body content
        const bodyRegex = /--(?:data|data-raw|data-binary|data-ascii|data-urlencode)\s+(['"])([\s\S]*?)\1|-(?:d)\s+(['"])([\s\S]*?)\3/g;
        let bodyMatch;
        // Take the last one if multiple exist
        while ((bodyMatch = bodyRegex.exec(normalized)) !== null) {
            request.body = bodyMatch[2] || bodyMatch[4];
            if (request.method === 'GET') request.method = 'POST';
        }

        return request;
    }

    function applyParsedRequest(request) {
        // Apply URL and Method
        urlInput.value = request.url;
        methodSelect.value = request.method;

        // Apply Headers
        headersRows.innerHTML = '';
        Object.entries(request.headers).forEach(([key, value]) => {
            headersRows.appendChild(createKVRow(key, value));
        });
        if (Object.keys(request.headers).length === 0) {
            headersRows.appendChild(createKVRow());
        }

        // Apply Body
        if (request.body) {
            bodyEditor.value = request.body;
            try {
                JSON.parse(request.body);
                document.querySelector('input[name="body-type"][value="json"]').checked = true;
            } catch (e) {
                document.querySelector('input[name="body-type"][value="raw"]').checked = true;
            }
            bodyEditor.parentElement.classList.remove('hidden');
        } else {
            bodyEditor.value = '';
            document.querySelector('input[name="body-type"][value="none"]').checked = true;
            bodyEditor.parentElement.classList.add('hidden');
        }
        
        // Clear Params (since they are usually in the URL)
        paramsRows.innerHTML = '';
        paramsRows.appendChild(createKVRow());
    }

    // --- Send Request ---
    sendBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const method = methodSelect.value;
        
        if (!url) {
            alert('Please enter a URL');
            return;
        }

        // Show loading
        loadingOverlay.classList.remove('hidden');
        responsePlaceholder.classList.add('hidden');
        responseContent.classList.add('hidden');

        const startTime = Date.now();

        try {
            // Collect Params
            const params = new URLSearchParams();
            document.querySelectorAll('#params-rows .kv-row').forEach(row => {
                const key = row.querySelector('.kv-key').value;
                const val = row.querySelector('.kv-value').value;
                if (key) params.append(key, val);
            });

            const finalUrl = params.toString() ? `${url}${url.includes('?') ? '&' : '?'}${params.toString()}` : url;

            // Collect Headers
            const headers = {};
            document.querySelectorAll('#headers-rows .kv-row').forEach(row => {
                const key = row.querySelector('.kv-key').value;
                const val = row.querySelector('.kv-value').value;
                if (key) headers[key] = val;
            });

            // Collect Body
            let body = null;
            const bodyType = document.querySelector('input[name="body-type"]:checked').value;
            if (bodyType !== 'none' && method !== 'GET') {
                body = bodyEditor.value;
            }

            const response = await fetch(finalUrl, {
                method,
                headers,
                body: method !== 'GET' ? body : undefined
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Process Response
            const data = await response.text();
            const size = (new Blob([data]).size / 1024).toFixed(2);

            // Update UI
            updateResponseUI(response, data, duration, size);

        } catch (error) {
            console.error('Request failed:', error);
            alert(`Request failed: ${error.message}`);
            responsePlaceholder.classList.remove('hidden');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    });

    function updateResponseUI(response, data, duration, size) {
        responseMeta.classList.remove('hidden');
        responseContent.classList.remove('hidden');
        
        // Status Badge
        responseStatus.textContent = `${response.status} ${response.statusText}`;
        responseStatus.className = 'status-badge';
        if (response.status >= 200 && response.status < 300) responseStatus.classList.add('status-2xx');
        else if (response.status >= 400 && response.status < 500) responseStatus.classList.add('status-4xx');
        else responseStatus.classList.add('status-5xx');

        responseTime.textContent = `${duration}ms`;
        responseSize.textContent = `${size} KB`;

        // Body Content
        try {
            const json = JSON.parse(data);
            responseViewer.textContent = JSON.stringify(json, null, 2);
        } catch (e) {
            responseViewer.textContent = data;
        }

        // Headers Display
        resHeadersDisplay.innerHTML = '';
        response.headers.forEach((value, name) => {
            const keyEl = document.createElement('div');
            keyEl.className = 'res-header-key';
            keyEl.textContent = name;
            
            const valEl = document.createElement('div');
            valEl.className = 'res-header-value';
            valEl.textContent = value;
            
            resHeadersDisplay.appendChild(keyEl);
            resHeadersDisplay.appendChild(valEl);
        });
    }

    // Initial Params Row
    paramsRows.appendChild(createKVRow());
});
