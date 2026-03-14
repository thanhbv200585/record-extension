# 📜 Changelog

All notable changes to the **AutoFlow Recorder** project will be documented in this file.

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
