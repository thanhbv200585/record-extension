# 📜 Changelog

All notable changes to the **AutoFlow Recorder** project will be documented in this file.

## [1.9.0] - 2026-03-20
### ✨ Added
- **AutoFlow API Tester**: A dedicated standalone tool for professional API testing without leaving your browser.
- **Smart cURL Import**: Instantly populate requests by pasting cURL commands. Optimized for both Unix and Windows (`^` escaping) formats.
- **Dynamic Request Builder**: Real-time Key-Value editor for URL parameters and headers. Support for JSON and Raw request bodies.
- **Dual Theme Mode**: Modern Glassmorphism UI with one-click toggle between Dark and Light themes.

## [1.8.0] - 2026-03-18
### ✨ Added
- **API Mocking Engine**: Native request interception via Chrome Debugger `Fetch` domain. Support for custom response status codes and JSON bodies.
- **Mocks Manager**: Dedicated dashboard tab to manage URL patterns (wildcards supported), HTTP methods, and response payloads.
- **Quick Mocking**: New "Mock this" button in the Network log for instant rule creation from captured traffic.
- **Robust UTF-8 Support**: Fixed encoding issues to ensure Vietnamese and other non-Latin characters are handled correctly in mock responses.
- **Mocking Indicator**: Visual status badge in the extension popup when mocking is active.

## [1.7.0] - 2026-03-18
### ✨ Added
- **Dashboard Pro Tools**: Added "Copy as cURL" and "Re-execute Request" for deep API debugging.
- **Smart Text Wrapping**: Enabled multi-line wrapping for long selectors and API URLs to ensure readability.
- **Copy to Clipboard**: Added quick-copy buttons for Request/Response Headers and Payloads.
- **Dual-Pane Dashboard**: Introducing a professional 3-column layout. View your automation steps and the network log side-by-side.
- **Full Network Inspection**: DevTools-style network log showing Request/Response Headers, Status codes, and full Payloads.
- **Enhanced Selector Engine**: Multi-level attribute priority and nearest-ID anchoring for maximum replay stability.

## [1.6.0] - 2026-03-18
### ✨ Added
- **Deep API Inspection**: Capture full Request and Response bodies for all background API calls triggered during automation.
- **Interactive Payload Viewer**: Expandable API rows in the Dashboard reveal detailed JSON payloads with syntax highlighting.
- **Smart Filtering**: Automatically filters and captures only relevant JSON/Text payloads to optimize storage and performance.

## [1.5.0] - 2026-03-18
### ✨ Added
- **Full-featured Dashboard**: New dedicated management page (`manager.html`) to view and organize all flows in a split-pane interface.
- **Visual Step Editor**: Users can now edit step values (text inputs, selects) and delete unwanted actions without re-recording.
- **Dynamic Variable System**: Support for `{{variable_name}}` placeholders. Define global variables in the dashboard and use them across any flow for dynamic data-driven testing.
- **Persistent Variable Storage**: Global variables are saved securely in local storage and synced across sessions.

### 🔧 Optimized
- **Advanced Replay Logic**: Automatic detection and substitution of variables during runtime.

## [1.4.0] - 2026-03-17
### ✨ Added
- **Hover Event Support**: Now captures and replays `mouseover` actions with a smart 500ms debounce to filter out mouse noise.
- **Session Renaming**: Added a ✏️ (pencil) icon to the flow list, allowing users to custom-name their recorded sessions.
- **Input Coalescing**: Consecutive keystrokes in the same field are now merged into a single action, drastically reducing redundant API calls and UI errors during replay.
- **Interactive Tooltips**: Added descriptive tooltips to main control buttons (Record, Import, Rename, etc.) for better usability.

### 🔧 Fixed & Optimized
- **Turbo Replay**: Increased replay speed up to 3x by optimizing default delays and reducing element-polling intervals.
- **Layout Integrity Fix**: Improved selector strategy to avoid overwriting parent wrapper elements (like Angular's `biz-text-field`) which previously caused titles like "Số tài khoản" to disappear.
- **Auto-Ignore Overlays**: The recorder now automatically ignores clicks and hovers on transient loading indicators (`biz-activity-indicator-singleton`).

## [1.3.0] - 2026-03-14
### ✨ Added
- **Bulk Import System**: Support for importing multiple flows from a single JSON file.
- **Smart Naming**: Automatically appends `(Imported)` to imported flows to prevent confusion.
- **UI Notifications**: Added success/failure notifications in the popup when importing data.
- **Improved Rich Text Support**: Enhanced detection for Notion-style contenteditable blocks.
- **State Persistence**: Fixed "State Amnesia" where recording state was lost on page refresh.

## [1.2.0] - 2026-03-14
### ✨ Added
- **API Traffic Recording**: The extension now automatically captures all background API calls (fetch/XHR) during your recording using the `chrome.debugger` Network domain.
- **Postman Collection Export**: New 📮 button in the session list to export all captured API calls into a **Postman Collection (v2.1)** JSON file, perfect for backend developers and API testing.
- **Advanced Request Capture**: Captures Methods, URL Query Params, Headers, and Request Bodies.

## [1.1.0] - 2026-03-14
### ✨ Added
- **Replay Control Bar**: Integrated a floating UI at the bottom of the page during replay with:
  - Real-time **Step Counter** (e.g., Step 3 / 10).
  - **Pause/Resume** functionality for debugging specific moments.
  - **Stop** button to immediately terminate a replay session.
- **Custom File Path Modal**: Replaced browser `prompt()` with a premium dark-mode modal for entering absolute file paths.
- **Delete Functionality**: Added a 🗑️ trash icon to the popup history list to remove unwanted recordings.
- **Singleton Pattern**: Ensured only the latest injected content script responds to messages, preventing "ghost" replays.
- **UI Shield**: Implemented logic to automatically ignore and suppress recordings of AutoFlow's own UI elements (modals, indicators, etc.).

### 🔧 Fixed
- **Absolute Path Visibility**: Updated the Demo Site replay logic to display the full absolute path in purple, providing clear verification of success.
- **Re-injection Loop**: Fixed a bug where refreshing the extension would cause a `SyntaxError` due to variable re-declaration.
- **Z-Index Issues**: Boosted modal z-index to `2147483647` to ensure visibility over any website layout.

---

## [1.0.0] - 2026-03-14
### ✨ Added
- **Core Recording Engine**: Capture clicks, text input, and select changes.
- **Debugger Integration**: Support for file uploads using `chrome.debugger` to bypass browser security (`fakepath`).
- **Resilient Selectors**: Multi-layered selector strategy (ID > Data-Attrs > CSS Path).
- **Import/Export**: JSON-based session portability.
- **Glassmorphism UI**: High-end popup dashboard design.
- **Demo Environment**: Multi-step onboarding site for verification.

[1.1.0]: https://github.com/thanhbv200585/record-extension/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/thanhbv200585/record-extension/releases/tag/v1.0.0
