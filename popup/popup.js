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

  // Export/Import listeners
  const importInput = document.getElementById('import-input');
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const session = JSON.parse(event.target.result);
        if (session.actions && Array.isArray(session.actions)) {
          saveSession(session);
        } else {
          alert('Invalid session file format');
        }
      } catch (err) {
        alert('Failed to parse session file');
      }
    };
    reader.readAsText(file);
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

  function saveSession(newSession) {
    chrome.storage.local.get({ sessions: [] }, (data) => {
      const sessions = data.sessions;
      sessions.push({
        ...newSession,
        id: Date.now(), // Give it a new ID to avoid collisions
        name: `Imported: ${newSession.name}`
      });
      chrome.storage.local.set({ sessions }, () => {
        loadSessions();
      });
    });
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
            <button class="export-btn small-btn" title="Export">
              <span style="font-size: 10px;">💾</span>
            </button>
            <button class="play-btn small-btn" data-id="${session.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        `;
        
        item.querySelector('.play-btn').addEventListener('click', () => {
          replaySession(session.actions);
        });

        item.querySelector('.export-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          exportSession(session);
        });
        
        sessionList.appendChild(item);
      });
    });
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
