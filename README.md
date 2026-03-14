# 🚀 AutoFlow Recorder

A powerful Chrome extension designed for developers to record and replay user interactions. Perfect for automating repetitive testing flows, filling out complex forms, and debugging multi-step onboarding processes.

![Premium Design](https://img.shields.io/badge/Design-Premium-blueviolet)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-success)
![Version](https://img.shields.io/badge/Version-1.3.0-blue)
![Mode](https://img.shields.io/badge/Mode-Developer-orange)

## ✨ Features

- **Smart Recording**: Captures clicks, text inputs, selects, and file uploads.
- **Resilient Selectors**: Uses a multi-layered selection strategy (ID, Data-Attributes, and hierarchical paths) to ensure replays don't break when layouts shift.
- **Dynamic Replay**: Intelligently waits for elements to appear (ideal for SPAs/Async pages).
- **Export/Import**: Save your flows as JSON files to share with your team or use later.
- **Turbo Support (Dev Mode)**: Special handling for file uploads using the Chrome Debugger API to bypass browser security restrictions.

## 🛠️ Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** (top right toggle).
4. Click **"Load unpacked"** and select the extension folder.
5. **CRITICAL STEP**:
   - Find "AutoFlow Recorder" in the list.
   - Click **Details**.
   - Toggle **"Allow access to file URLs"** to **ON**. (This is required to record/replay on local files).

## 📁 Project Structure

- `manifest.json`: Configuration and permissions.
- `popup/`: The glassmorphism dashboard UI.
- `scripts/content.js`: The "eyes and hands" inside the web page.
- `scripts/background.js`: The "brain" managing state and Debugger permissions.
- `demo-site/`: A multi-step testing ground to see the extension in action.

## 🚀 How to Use

### 1. Recording
- Open the extension popup.
- Click **Start Recording**. (A red `REC` indicator will appear in the top-right of the page).
- **File Uploads**: When you select a file, a prompt will ask for its **Absolute Path** (e.g., `C:\Users\Name\Desktop\image.jpg`). This is a developer-mode requirement because browsers mask real paths.
- Click **Stop Recording** when finished.

### 2. Replaying
- Navigate to the page where you started.
- Open the popup and click the **Play** icon next to your session.
- The extension will automatically highlight elements and execute actions.
- **Auto-Injection**: If you just refreshed the extension, the "Play" button will automatically force-inject the necessary code—no page refresh required!

## 🧪 Testing with the Demo Site

1. Open `demo-site/index.html` in Chrome.
2. Record a session of you filling out the 4-step form.
3. Reach the File Upload step and provide the real path.
4. Stop and Play.
5. Watch as it zips through the form and shows a green "Uploaded" confirmation!

## ⚠️ Developer Notes (Security)

- This extension uses the `debugger` permission to automate file uploads. 
- Chrome will show a notification bar ("AutoFlow Recorder is debugging this browser") when replaying files—this is a native security feature that cannot be hidden.
- Intended for development and testing environments only.

---
*Built for developers who value their time.*
