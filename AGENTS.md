<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Modern HAR Editor - Agent Rules

## High-Performance Mandates
- **Streaming Parser Only**: NEVER use `JSON.parse()` for the main HAR file. Use `@streamparser/json` within a Web Worker (`app/workers/har-parser.worker.ts`) to handle files >100MB without blocking the main thread.
- **Virtualized Rendering**: All lists/tables containing HAR entries MUST use `react-virtuoso` (`TableVirtuoso`). Standard mapping of thousands of rows will crash the browser.
- **Batch State Updates**: When parsing, send entries from the worker in batches (e.g., 500 entries) to avoid overwhelming the Zustand store with frequent re-renders.

## Stability & Compatibility
- **Defensive HAR Access**: HAR data is notoriously non-standard. Always use optional chaining (e.g., `entry.response.content.mimeType?.split(';')[0]`) and provide fallbacks. Never assume a field exists just because it's in the spec.
- **Secure Context Fallbacks**: Many browser APIs (Clipboard, Crypto) require HTTPS. Always implement fallbacks for non-secure contexts (e.g., using the `copyToClipboard` utility in `app/utils.ts`).
- **Local-Only Processing**: Maintain the "No Server Involved" promise. Do not implement features that send HAR data to any external API.

## Technical Stack
- **State**: Zustand (`app/store/useHarStore.ts`) for global HAR state and sanitization logic.
- **Styling**: Tailwind CSS with `lucide-react` for icons.
- **Type Safety**: Maintain strict TypeScript interfaces in `app/types/har.ts`. Avoid `any`.
