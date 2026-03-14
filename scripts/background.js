let isRecording = false;
let currentSession = [];
let networkRequests = [];
let lastActionTime = 0;
let attachedTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

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
      const actionWithDelay = { 
        ...message.action, 
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
    sendResponse({ isRecording });
  }
});

function startNetworkRecording(tabId) {
  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) return;
    chrome.debugger.sendCommand({ tabId }, 'Network.enable');
  });
}

function stopNetworkRecording(tabId) {
  chrome.debugger.detach({ tabId }, () => {
    // Ignore error if already detached
    if (chrome.runtime.lastError) return;
  });
}

// Handle navigation: re-attach if tab reloads
chrome.webNavigation.onCommitted.addListener((details) => {
  if (isRecording && attachedTabId === details.tabId && details.frameId === 0) {
    // Briefly delay to allow tab to register
    setTimeout(() => {
      chrome.debugger.sendCommand({ tabId: details.tabId }, 'Network.enable', {}, () => {
        if (chrome.runtime.lastError) {
          // Re-attach if lost
          startNetworkRecording(details.tabId);
        }
      });
    }, 500);
  }
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!isRecording || source.tabId !== attachedTabId) return;

  if (method === 'Network.requestWillBeSent') {
    const { request, timestamp, wallTime } = params;
    
    // Ignore data: URLs and extension internal calls
    if (request.url.startsWith('data:') || request.url.startsWith('chrome-extension:')) return;

    networkRequests.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      postData: request.postData,
      timestamp: wallTime * 1000 // Convert to ms
    });
    console.log('API Call captured:', request.url);
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
