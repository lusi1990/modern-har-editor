# 🚀 Modern HAR Editor

A high-performance, privacy-focused web application for inspecting, filtering, and modifying HTTP Archive (HAR) files. Built with Next.js, Web Workers, and Streaming JSON parsing to handle files of any size without breaking a sweat.

## ✨ Features

- **⚡ Blazing Fast Parsing**: Uses `@streamparser/json` in a background Web Worker. Even 100MB+ files won't freeze your UI.
- **📜 Virtual Scrolling**: Powered by `react-virtuoso` to render thousands of network requests at 60FPS.
- **🔒 Privacy First**: All processing happens locally in your browser. Your sensitive network data never leaves your machine.
- **🛡️ One-Click Privacy Scrub**: Automatically mask `Authorization` headers, granular `Cookies`, and sensitive keys (passwords, tokens) in JSON or Form-encoded payloads.
- **📝 Monaco-Powered Editing**: Full manual editing of Request/Response Headers and Bodies using the VS Code-grade Monaco Editor.
- **🔍 Deep Inspection**: Detailed views with syntax highlighting for JSON-formatted POST data and response previews.
- **✂️ Modify & Export**: Delete unwanted entries, edit data, and export the sanitized HAR file instantly.
- **📏 Resizable UI**: Manually adjustable URL column width to handle long API endpoints.
- **🛡️ Robust Fallbacks**: Handles non-standard HAR files and provides clipboard fallbacks for non-secure contexts.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) via `@monaco-editor/react`
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Parsing**: [@streamparser/json](https://github.com/juanjoDiaz/streamparser-json) (Streaming API)
- **Rendering**: [React Virtuoso](https://virtuoso.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: TypeScript (Strict Mode)

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ or [Bun](https://bun.sh/)

### Installation

```bash
git clone https://github.com/your-username/modern-har-editor.git
cd modern-har-editor
npm install
# or
bun install
```

### Running Locally

```bash
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to start editing.

## 🔁 Request Replay & CORS Solutions

The application includes a built-in HTTP client for replaying and debugging network requests directly from your browser. When testing or joint debugging (联调) against external APIs or local servers, you may encounter CORS (Cross-Origin Resource Sharing) policy blocks.

Here are the two easiest ways to bypass browser CORS restrictions:

### Method 1: Use a Browser Extension (Recommended)
This is the fastest and most convenient method for web-based API testing.
1. Install a CORS proxy extension in your browser, such as [Allow CORS: Access-Control-Allow-Origin](https://chromewebstore.google.com/detail/allow-cors/nfommabkpincchfljfgedplbfimaipkn) or **CORS Unblock**.
2. Activate the extension (toggle it on/green).
3. Re-run your request replay in the editor.

### Method 2: Launch Browser with Disabled Web Security
You can open a separate browser instance with disabled security policies specifically for local testing.

- **macOS**:
  ```bash
  open -n -a "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome_dev"
  ```
- **Windows**:
  ```cmd
  chrome.exe --disable-web-security --user-data-dir="C:/chrome_dev"
  ```
- **Linux**:
  ```bash
  google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"
  ```

## 🏗️ Architecture

The app is designed around a "Streaming First" architecture:

1. **Uploader**: Captures the file handle via `react-dropzone`.
2. **Worker**: Creates a `ReadableStream` from the file and feeds it chunk-by-chunk into the JSON parser.
3. **Store**: Receives entries in batches of 500 to optimize React re-renders and manages sanitization logic.
4. **Editor**: Integrates Monaco Editor for high-fidelity data modification.

## 📝 License

MIT
