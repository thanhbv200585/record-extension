document.addEventListener('DOMContentLoaded', () => {
  const recordBtn = document.getElementById('record-toggle');
  const recordText = document.getElementById('record-text');
  const statusBadge = document.getElementById('status');
  const sessionList = document.getElementById('session-list');

  // Initialize UI
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    updateUI(response.isRecording);
  });

  loadSessions();

  const dashboardBtn = document.getElementById('open-dashboard');
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'popup/manager.html' });
  });

  // Export/Import listeners
  const importInput = document.getElementById('import-input');
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Handle both single session or array of sessions
        if (Array.isArray(data)) {
          let count = 0;
          data.forEach(s => {
            if (s.actions && Array.isArray(s.actions)) {
              saveSession(s, false); // Don't refresh list every time
              count++;
            }
          });
          loadSessions();
          showNotification(`Successfully imported ${count} flows!`);
        } else if (data.actions && Array.isArray(data.actions)) {
          saveSession(data);
          showNotification('Flow imported successfully!');
        } else {
          alert('Invalid session file format. Missing "actions" array.');
        }
      } catch (err) {
        console.error('Import error:', err);
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    importInput.value = ''; // Reset for next time
  });

  recordBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response.isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });
  });

  function saveSession(newSession, shouldRefresh = true) {
    chrome.storage.local.get({ sessions: [] }, (data) => {
      const sessions = data.sessions;
      const id = Date.now() + Math.floor(Math.random() * 1000); // More unique
      
      sessions.push({
        ...newSession,
        id: id,
        name: newSession.name.includes('(Imported)') ? newSession.name : `${newSession.name} (Imported)`
      });
      
      chrome.storage.local.set({ sessions }, () => {
        if (shouldRefresh) loadSessions();
      });
    });
  }

  function showNotification(text) {
    const badge = document.getElementById('status');
    const originalText = badge.textContent;
    const originalClass = badge.className;
    
    badge.textContent = text;
    badge.className = 'status-badge success'; // Blue/Green
    badge.style.background = 'rgba(34, 197, 94, 0.2)';
    badge.style.color = '#22c55e';
    
    setTimeout(() => {
      badge.textContent = originalText;
      badge.className = originalClass;
      badge.style.background = '';
      badge.style.color = '';
    }, 2500);
  }

  function startRecording() {
    chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (response) => {
      updateUI(true);
      window.close(); // Close popup to let user interact with the page
    });
  }

  function stopRecording() {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (response) => {
      updateUI(false);
      loadSessions();
    });
  }

  function updateUI(isRecording) {
    if (isRecording) {
      recordBtn.className = 'main-btn btn-stop';
      recordText.textContent = 'Stop Recording';
      statusBadge.textContent = 'Recording';
      statusBadge.className = 'status-badge recording';
    } else {
      recordBtn.className = 'main-btn btn-record';
      recordText.textContent = 'Start Recording';
      statusBadge.textContent = 'Idle';
      statusBadge.className = 'status-badge';
    }
  }

  function loadSessions() {
    chrome.storage.local.get({ sessions: [] }, (data) => {
      if (data.sessions.length === 0) {
        sessionList.innerHTML = '<div id="empty-state">No flows recorded yet</div>';
        return;
      }
      
      sessionList.innerHTML = '';
      
      data.sessions.slice().reverse().forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        item.innerHTML = `
          <div class="session-info">
            <span class="session-name">${session.name}</span>
            <span class="session-meta">${session.actions.length} steps</span>
          </div>
          <div class="session-controls" style="display:flex; gap:4px;">
            <button class="rename-btn small-btn" title="Rename Session" data-id="${session.id}">
              <span style="font-size: 10px;">✏️</span>
            </button>
            <button class="export-btn small-btn" title="Export JSON">
              <span style="font-size: 10px;">💾</span>
            </button>
            <button class="postman-btn small-btn" title="Export Postman Collection">
              <span style="font-size: 10px;">📮</span>
            </button>
            <button class="delete-btn small-btn" title="Delete" data-id="${session.id}">
              <span style="font-size: 10px;">🗑️</span>
            </button>
            <button class="play-btn small-btn" title="Play Result" data-id="${session.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        `;
        
        item.querySelector('.play-btn').addEventListener('click', () => {
          replaySession(session.actions);
        });

        item.querySelector('.rename-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          renameSession(session.id, session.name);
        });

        item.querySelector('.export-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          exportSession(session);
        });

        item.querySelector('.postman-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          exportToPostman(session);
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteSession(session.id);
        });
        
        sessionList.appendChild(item);
      });
    });
  }

  function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    chrome.storage.local.get({ sessions: [] }, (data) => {
      const sessions = data.sessions.filter(s => s.id !== sessionId);
      chrome.storage.local.set({ sessions }, () => {
        loadSessions();
      });
    });
  }

  function renameSession(sessionId, currentName) {
    const newName = prompt('Enter new name for this flow:', currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;

    chrome.storage.local.get({ sessions: [] }, (data) => {
      const sessions = data.sessions.map(s => {
        if (s.id === sessionId) {
          return { ...s, name: newName.trim() };
        }
        return s;
      });
      chrome.storage.local.set({ sessions }, () => {
        loadSessions();
      });
    });
  }

  function exportToPostman(session) {
    if (!session.networkRequests || session.networkRequests.length === 0) {
      alert('No API calls captured in this session.');
      return;
    }

    const postmanCollection = {
      info: {
        name: `AutoFlow: ${session.name}`,
        _postman_id: crypto.randomUUID(),
        description: "Exported from AutoFlow Recorder",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: session.networkRequests.map((req, index) => {
        const urlObj = new URL(req.url);
        return {
          name: `${req.method} ${urlObj.pathname}`,
          request: {
            method: req.method,
            header: Object.entries(req.headers).map(([key, value]) => ({
              key,
              value,
              type: "text"
            })),
            body: req.postData ? {
              mode: "raw",
              raw: req.postData
            } : undefined,
            url: {
              raw: req.url,
              protocol: urlObj.protocol.replace(':', ''),
              host: urlObj.hostname.split('.'),
              path: urlObj.pathname.split('/').filter(p => p),
              query: Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({
                key,
                value
              }))
            }
          }
        };
      })
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(postmanCollection, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${session.name}_postman.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function exportSession(session) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${session.name.replace(/\W/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function replaySession(actions) {
    if (actions.length === 0) return;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) return;

      const sendMessage = () => {
        chrome.tabs.sendMessage(activeTab.id, { type: 'REPLAY_SESSION', actions }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Connection failed, attempting injection...');
            injectAndPlay();
          } else {
            console.log('Replay started successfully');
            setTimeout(() => window.close(), 100);
          }
        });
      };

      const injectAndPlay = () => {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['scripts/content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Injection failed:', chrome.runtime.lastError.message);
            alert('Cannot control this tab. Ensure "Allow access to file URLs" is ON.');
          } else {
            // Wait slightly for script to initialize
            setTimeout(() => {
              chrome.tabs.sendMessage(activeTab.id, { type: 'REPLAY_SESSION', actions });
              window.close();
            }, 500);
          }
        });
      };

      sendMessage();
    });
  }
});
