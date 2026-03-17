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
  var activeSessionId = null;
  var hoverTimer = null;
  var lastHoverElement = null;

  // Request current state from background on load
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.isRecording) {
      isRecording = true;
      showRecordingIndicator();
      console.log('AutoFlow: Resumed recording state from background');
    }
  });

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

  document.addEventListener('mouseover', (e) => {
    if (!isRecording) return;
    if (isAutoFlowElement(e.target)) return;

    if (hoverTimer) clearTimeout(hoverTimer);

    hoverTimer = setTimeout(() => {
      if (e.target === document.body || e.target === document.documentElement) return;
      if (lastHoverElement === e.target) return;

      console.log('AutoFlow: Action recorded (hover)');
      recordAction('hover', e.target);
      lastHoverElement = e.target;
    }, 500);
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (hoverTimer) clearTimeout(hoverTimer);
  }, true);

  document.addEventListener('input', (e) => {
    if (!isRecording) return;
    if (e.target.type === 'file') return;
    if (isAutoFlowElement(e.target)) return;

    // Notion/Rich Editors: Check value first, then innerText, then textContent
    let val = e.target.value;
    if (val === undefined || e.target.getAttribute('contenteditable') === 'true') {
      val = e.target.innerText || e.target.textContent;
    }

    console.log('AutoFlow: Action recorded:', val);
    recordAction('input', e.target, val);
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
    if (!el || typeof el.closest !== 'function') return false;
    // Ignore our own UI and dynamic loading overlays
    return el.closest('[id^="af-"]') ||
      el.id.startsWith('af-') ||
      el.closest('biz-activity-indicator-singleton');
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

      // Fetch variables for dynamic substitution
      const storage = await new Promise(r => chrome.storage.local.get({ variables: {} }, r));
      const vars = storage.variables || {};
      
      let processedValue = action.value;
      if (typeof processedValue === 'string') {
        // Replace {{name}} with variable value
        processedValue = processedValue.replace(/\{\{(.+?)\}\}/g, (match, key) => {
          return vars[key.trim()] !== undefined ? vars[key.trim()] : match;
        });
      }

      // Wait for recorded delay (speed up replay x2 to x5)
      const waitTime = Math.max((action.delay || 0) * 0.3, 100);
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
      // Increased retry limit to 100 (5 seconds total) to handle complex UI transitions
      while (!el && attempts < 100) {
        if (activeSessionId !== sessionId) return;
        el = document.querySelector(action.selector);
        // Retry every 50ms
        if (!el) { attempts++; await new Promise(r => setTimeout(r, 50)); }
      }

      if (el) {
        highlightElement(el);
        if (action.type === 'click') {
          if (el.type !== 'file') el.click();
        } else if (action.type === 'input') {
          // Fix for wrapper components (like Angular's biz-text-field) sharing the same ID as the input
          if (el.value === undefined && !el.isContentEditable) {
            const innerInput = el.querySelector('input, textarea');
            if (innerInput) el = innerInput;
          }

          el.focus();
          if (el.value !== undefined) {
            // Bypass framework hijacked setters to ensure proper state updates
            const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
            const nativeSetter = Object.getOwnPropertyDescriptor(proto?.prototype || {}, 'value')?.set;
            if (nativeSetter) {
              nativeSetter.call(el, processedValue);
            } else {
              el.value = processedValue;
            }
          } else {
            el.innerText = processedValue;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.blur();
        } else if (action.type === 'file') {
          await performDebuggerUpload(action.selector, action.value.filePath);
          updateDemoSiteUI(action.value.filePath);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (action.type === 'hover') {
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window }));
          // Provide a tiny delay to allow JS hover menus to open
          await new Promise(r => setTimeout(r, 400));
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
    if (type !== 'hover') lastHoverElement = null; // Reset consecutive hover check

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

    const tagName = el.tagName.toLowerCase();

    // 1. ID (highest priority - extremely stable)
    if (el.id && !el.id.startsWith('af-')) return `${tagName}#${el.id}`;

    // 2. High-quality semantic attributes
    const bestAttrs = ['data-test', 'data-id', 'data-cy', 'name', 'role', 'aria-label', 'placeholder', 'title'];
    for (const attrName of bestAttrs) {
        const val = el.getAttribute(attrName);
        if (val) return `${tagName}[${attrName}="${val}"]`;
    }

    // 3. Build a relative path anchored to the nearest ID'd parent
    const path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      // If we hit an ID, stop and anchor the selector there
      if (current.id && !current.id.startsWith('af-')) {
        path.unshift(`${current.nodeName.toLowerCase()}#${current.id}`);
        break;
      }

      // Try to use semantic attributes at each level to keep path specific
      let levelAttr = null;
      for (const attrName of bestAttrs) {
        const val = current.getAttribute(attrName);
        if (val) {
          levelAttr = `[${attrName}="${val}"]`;
          break;
        }
      }

      if (levelAttr) {
        selector += levelAttr;
      } else if (current.parentNode) {
        // Fallback to nth-child only when no attributes are available
        const siblings = Array.from(current.parentNode.children).filter(s => s.nodeName === current.nodeName);
        if (siblings.length > 1) {
          const index = Array.from(current.parentNode.children).indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentNode;
      
      // Safety break: don't build paths longer than 5 levels if not anchored to an ID
      if (path.length > 5 && (!current || !current.id)) break;
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
      input.onkeydown = (e) => { if (e.key === 'Enter') overlay.querySelector('#af-modal-save').click(); };
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
    div.querySelector('#af-pause-btn').onclick = function () {
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
