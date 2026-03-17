# 🛠️ AutoFlow Recorder - Technical Documentation

This document provides a deep dive into the architecture, core modules, and logic behind the AutoFlow Recorder extension.

## 🏗️ System Architecture

AutoFlow follows the standard Chrome Extension architecture with a focus on cross-context communication and low-level browser manipulation via the Debugger API.

### 🧩 Core Components
1. **Content Script (`scripts/content.js`)**: The "Eyes and Hands". It lives inside the webpage, detects user interactions, and performs the replays.
2. **Background Service Worker (`scripts/background.js`)**: The "Brain". It manages the global state (Recording On/Off), captures network traffic, and executes safe low-level commands via the Debugger.
3. **Popup Interface (`popup/`)**: The "Dashboard". Provides the user interface to control recording, view history, and export data.

---

## ⏺️ Recording Engine

### Event Capture
The content script uses high-priority capture phase listeners to detect:
- **Clicks**: Filters out internal AutoFlow UI clicks.
- **Inputs**: Supports standard `<input>`/`<textarea>` and **Rich Text Editors**. Includes **Smart Coalescing** logic in the Background script to merge consecutive keystrokes into a single event, preventing noisy API triggers.
- **Changes**: Specifically handles file selection and dropdowns.
- **Hovers**: Captures `mouseover` events with a 500ms debounce to filter out mouse movement noise.
- **Filters**: Automatically ignores transient loading overlays (e.g., `biz-activity-indicator-singleton`) during both recording and replay.

### Selector Strategy (`getUniqueSelector`)
To ensure replays work even if a page slightly changes, AutoFlow uses a hierarchical strategy:
1. **ID**: If a unique ID exists, it's prefixed with the tag name (e.g., `input#accNo`) to avoid collisions with parent wrappers having the same ID.
2. **Data Attributes**: Prioritizes `data-test-*`, `name`, or `role` attributes, also prefixed with tag names.
3. **CSS Path**: Falls back to a full hierarchical path (e.g., `body > div:nth-child(2) > button`).

---

## ⏯️ Replay Engine

### Execution Flow
Replay is handled in a controlled `while` loop within `replaySession`:
- **Turbo-Wait Logic**: Respects recorded delays but applies a 0.3x speed multiplier and caps the floor at 100ms for high-speed execution.
- **Smart Element Search**: Polling intervals reduced to 50ms (up to 30 attempts) for near-instant interaction as soon as DOM nodes materialize.
- **Framework Compatibility**: Uses native setter calls to bypass framework-hijacked `.value` property setters (React/Angular compatibility).
- **Hover Simulation**: Dispatches `mouseenter`, `mouseover`, and `mousemove` in sequence to trigger dynamic JS dropdowns.
- **Highlighting**: Uses a temporary purple outline to show the user what is being interacted with.

---

## 🚀 Advanced Features

### 1. File Uploads (Debugger API)
Standard JavaScript cannot programmatically set a file input value due to security. AutoFlow solves this by:
1. Triggering a custom modal to ask for the **Absolute Path**.
2. Sending a message to the Background script.
3. The Background script attaches the `chrome.debugger`.
4. Executes `DOM.setFileInputFiles` to bypass browser security sandbox.

### 2. API Recording & Postman Export
- **Capture**: The Background script uses `Network.enable` via the Debugger to listen for all `Network.requestWillBeSent` events.
- **Filtering**: Automatically excludes data URLs, extension internal calls, and browser telemetry.
- **Postman Mapping**: Converts internal request logs (Method, Headers, URL, Body) into a **Postman Collection v2.1** schema for instant backend compatibility.

### 3. Bulk Data Management
- **Persistence**: Data is saved in `chrome.storage.local` with the `unlimitedStorage` permission.
- **Bulk Import**: The import engine supports both single session objects and arrays of sessions, automatically handling ID collisions and naming.

---

## 🛡️ Stability & Security

### Singleton Pattern
To prevent "Ghost Replays" when the extension is updated or pages are refreshed, the content script generates a unique `instanceId`. If multiple scripts are present in a tab, only the one matching the global `autoFlowInstanceId` will respond to messages.

### Message Protocol
Uses `chrome.runtime.sendMessage` with standardized types:
- `START_RECORDING` / `STOP_RECORDING`
- `RECORD_ACTION`
- `REPLAY_FILE`
- `GET_STATE` (To sync state across page reloads)

---

## 📂 Data Schema

### Session Object
```json
{
  "id": 1678820000000,
  "name": "Session Name",
  "actions": [
    {
      "type": "click",
      "selector": "#login-btn",
      "delay": 1200,
      "timestamp": 1678820001000
    }
  ],
  "networkRequests": [
    {
      "url": "https://api.example.com/v1/user",
      "method": "POST",
      "headers": {...},
      "postData": "{\"id\": 1}"
    }
  ]
}
```

---

## 🛠️ Debugging for Developers
- View **Console Logs** for `AutoFlow:` prefixes in the webpage console.
- Use **Background Page Inspect** to see network capture logs and storage updates.
- Use **Debugger Bar** (appears at top of Chrome) to verify attachment state.
