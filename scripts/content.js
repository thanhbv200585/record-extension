{
  // --- SINGLETON PATTERN ---
  // Generate a unique ID for this instance of the script
  const instanceId = Date.now();
  window.autoFlowInstanceId = instanceId;
  console.log(`AutoFlow Recorder: Instance ${instanceId} initialized`);

  // State
  var isRecording = false;
  var isReplayPaused = false;
  var replayActions = [];
  var currentReplayIndex = 0;
  var activeSessionId = null;

  // Listen for state changes from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // DISCARD message if this isn't the most recently injected script!
    if (window.autoFlowInstanceId !== instanceId) {
      return; 
    }

    try {
      if (message.type === 'RECORDING_STATE_CHANGED') {
        isRecording = message.isRecording;
        if (isRecording) showRecordingIndicator();
        else removeRecordingIndicator();
      }
      
      if (message.type === 'REPLAY_SESSION') {
        // Prevent overlapping replays in the same instance
        activeSessionId = Date.now();
        replaySession(message.actions, activeSessionId);
      }

      if (message.type === 'PING') {
        sendResponse({ status: 'ready' });
      }
    } catch (e) {
      console.warn('AutoFlow: Message error', e);
    }
  });

  // Capture Events
  document.addEventListener('click', (e) => {
    if (!isRecording) return;
    // CRITICAL: Don't record clicks on AutoFlow's own UI elements
    if (isAutoFlowElement(e.target)) return;
    recordAction('click', e.target);
  }, true);

  document.addEventListener('input', (e) => {
    if (!isRecording) return;
    if (e.target.type === 'file') return;
    if (isAutoFlowElement(e.target)) return;
    recordAction('input', e.target, e.target.value);
  }, true);

  document.addEventListener('change', async (e) => {
    if (!isRecording) return;
    if (isAutoFlowElement(e.target)) return;
    
    if (e.target.type === 'file' && e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      const realPath = await showCustomPathModal(fileName);
      
      if (realPath) {
        if (!realPath.includes('...')) {
          recordAction('file', e.target, { fileName, filePath: realPath });
        } else {
          alert("Invalid path! Please enter the full path.");
        }
      }
    } else if (e.target.tagName === 'SELECT') {
      recordAction('input', e.target, e.target.value);
    }
  }, true);

  function isAutoFlowElement(el) {
    if (!el) return false;
    // Ignore anything inside our modals or with our prefix
    return el.closest('[id^="af-"]') || el.id.startsWith('af-');
  }

  async function replaySession(actions, sessionId) {
    console.log(`AutoFlow: Replay started (ID: ${sessionId})`);
    replayActions = actions;
    currentReplayIndex = 0;
    isReplayPaused = false;
    
    showReplayControls(actions.length);
    
    while (currentReplayIndex < replayActions.length) {
      // If a newer session started, kill this one
      if (activeSessionId !== sessionId) return;

      if (isReplayPaused) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      const action = replayActions[currentReplayIndex];
      updateReplayProgress(currentReplayIndex + 1, replayActions.length);
      
      // Wait for recorded delay
      const waitTime = Math.max(action.delay || 0, 500);
      const startWait = Date.now();
      while (Date.now() - startWait < waitTime) {
        if (isReplayPaused || activeSessionId !== sessionId) break;
        await new Promise(r => setTimeout(r, 50));
      }

      // Re-checks
      if (isReplayPaused) continue;
      if (activeSessionId !== sessionId) return;

      let el = null;
      let attempts = 0;
      while (!el && attempts < 15) {
        if (activeSessionId !== sessionId) return;
        el = document.querySelector(action.selector);
        if (!el) { attempts++; await new Promise(r => setTimeout(r, 200)); }
      }

      if (el) {
        highlightElement(el);
        if (action.type === 'click') {
          if (el.type !== 'file') el.click();
        } else if (action.type === 'input') {
          el.focus();
          el.value = action.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.blur();
        } else if (action.type === 'file') {
          await performDebuggerUpload(action.selector, action.value.filePath);
          updateDemoSiteUI(action.value.filePath);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        currentReplayIndex++;
      } else {
        console.warn('AutoFlow: Target skipped (not found):', action.selector);
        currentReplayIndex++;
      }
    }
    
    console.log('AutoFlow: Replay finished.');
    setTimeout(removeReplayControls, 1000);
  }

  function updateDemoSiteUI(path) {
    const preview = document.getElementById('file-name-preview');
    if (preview) {
      preview.innerHTML = `📄 <strong>Path:</strong> ${path}`;
      preview.style.color = '#cba6f7';
    }
  }

  async function performDebuggerUpload(selector, filePath) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'REPLAY_FILE', selector, filePath }, () => {
        setTimeout(resolve, 300);
      });
    });
  }

  function recordAction(type, element, value = null) {
    const selector = getUniqueSelector(element);
    
    // FINAL SAFETY SHIELD: Never record our own UI
    if (selector.includes('af-') || isAutoFlowElement(element)) {
      console.log('AutoFlow: Recording suppressed for internal UI element');
      return;
    }

    const action = { type, selector, value, timestamp: Date.now(), url: window.location.href };
    chrome.runtime.sendMessage({ type: 'RECORD_ACTION', action });
  }

  function getUniqueSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return 'body';
    if (el.id && !el.id.startsWith('af-')) return `#${el.id}`;
    
    const dataAttr = Array.from(el.attributes).find(attr => 
      attr.name.startsWith('data-test') || attr.name === 'name' || attr.name === 'role'
    );
    if (dataAttr) return `[${dataAttr.name}="${dataAttr.value}"]`;
    
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.parentNode) {
        const siblings = Array.from(el.parentNode.children).filter(s => s.nodeName === el.nodeName);
        if (siblings.length > 1) {
          const index = Array.from(el.parentNode.children).indexOf(el) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  function showCustomPathModal(fileName) {
    return new Promise((resolve) => {
      const existing = document.getElementById('af-modal-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'af-modal-overlay';
      overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:2147483647;font-family:sans-serif;`;
      overlay.innerHTML = `
        <div style="background:#1e1e2e;color:#cdd6f4;padding:28px;border-radius:16px;width:480px;border:1px solid #45475a;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
          <h3 style="margin:0 0 10px 0;color:#cba6f7;">File Bio Required</h3>
          <p style="font-size:14px;color:#a6adc8;margin-bottom:20px;">Paste the absolute path for: <br><strong style="color:white;word-break:break-all;">${fileName}</strong></p>
          <input type="text" id="af-path-input" placeholder="C:\\path\\to\\${fileName}" style="width:100%;padding:12px;background:#11111b;border:1px solid #45475a;border-radius:8px;color:white;margin-bottom:20px;outline:none;">
          <div style="display:flex;justify-content:flex-end;gap:12px;">
            <button id="af-modal-cancel" style="padding:10px 20px;background:none;border:1px solid #45475a;color:#a6adc8;cursor:pointer;border-radius:8px;">Cancel</button>
            <button id="af-modal-save" style="padding:10px 20px;background:#cba6f7;border:none;color:#1e1e2e;cursor:pointer;border-radius:8px;font-weight:700;">Save Path</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('#af-path-input');
      input.focus();
      overlay.querySelector('#af-modal-save').onclick = () => { resolve(input.value.trim()); overlay.remove(); };
      overlay.querySelector('#af-modal-cancel').onclick = () => { resolve(null); overlay.remove(); };
      input.onkeydown = (e) => { if(e.key==='Enter') overlay.querySelector('#af-modal-save').click(); };
    });
  }

  function showRecordingIndicator() {
    if (document.getElementById('af-recording-indicator')) return;
    const div = document.createElement('div');
    div.id = 'af-recording-indicator';
    div.style.cssText = `position:fixed;top:12px;right:12px;background:#f38ba8;color:white;padding:6px 14px;border-radius:20px;font-weight:bold;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;pointer-events:none;`;
    div.innerHTML = `<span style="width:8px;height:8px;background:white;border-radius:50%;margin-right:8px;"></span>RECORDING`;
    document.body.appendChild(div);
  }

  function removeRecordingIndicator() {
    const el = document.getElementById('af-recording-indicator');
    if (el) el.remove();
  }

  function showReplayControls(totalSteps) {
    const existing = document.getElementById('af-replay-controls');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'af-replay-controls';
    div.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e1e2e;color:white;padding:12px 24px;border-radius:16px;z-index:2147483647;display:flex;align-items:center;gap:20px;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid #45475a;`;
    div.innerHTML = `
      <div>
        <div style="font-size:10px;color:#a6adc8;text-transform:uppercase;">Replaying</div>
        <div id="af-step-count" style="font-weight:bold;color:#cba6f7;">Step 0 / ${totalSteps}</div>
      </div>
      <button id="af-pause-btn" style="background:#313244;border:none;color:white;padding:8px 16px;border-radius:8px;cursor:pointer;width:80px;">Pause</button>
      <button id="af-stop-btn" style="background:none;border:1px solid #f38ba8;color:#f38ba8;padding:8px 16px;border-radius:8px;cursor:pointer;">Stop</button>
    `;
    document.body.appendChild(div);
    div.querySelector('#af-pause-btn').onclick = function() {
      isReplayPaused = !isReplayPaused;
      this.textContent = isReplayPaused ? 'Resume' : 'Pause';
      this.style.background = isReplayPaused ? '#cba6f7' : '#313244';
      this.style.color = isReplayPaused ? '#1e1e2e' : 'white';
    };
    div.querySelector('#af-stop-btn').onclick = () => { activeSessionId = null; removeReplayControls(); };
  }

  function updateReplayProgress(current, total) {
    const el = document.getElementById('af-step-count');
    if (el) el.textContent = `Step ${current} / ${total}`;
  }

  function removeReplayControls() {
    const el = document.getElementById('af-replay-controls');
    if (el) el.remove();
  }

  function highlightElement(el) {
    const original = el.style.outline;
    el.style.outline = '4px solid #cba6f7';
    setTimeout(() => el.style.outline = original, 600);
  }
}
