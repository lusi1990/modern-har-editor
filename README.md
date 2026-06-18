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

## 🏗️ Architecture

The app is designed around a "Streaming First" architecture:

1. **Uploader**: Captures the file handle via `react-dropzone`.
2. **Worker**: Creates a `ReadableStream` from the file and feeds it chunk-by-chunk into the JSON parser.
3. **Store**: Receives entries in batches of 500 to optimize React re-renders and manages sanitization logic.
4. **Editor**: Integrates Monaco Editor for high-fidelity data modification.

## 📝 License

MIT
