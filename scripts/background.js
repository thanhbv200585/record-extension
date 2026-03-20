console.log('🚀 [AutoFlow] Background Service Worker Started at:', new Date().toLocaleTimeString());

let isRecording = false;
let currentSession = [];
let networkRequests = [];
let lastActionTime = 0;
let attachedTabId = null;
let mockingActive = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📬 [AutoFlow] Message received:', message.type, message);

  if (message.type === 'START_RECORDING') {
    isRecording = true;
    currentSession = [];
    networkRequests = [];
    lastActionTime = Date.now();

    // Attach debugger to capture API calls
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab) {
        attachedTabId = activeTab.id;
        startNetworkRecording(attachedTabId);
      }
    });

    notifyContentScripts({ type: 'RECORDING_STATE_CHANGED', isRecording: true });
    sendResponse({ status: 'started' });
  }

  else if (message.type === 'STOP_RECORDING') {
    isRecording = false;
    if (attachedTabId) {
      stopNetworkRecording(attachedTabId);
      attachedTabId = null;
    }

    notifyContentScripts({ type: 'RECORDING_STATE_CHANGED', isRecording: false });
    // Save to storage
    chrome.storage.local.get({ sessions: [] }, (data) => {
      const sessions = data.sessions;
      const newSession = {
        id: Date.now(),
        name: `Session ${new Date().toLocaleString()}`,
        actions: currentSession,
        networkRequests: networkRequests
      };
      sessions.push(newSession);
      chrome.storage.local.set({ sessions }, () => {
        sendResponse({ status: 'stopped', session: newSession });
      });
    });
    return true;
  }

  else if (message.type === 'RECORD_ACTION') {
    if (isRecording) {
      const now = Date.now();
      const delay = now - lastActionTime;
      const action = message.action;

      // Coalescing logic for 'input' actions
      if (action.type === 'input' && currentSession.length > 0) {
        const lastAction = currentSession[currentSession.length - 1];
        if (lastAction.type === 'input' && lastAction.selector === action.selector) {
          // Update the previous input value instead of adding a new action
          lastAction.value = action.value;
          lastActionTime = now;
          console.log('Action coalesced (input):', action.value);
          return;
        }
      }

      const actionWithDelay = {
        ...action,
        timestamp: now,
        delay: delay > 5000 ? 2000 : delay // Cap delay to 2 seconds for efficiency, or keep real? Let's keep real but cap at 5s.
      };
      currentSession.push(actionWithDelay);
      lastActionTime = now;
      console.log('Action recorded with delay:', actionWithDelay);
    }
  }

  else if (message.type === 'REPLAY_FILE') {
    const tabId = sender.tab.id;
    const { selector, filePath } = message;

    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) {
        console.error('Debugger attach failed:', chrome.runtime.lastError.message);
        sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        return;
      }

      chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', {}, (doc) => {
        chrome.debugger.sendCommand({ tabId }, 'DOM.querySelector', {
          nodeId: doc.root.nodeId,
          selector: selector
        }, (result) => {
          if (result && result.nodeId) {
            chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
              nodeId: result.nodeId,
              files: [filePath.trim()]
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Debugger setFileInputFiles failed:', chrome.runtime.lastError.message);
                chrome.debugger.detach({ tabId });
                sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
              } else {
                chrome.debugger.detach({ tabId });
                console.log('File set via Debugger:', filePath);
                sendResponse({ status: 'success' });
              }
            });
          } else {
            chrome.debugger.detach({ tabId });
            sendResponse({ status: 'error', message: 'Element matching selector not found in debugger' });
          }
        });
      });
    });
    return true; // Keep channel open for async response
  }

  else if (message.type === 'GET_STATE') {
    sendResponse({ isRecording, mockingActive });
  }

  else if (message.type === 'UPDATE_MOCKING_STATE') {
    console.log('🔔 [Mocking] State update received from Dashboard');
    chrome.storage.local.get(['mockingEnabled'], (data) => {
      mockingActive = !!data.mockingEnabled;
      console.log('🎭 [Mocking] System active in storage:', mockingActive);
      
      if (mockingActive) {
        // Find the active tab that isn't an extension page
        chrome.tabs.query({ active: true }, (tabs) => {
          const targetTab = tabs.find(t => !t.url.startsWith('chrome-extension://'));
          if (targetTab) {
            console.log('🎯 [Mocking] Target tab identified:', targetTab.id, targetTab.url);
            attachedTabId = targetTab.id;
            ensureDebuggerAttached(attachedTabId);
          } else {
            console.warn('❓ [Mocking] Could not find a suitable target tab to attach to.');
          }
        });
      } else if (!isRecording) {
        if (attachedTabId) {
          console.log('🔌 [Mocking] Detaching debugger from:', attachedTabId);
          chrome.debugger.detach({ tabId: attachedTabId }, () => {
            if (chrome.runtime.lastError) {}
            attachedTabId = null;
          });
        }
      }
    });
  }
});

function ensureDebuggerAttached(tabId) {
  console.log('🛠️ [Debugger] Ensuring attachment to:', tabId);
  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message;
      if (msg.includes('already attached')) {
          console.log('ℹ️ [Debugger] Already attached.');
          setupDomains(tabId);
      } else {
          console.error('❌ [Debugger] Attach FAILED:', msg);
      }
      return;
    }
    console.log('🔗 [Debugger] Attached successfully');
    setupDomains(tabId);
  });
}

function setupDomains(tabId) {
  console.log('⚙️ [Debugger] Setting up domains for tab:', tabId);
  if (isRecording) {
    chrome.debugger.sendCommand({ tabId }, 'Network.enable');
  }
  
  chrome.storage.local.get(['mockingEnabled'], (data) => {
    if (data.mockingEnabled) {
      console.log('🎭 [Mocking] Enabling Fetch domain interception for *...');
      chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
        patterns: [{ urlPattern: '*', requestStage: 'Request' }]
      }, () => {
          if (chrome.runtime.lastError) {
              console.error('❌ [Mocking] Fetch.enable FAILED:', chrome.runtime.lastError.message);
          } else {
              console.log('✅ [Mocking] FETCH DOMAIN IS ACTIVE. Interception starting.');
          }
      });
    } else {
      console.log('🎭 [Mocking] Disabling Fetch domain.');
      chrome.debugger.sendCommand({ tabId }, 'Fetch.disable');
    }
  });
}

function startNetworkRecording(tabId) {
  ensureDebuggerAttached(tabId);
}

function stopNetworkRecording(tabId) {
  chrome.debugger.detach({ tabId }, () => {
    // Ignore error if already detached
    if (chrome.runtime.lastError) return;
  });
}

// Handle navigation: re-attach if tab reloads
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;

  chrome.storage.local.get(['mockingEnabled'], (data) => {
    if (isRecording || data.mockingEnabled) {
      attachedTabId = details.tabId;
      // Small delay to ensure tab is ready for debugger
      setTimeout(() => {
        ensureDebuggerAttached(details.tabId);
      }, 500);
    }
  });
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId !== attachedTabId) return;

  if (method === 'Network.requestWillBeSent') {
    const { request, requestId, wallTime } = params;

    if (request.url.startsWith('data:') || request.url.startsWith('chrome-extension:')) return;

    // Track request
    networkRequests.push({
      requestId,
      url: request.url,
      method: request.method,
      headers: request.headers,
      requestBody: request.postData || null,
      timestamp: wallTime * 1000
    });
  }

  if (method === 'Network.responseReceived' && isRecording) {
    const { requestId, response } = params;
    const req = networkRequests.find(r => r.requestId === requestId);
    if (!req) return;

    req.status = response.status;
    req.mimeType = response.mimeType;
    req.responseHeaders = response.headers;

    // Only fetch body for JSON/Text to save space and avoid binary issues
    if (response.mimeType.includes('json') || response.mimeType.includes('text')) {
      chrome.debugger.sendCommand({ tabId: source.tabId }, 'Network.getResponseBody', { requestId }, (result) => {
        if (chrome.runtime.lastError || !result) return;
        req.responseBody = result.body;
      });
    }
  }

  if (method === 'Fetch.requestPaused') {
    const { requestId, request } = params;
    console.log('🔍 [Mocking] Intercepted:', request.method, request.url);

    chrome.storage.local.get({ mocks: [], mockingEnabled: false }, (data) => {
      if (!data.mockingEnabled) {
        console.log('⚠️ [Mocking] System is DISABLED');
        chrome.debugger.sendCommand({ tabId: source.tabId }, 'Fetch.continueRequest', { requestId });
        return;
      }

      console.log('📄 [Mocking] Active rules:', data.mocks.length);

      const match = data.mocks.find(m => {
        if (!m.enabled) return false;
        if (m.method && m.method !== request.method) return false;

        try {
          // Escape special regex characters except *
          let escaped = m.urlPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
          const pattern = escaped.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          const isMatch = regex.test(request.url);
          console.log(`🧪 [Mocking] Testing: "${m.urlPattern}" vs "${request.url}" -> ${isMatch ? '✅ MATCH' : '❌ NO'}`);
          return isMatch;
        } catch (e) {
          console.error('❌ [Mocking] Regex error for pattern:', m.urlPattern, e);
          return false;
        }
      });

      if (match) {
        console.log('🚀 [Mocking] Fulfilling with mock data for:', request.url);

        // Robust UTF-8 to Base64 for Chrome
        const bytes = new TextEncoder().encode(match.responseBody);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Body = btoa(binary);

        chrome.debugger.sendCommand({ tabId: source.tabId }, 'Fetch.fulfillRequest', {
          requestId,
          responseCode: match.status,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' },
            { name: 'X-Mocked-By', value: 'AutoFlow-Recorder' }
          ],
          body: base64Body
        });
      } else {
        chrome.debugger.sendCommand({ tabId: source.tabId }, 'Fetch.continueRequest', { requestId });
      }
    });
  }
});

function notifyContentScripts(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message).catch(err => {
        // Ignore errors
      });
    });
  });
}
