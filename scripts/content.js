if (typeof window.autoFlowLoaded === 'undefined') {
  window.autoFlowLoaded = true;
  console.log('AutoFlow Recorder: Content script loaded');

  let isRecording = false;

  // Listen for state changes from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RECORDING_STATE_CHANGED') {
      isRecording = message.isRecording;
      console.log('Recording state:', isRecording);
      if (isRecording) {
        showRecordingIndicator();
      } else {
        removeRecordingIndicator();
      }
    }
    
    if (message.type === 'REPLAY_SESSION') {
      replaySession(message.actions);
    }

    if (message.type === 'PING') {
      sendResponse({ status: 'ready' });
    }
  });

  // Capture Events
  document.addEventListener('click', (e) => {
    if (!isRecording) return;
    recordAction('click', e.target);
  }, true);

  document.addEventListener('input', (e) => {
    if (!isRecording) return;
    // Ignore file inputs here, handle in 'change'
    if (e.target.type === 'file') return;
    recordAction('input', e.target, e.target.value);
  }, true);

  document.addEventListener('change', async (e) => {
    if (!isRecording) return;
    
    if (e.target.type === 'file' && e.target.files.length > 0) {
      const fileName = e.target.files[0].name;
      // Clearer prompt to avoid placeholder errors
      const realPath = prompt(
        `[AutoFlow Dev Mode] Chrome hides the full path for security.\n\n` +
        `Please PASTE the COMPLETE ABSOLUTE path for "${fileName}":\n` +
        `Example: C:\\Users\\Name\\Desktop\\${fileName}`,
        "" // Leave empty so they have to paste
      );
      
      if (realPath && !realPath.includes('...')) {
        recordAction('file', e.target, { 
          fileName: fileName,
          filePath: realPath 
        });
      } else if (realPath) {
        alert("Invalid path! Please enter the full path without '...'. Example: C:\\Users\\John\\Documents\\file.jpg");
      }
    } else if (e.target.tagName === 'SELECT') {
      recordAction('input', e.target, e.target.value);
    }
  }, true);

  function recordAction(type, element, value = null) {
    const selector = getUniqueSelector(element);
    const action = {
      type,
      selector,
      value,
      timestamp: Date.now(),
      url: window.location.href
    };
    
    chrome.runtime.sendMessage({ type: 'RECORD_ACTION', action });
  }

  function getUniqueSelector(el) {
    if (!(el instanceof Element)) return;
    if (el.id) return `#${el.id}`;
    const dataAttr = Array.from(el.attributes).find(attr => 
      attr.name.startsWith('data-test') || attr.name === 'name' || attr.name === 'role'
    );
    if (dataAttr) return `[${dataAttr.name}="${dataAttr.value}"]`;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.parentNode) {
        const siblings = Array.from(el.parentNode.children);
        const index = siblings.indexOf(el) + 1;
        if (siblings.filter(s => s.nodeName === el.nodeName).length > 1) {
          selector += `:nth-child(${index})`;
        }
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  function showRecordingIndicator() {
    if (document.getElementById('autoflow-recording-indicator')) return;
    const div = document.createElement('div');
    div.id = 'autoflow-recording-indicator';
    div.innerHTML = `
      <div style="position: fixed; top: 10px; right: 10px; background: rgba(255, 0, 0, 0.8); color: white; padding: 5px 12px; border-radius: 20px; font-family: sans-serif; font-size: 12px; z-index: 999999; display: flex; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.2); pointer-events: none;">
        <span style="width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 8px; animation: pulse 1s infinite;"></span>
        REC
      </div>
      <style> @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } } </style>
    `;
    document.body.appendChild(div);
  }

  function removeRecordingIndicator() {
    const indicator = document.getElementById('autoflow-recording-indicator');
    if (indicator) indicator.remove();
  }

  async function replaySession(actions) {
    console.log('Starting replay with Debugger support...', actions);
    for (const action of actions) {
      // 1. Wait for the natural delay recorded (min 0.5s for speed)
      await new Promise(r => setTimeout(r, Math.max(action.delay || 0, 500)));

      let el = null;
      let attempts = 0;
      while (!el && attempts < 10) {
        el = document.querySelector(action.selector);
        if (!el) { attempts++; await new Promise(r => setTimeout(r, 300)); }
      }

      if (!el) {
        console.error('Element not found:', action.selector);
        continue;
      }

      highlightElement(el);

      if (action.type === 'click') {
        // Skip clicking file inputs because it triggers a security error ('user activation required')
        // The file is handled by the 'file' action type via Debugger instead.
        if (el.type !== 'file') {
          el.click();
        } else {
          console.log('Skipping click on file input (handled by debugger)');
        }
      } else if (action.type === 'input') {
        el.focus();
        el.value = action.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
      } else if (action.type === 'file') {
        const { filePath } = action.value;
        console.log('Requesting Debugger to upload:', filePath);
        
        // Wait for background to finish debugger commands
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ 
            type: 'REPLAY_FILE', 
            selector: action.selector,
            filePath: filePath
          }, (response) => {
            if (response && response.status === 'success') {
              console.log('Debugger confirmed file set.');
            } else {
              console.error('File injection failed:', response ? response.message : 'Unknown error');
            }
            // Wait slightly for browser to settle after debugger detach
            setTimeout(resolve, 500);
          });
        });
        
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    console.log('Replay finished.');
  }

  function highlightElement(el) {
    const originalBorder = el.style.outline;
    el.style.outline = '2px solid #7c3aed';
    setTimeout(() => el.style.outline = originalBorder, 500);
  }
}
